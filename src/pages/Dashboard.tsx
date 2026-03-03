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
    status: ["Pendiente", "En Progreso", "Completada"].includes(x?.status) ? x.status : "Pendiente",
    clienteId: x?.clienteId,
    createdAt: x?.createdAt,
    deleted: !!x?.deleted,
    pending: !!x?.pending,
  };
}

export default function Dashboard() {
  // --- ESTADOS DE TAREAS ---
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

  // --- ESTADOS DE PERSONALIZACIÓN ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("user-theme");
    return saved ? JSON.parse(saved) : {
      fontSize: "16px",
      fontFamily: "Inter, sans-serif",
      accentColor: "#1f6feb",
      background: "#0b0d10",
      mainColor: "#e7eaee"
    };
  });

  // --- MOTOR DE TEMA (APLICAR CAMBIOS) ---
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--main-bg", theme.background);
    root.style.setProperty("--accent-color", theme.accentColor);
    root.style.setProperty("--font-family", theme.fontFamily);
    root.style.setProperty("--main-font-size", theme.fontSize);
    root.style.setProperty("--main-color", theme.mainColor);
    localStorage.setItem("user-theme", JSON.stringify(theme));
  }, [theme]);

  const updateTheme = (updates: Partial<typeof theme>) => {
    setTheme((prev) => ({ ...prev, ...updates }));
  };

  // --- LÓGICA DE SINCRONIZACIÓN Y CARGA ---
  useEffect(() => {
    setAuth(localStorage.getItem("token"));
    const unsubscribe = setupOnlineSync();
    const on = async () => { setOnline(true); await syncNow(); await loadFromServer(); };
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

    return () => { unsubscribe?.(); window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  async function loadFromServer() {
    try {
      const { data } = await api.get("/tasks");
      const list = (Array.isArray(data?.items) ? data.items : []).map(normalizeTask);
      setTasks(list);
      await cacheTasks(list);
    } catch { } finally { setLoading(false); }
  }

  // --- MANEJO DE TAREAS ---
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const clienteId = crypto.randomUUID();
    const localTask = normalizeTask({ _id: clienteId, title, description, status: "Pendiente", pending: !navigator.onLine });
    setTasks(prev => [localTask, ...prev]);
    await putTaskLocal(localTask);
    setTitle(""); setDescription("");
    if (!navigator.onLine) {
      await queue({ id: "op-" + clienteId, op: "create", clienteId, data: localTask, ts: Date.now() });
      return;
    }
    try {
      const { data } = await api.post("/tasks", { title: localTask.title, description: localTask.description });
      const created = normalizeTask(data?.task ?? data);
      setTasks(prev => prev.map(x => x._id === clienteId ? created : x));
      await putTaskLocal(created);
    } catch {
      await queue({ id: "op-" + clienteId, op: "create", clienteId, data: localTask, ts: Date.now() });
    }
  }

  async function handleStatusChange(task: Task, newStatus: Status) {
    const updated = { ...task, status: newStatus };
    setTasks(prev => prev.map(x => x._id === task._id ? updated : x));
    await putTaskLocal(updated);
    if (!navigator.onLine) {
      await queue({ id: "upd-" + task._id, op: "update", serverId: isLocalId(task._id) ? undefined : task._id, clienteId: isLocalId(task._id) ? task._id : undefined, data: { status: newStatus }, ts: Date.now() });
      return;
    }
    try { await api.put(`/tasks/${task._id}`, { status: newStatus }); } 
    catch { await queue({ id: "upd-" + task._id, op: "update", serverId: task._id, data: { status: newStatus }, ts: Date.now() }); }
  }

  async function removeTask(taskId: string) {
    setTasks(prev => prev.filter(t => t._id !== taskId));
    await removeTaskLocal(taskId);
    if (!navigator.onLine) {
      await queue({ id: "del-" + taskId, op: "delete", serverId: isLocalId(taskId) ? undefined : taskId, clienteId: isLocalId(taskId) ? taskId : undefined, ts: Date.now() });
      return;
    }
    try { await api.delete(`/tasks/${taskId}`); } catch { }
  }

  const filtered = useMemo(() => {
    let list = tasks;
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(s) || (t.description || "").toLowerCase().includes(s));
    }
    if (filter === "active") list = list.filter(t => t.status !== "Completada");
    if (filter === "completed") list = list.filter(t => t.status === "Completada");
    return list;
  }, [tasks, search, filter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === "Completada").length
  }), [tasks]);

  return (
    <div className="wrap">
      <header className="topbar">
        <h1>To-Do PWA</h1>
        <div className="spacer" />
        <div className="stats">
          <span>{stats.done}/{stats.total} completadas</span>
          <div className="connection-status">
            <span className="status-dot" style={{ backgroundColor: online ? "#22c55e" : "#ef4444" }} />
            <small>{online ? "ONLINE" : "OFFLINE"}</small>
          </div>
          <button className="btn danger" onClick={() => { localStorage.removeItem("token"); window.location.href="/"; }}>Salir</button>
        </div>
      </header>

      <main>
        <form className="add-grid" onSubmit={addTask}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué hay que hacer?" />
          <button className="btn">Agregar</button>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descripción adicional..." rows={2} />
        </form>

        <div className="toolbar">
          <input className="search" placeholder="Buscar tareas..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="filters">
            <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas</button>
            <button className={`chip ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>Pendientes</button>
          </div>
        </div>

        {loading ? <p style={{textAlign:'center'}}>Cargando...</p> : (
          <ul className="list">
            {filtered.map(t => (
              <li key={t._id} className={`item ${t.status === "Completada" ? "done" : ""}`}>
                <select className="status-select" value={t.status} onChange={e => handleStatusChange(t, e.target.value as Status)}>
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Progreso">En Progreso</option>
                  <option value="Completada">Completada</option>
                </select>
                <div className="content">
                  <span className="title">{t.title}</span>
                  {t.description && <p className="desc">{t.description}</p>}
                </div>
                <div className="actions">
                  <button className="icon danger" onClick={() => removeTask(t._id)}>🗑️</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* COMPONENTE DE PERSONALIZACIÓN */}
      <div className="config-container">
        <button className="config-toggle" onClick={() => setIsSidebarOpen(true)}>🎨</button>
        <aside className={`config-sidebar ${isSidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <h3>Apariencia</h3>
            <button className="close-btn" onClick={() => setIsSidebarOpen(false)}>✕</button>
          </div>

          <div className="config-section">
            <h4>Tipografía</h4>
            <select value={theme.fontFamily} onChange={e => updateTheme({ fontFamily: e.target.value })} className="status-select">
              <option value="Inter, sans-serif">Moderna</option>
              <option value="'JetBrains Mono', monospace">Monoespacio</option>
              <option value="serif">Elegante</option>
            </select>
          </div>

          <div className="config-section">
            <h4>Fondo</h4>
            <div className="options-grid">
              <button onClick={() => updateTheme({ background: "#0b0d10", mainColor: "#e7eaee" })}>Noche</button>
              <button onClick={() => updateTheme({ background: "#f8fafc", mainColor: "#1a202c", accentColor: "#3b82f6" })}>Claro</button>
              <button onClick={() => updateTheme({ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", mainColor: "#ffffff" })}>Púrpura</button>
              <button onClick={() => updateTheme({ background: "#1a202c", mainColor: "#e2e8f0" })}>Gris</button>
            </div>
          </div>

          <div className="config-section">
            <h4>Color de Acento</h4>
            <input type="color" value={theme.accentColor} onChange={e => updateTheme({ accentColor: e.target.value })} style={{width:'100%', height:'40px', border:'none', borderRadius:'8px'}} />
          </div>
        </aside>
      </div>
    </div>
  );
}