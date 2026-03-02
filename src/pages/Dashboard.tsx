import { useEffect, useMemo, useState } from "react";
import { api, setAuth } from "../api";
import {
  cacheTasks,
  getAllTasksLocal,
  putTaskLocal,
  removeTaskLocal,
  queue,
  type OutboxOp,
} from "../offline/db";
import { syncNow, setupOnlineSync } from "../offline/sync";

type Status = "Pendiente" | "En Progreso" | "Completada";

type Task = {
  _id: string;
  title: string;
  description?: string;
  status: Status;
  clienteId?: string;
  createdAt?: string;
  deleted?: boolean;
  pending?: boolean;
};

const isLocalId = (id: string) => !/^[a-f0-9]{24}$/i.test(id);

function normalizeTask(x: any): Task {
  return {
    _id: String(x?._id ?? x?.id),
    title: String(x?.title ?? "(sin título)"),
    description: x?.description ?? "",
    status:
      x?.status === "Completada" ||
      x?.status === "En Progreso" ||
      x?.status === "Pendiente"
        ? x.status
        : "Pendiente",
    clienteId: x?.clienteId,
    createdAt: x?.createdAt,
    deleted: !!x?.deleted,
    pending: !!x?.pending,
  };
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  // 1. NUEVO: Estados para personalización y barra lateral
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("user-theme");
    return saved ? JSON.parse(saved) : {
      fontSize: "16px",
      fontFamily: "Inter, sans-serif",
      accentColor: "#1f6feb",
      background: "#0b0d10"
    };
  });

  // 2. NUEVO: Efecto para aplicar cambios visuales y persistencia
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--main-bg", theme.background);
    root.style.setProperty("--accent-color", theme.accentColor);
    root.style.setProperty("--font-family", theme.fontFamily);
    root.style.setProperty("--main-font-size", theme.fontSize);
    
    localStorage.setItem("user-theme", JSON.stringify(theme));
  }, [theme]);

  const updateTheme = (key: string, value: string) => {
    setTheme((prev: any) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setAuth(localStorage.getItem("token"));
    const unsubscribe = setupOnlineSync();

    const on = async () => {
      setOnline(true);
      await syncNow();
      await loadFromServer();
    };
    const off = () => setOnline(false);
    
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    (async () => {
      const local = await getAllTasksLocal();
      if (local?.length) setTasks(local.map(normalizeTask));
      await loadFromServer();
      await syncNow();
      await loadFromServer();
    })();

    return () => {
      unsubscribe?.();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ... (Tus funciones addTask, saveEdit, handleStatusChange, removeTask y logout se mantienen igual)
  async function loadFromServer() {
    try {
      const { data } = await api.get("/tasks");
      const raw = Array.isArray(data?.items) ? data.items : [];
      const list = raw.map(normalizeTask);
      setTasks(list);
      await cacheTasks(list);
    } catch { /* Error silencioso */ } finally { setLoading(false); }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const d = description.trim();
    if (!t) return;
    const clienteId = crypto.randomUUID();
    const localTask = normalizeTask({ _id: clienteId, title: t, description: d, status: "Pendiente" as Status, pending: !navigator.onLine });
    setTasks((prev) => [localTask, ...prev]);
    await putTaskLocal(localTask);
    setTitle(""); setDescription("");
    if (!navigator.onLine) {
      await queue({ id: "op-" + clienteId, op: "create", clienteId, data: localTask, ts: Date.now() });
      return;
    }
    try {
      const { data } = await api.post("/tasks", { title: t, description: d });
      const created = normalizeTask(data?.task ?? data);
      setTasks((prev) => prev.map((x) => (x._id === clienteId ? created : x)));
      await putTaskLocal(created);
    } catch {
      await queue({ id: "op-" + clienteId, op: "create", clienteId, data: localTask, ts: Date.now() });
    }
  }

  function startEdit(task: Task) {
    setEditingId(task._id);
    setEditingTitle(task.title);
    setEditingDescription(task.description ?? "");
  }

  async function saveEdit(taskId: string) {
    const newTitle = editingTitle.trim();
    const newDesc = editingDescription.trim();
    if (!newTitle) return;
    const before = tasks.find((t) => t._id === taskId);
    const patched = { ...before, title: newTitle, description: newDesc } as Task;
    setTasks((prev) => prev.map((t) => (t._id === taskId ? patched : t)));
    await putTaskLocal(patched);
    setEditingId(null);
    const opData = { title: newTitle, description: newDesc };
    if (!navigator.onLine) {
      await queue({ id: "upd-" + taskId, op: "update", clienteId: isLocalId(taskId) ? taskId : undefined, serverId: isLocalId(taskId) ? undefined : taskId, data: opData, ts: Date.now() } as OutboxOp);
      return;
    }
    try { await api.put(`/tasks/${taskId}`, opData); } 
    catch { await queue({ id: "upd-" + taskId, op: "update", serverId: taskId, data: opData, ts: Date.now() } as OutboxOp); }
  }

  async function handleStatusChange(task: Task, newStatus: Status) {
    const updated = { ...task, status: newStatus };
    setTasks((prev) => prev.map((x) => (x._id === task._id ? updated : x)));
    await putTaskLocal(updated);
    const opData = { status: newStatus };
    if (!navigator.onLine) {
      await queue({ id: "upd-" + task._id, op: "update", serverId: isLocalId(task._id) ? undefined : task._id, clienteId: isLocalId(task._id) ? task._id : undefined, data: opData, ts: Date.now() });
      return;
    }
    try { await api.put(`/tasks/${task._id}`, opData); } 
    catch { await queue({ id: "upd-" + task._id, op: "update", serverId: task._id, data: opData, ts: Date.now() }); }
  }

  async function removeTask(taskId: string) {
    const backup = tasks;
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    await removeTaskLocal(taskId);
    if (!navigator.onLine) {
      await queue({ id: "del-" + taskId, op: "delete", serverId: isLocalId(taskId) ? undefined : taskId, clienteId: isLocalId(taskId) ? taskId : undefined, ts: Date.now() });
      return;
    }
    try { await api.delete(`/tasks/${taskId}`); } 
    catch {
      setTasks(backup);
      for (const t of backup) await putTaskLocal(t);
      await queue({ id: "del-" + taskId, op: "delete", serverId: taskId, clienteId: isLocalId(taskId) ? taskId : undefined, ts: Date.now() });
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setAuth(null);
    window.location.href = "/";
  }

  const filtered = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((t) => (t.title || "").toLowerCase().includes(s) || (t.description || "").toLowerCase().includes(s));
    }
    if (filter === "active") list = list.filter((t) => t.status !== "Completada");
    if (filter === "completed") list = list.filter((t) => t.status === "Completada");
    return list;
  }, [tasks, search, filter]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "Completada").length;
    return { total, done, pending: total - done };
  }, [tasks]);

  return (
    <div className="wrap">
      <header className="topbar">
        <h1>To-Do PWA</h1>
        <div className="spacer" />
        <div className="stats">
          <span>Total: <b>{stats.total}</b></span>
          <span>Hechas: <b>{stats.done}</b></span>
          
          <div className="connection-status" title={online ? "Conectado" : "Desconectado"}>
            <span 
              className="status-dot" 
              style={{ backgroundColor: online ? "#22c55e" : "#ef4444", boxShadow: `0 0 8px ${online ? "#22c55e" : "#ef4444"}` }} 
            />
            <span style={{ color: online ? "#22c55e" : "#ef4444", fontWeight: "bold", fontSize: "0.85rem" }}>
              {online ? "EN LÍNEA" : "SIN RED"}
            </span>
          </div>

          <button className="btn danger" onClick={logout}>Salir</button>
        </div>
      </header>

      <main>
        <form className="add add-grid" onSubmit={addTask}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la tarea…" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)…" rows={2} />
          <button className="btn">Agregar</button>
        </form>

        <div className="toolbar">
          <input className="search" placeholder="Buscar por título o descripción…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="filters">
            <button className={filter === "all" ? "chip active" : "chip"} onClick={() => setFilter("all")}>Todas</button>
            <button className={filter === "active" ? "chip active" : "chip"} onClick={() => setFilter("active")}>Activas</button>
            <button className={filter === "completed" ? "chip active" : "chip"} onClick={() => setFilter("completed")}>Hechas</button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "white", textAlign: "center", marginTop: "2rem" }}>Cargando tareas...</p>
        ) : filtered.length === 0 ? (
          <p className="empty">Sin tareas</p>
        ) : (
          <ul className="list">
            {filtered.map((t) => (
              <li key={t._id} className={t.status === "Completada" ? "item done" : "item"}>
                <select value={t.status} onChange={(e) => handleStatusChange(t, e.target.value as Status)} className="status-select">
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Progreso">En Progreso</option>
                  <option value="Completada">Completada</option>
                </select>

                <div className="content">
                  {editingId === t._id ? (
                    <>
                      <input className="edit" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} autoFocus />
                      <textarea className="edit" value={editingDescription} onChange={(e) => setEditingDescription(e.target.value)} rows={2} />
                    </>
                  ) : (
                    <>
                      <span className="title" onDoubleClick={() => startEdit(t)}>{t.title}</span>
                      {t.description && <p className="desc">{t.description}</p>}
                      {(t.pending || isLocalId(t._id)) && (
                        <span className="badge" style={{ background: "#b45309", width: "fit-content", marginTop: "5px" }}>
                          Falta sincronizar
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="actions">
                  {editingId === t._id ? (
                    <button className="btn" onClick={() => saveEdit(t._id)}>Guardar</button>
                  ) : (
                    <button className="icon" onClick={() => startEdit(t)}>✏️</button>
                  )}
                  <button className="icon danger" onClick={() => removeTask(t._id)}>🗑️</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* 3. NUEVO: Componentes de Personalización */}
      <button 
        className="config-toggle" 
        onClick={() => setIsSidebarOpen(true)}
        style={{ background: theme.accentColor }}
      >
        🎨
      </button>

      <aside className={`config-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h3>Apariencia</h3>
          <button className="close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
        </div>

        <div className="config-section">
          <h4>Tipografía</h4>
          <select 
            value={theme.fontFamily} 
            onChange={(e) => updateTheme("fontFamily", e.target.value)}
            className="status-select"
            style={{ width: '100%' }}
          >
            <option value="Inter, sans-serif">Moderna (Inter)</option>
            <option value="'Playfair Display', serif">Elegante (Serif)</option>
            <option value="'JetBrains Mono', monospace">Código (Mono)</option>
          </select>
        </div>

        <div className="config-section">
          <h4>Tamaño de letra</h4>
          <div className="filters">
            <button className={theme.fontSize === '14px' ? 'chip active' : 'chip'} onClick={() => updateTheme('fontSize', '14px')}>Pequeño</button>
            <button className={theme.fontSize === '16px' ? 'chip active' : 'chip'} onClick={() => updateTheme('fontSize', '16px')}>Normal</button>
            <button className={theme.fontSize === '20px' ? 'chip active' : 'chip'} onClick={() => updateTheme('fontSize', '20px')}>Grande</button>
          </div>
        </div>

        <div className="config-section">
          <h4>Fondo</h4>
          <div className="options-grid">
            <button onClick={() => updateTheme("background", "#0b0d10")}>Noche</button>
            <button onClick={() => updateTheme("background", "#1a202c")}>Azul Gris</button>
            <button onClick={() => updateTheme("background", "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)")}>Gradiente</button>
            <button 
            onClick={() => { 
            updateTheme("background", "#f8fafc"); 
            updateTheme("accentColor", "#3b82f6");
            updateTheme("mainColor", "#1a202c"); // Un gris oscuro para que sea legible 
            }}
              >
              Claro
              </button>          </div>
        </div>

        <div className="config-section">
          <h4>Color de acento</h4>
          <input 
            type="color" 
            value={theme.accentColor} 
            onChange={(e) => updateTheme("accentColor", e.target.value)} 
            style={{ width: '100%', height: '40px', cursor: 'pointer', border: 'none', borderRadius: '8px' }}
          />
        </div>
      </aside>
    </div>
  );
}