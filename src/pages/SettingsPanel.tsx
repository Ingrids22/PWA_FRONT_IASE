import { useState } from "react";
import type { Settings, Theme, Density, BorderRadius, Sound } from "./useSettings";
import { playCompletionSound } from "./useSettings";
import "./SettingsPanel.css";

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void;
}

const THEMES: { id: Theme; label: string; emoji: string }[] = [
  { id: "dark",    label: "Oscuro",  emoji: "🌑" },
  { id: "ocean",   label: "Océano",  emoji: "🌊" },
  { id: "sepia",   label: "Sepia",   emoji: "📜" },
  { id: "dracula", label: "Drácula", emoji: "🦇" },
  { id: "light",   label: "Claro",   emoji: "☀️" },
];

const DENSITIES: { id: Density; label: string; icon: string }[] = [
  { id: "compact",  label: "Compacto",  icon: "⬛⬛⬛" },
  { id: "normal",   label: "Normal",    icon: "⬛ ⬛" },
  { id: "spacious", label: "Espaciado", icon: "⬛  ⬛" },
];

const RADII: { id: BorderRadius; label: string }[] = [
  { id: "sharp",  label: "Cuadrado" },
  { id: "normal", label: "Normal" },
  { id: "round",  label: "Redondeado" },
];

const SOUNDS: { id: Sound; label: string; emoji: string }[] = [
  { id: "none",  label: "Silencio", emoji: "🔇" },
  { id: "pop",   label: "Pop",      emoji: "🫧" },
  { id: "bell",  label: "Campana",  emoji: "🔔" },
  { id: "chime", label: "Chime",    emoji: "🎵" },
];

export default function SettingsPanel({ settings, onUpdate }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button */}
      <button
        className="settings-toggle"
        onClick={() => setOpen((v) => !v)}
        title="Personalización"
        aria-label="Abrir panel de ajustes"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {/* Overlay */}
      {open && <div className="settings-overlay" onClick={() => setOpen(false)} />}

      {/* Sidebar panel */}
      <aside className={`settings-panel ${open ? "open" : ""}`}>
        <div className="sp-header">
          <span>✦ Personalización</span>
          <button className="sp-close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <div className="sp-body">

          {/* TEMAS */}
          <section className="sp-section">
            <h3 className="sp-label">Tema de Color</h3>
            <div className="sp-theme-grid">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={`sp-theme-btn ${settings.theme === t.id ? "active" : ""}`}
                  data-theme={t.id}
                  onClick={() => onUpdate({ theme: t.id })}
                >
                  <span className="sp-theme-dot" data-theme={t.id} />
                  <span>{t.emoji} {t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* DENSIDAD */}
          <section className="sp-section">
            <h3 className="sp-label">Densidad</h3>
            <div className="sp-row">
              {DENSITIES.map((d) => (
                <button
                  key={d.id}
                  className={`sp-chip ${settings.density === d.id ? "active" : ""}`}
                  onClick={() => onUpdate({ density: d.id })}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>

          {/* BORDER RADIUS */}
          <section className="sp-section">
            <h3 className="sp-label">Forma de Tarjetas</h3>
            <div className="sp-row">
              {RADII.map((r) => (
                <button
                  key={r.id}
                  className={`sp-chip ${settings.borderRadius === r.id ? "active" : ""}`}
                  onClick={() => onUpdate({ borderRadius: r.id })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </section>

          {/* TAMAÑO DE FUENTE */}
          <section className="sp-section">
            <h3 className="sp-label">
              Tamaño de Fuente
              <span className="sp-value">{settings.fontSize}px</span>
            </h3>
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={settings.fontSize}
              onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
              className="sp-slider"
            />
            <div className="sp-slider-labels">
              <span>A</span>
              <span style={{ fontSize: "1.3em" }}>A</span>
            </div>
          </section>

          {/* SONIDOS */}
          <section className="sp-section">
            <h3 className="sp-label">Sonido al Completar</h3>
            <div className="sp-sound-grid">
              {SOUNDS.map((s) => (
                <button
                  key={s.id}
                  className={`sp-sound-btn ${settings.sound === s.id ? "active" : ""}`}
                  onClick={() => {
                    onUpdate({ sound: s.id });
                    playCompletionSound(s.id);
                  }}
                >
                  <span className="sp-sound-emoji">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <p className="sp-hint">Haz clic para previsualizar</p>
          </section>

        </div>
      </aside>
    </>
  );
}
