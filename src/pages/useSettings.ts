import { useEffect, useState } from "react";

export type Theme = "dark" | "ocean" | "sepia" | "dracula" | "light";
export type Density = "compact" | "normal" | "spacious";
export type BorderRadius = "sharp" | "normal" | "round";
export type Sound = "none" | "pop" | "bell" | "chime";

export interface Settings {
  theme: Theme;
  density: Density;
  borderRadius: BorderRadius;
  sound: Sound;
  fontSize: number;
}

const DEFAULTS: Settings = {
  theme: "dark",
  density: "normal",
  borderRadius: "normal",
  sound: "pop",
  fontSize: 15,
};

const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    "--bg": "#0b0d10",
    "--bg2": "#0e1217",
    "--bg3": "#11151a",
    "--border": "#1b2027",
    "--border2": "#2a2f36",
    "--text": "#e7eaee",
    "--text2": "#9aa7b2",
    "--accent": "#1f6feb",
    "--accent2": "#4a81ff",
    "--danger": "#d83a3a",
  },
  ocean: {
    "--bg": "#050e1a",
    "--bg2": "#071525",
    "--bg3": "#0a1e33",
    "--border": "#0d2a45",
    "--border2": "#1a4060",
    "--text": "#d0eaf8",
    "--text2": "#7ab8d8",
    "--accent": "#0095ff",
    "--accent2": "#33b3ff",
    "--danger": "#e05252",
  },
  sepia: {
    "--bg": "#1c1510",
    "--bg2": "#241c14",
    "--bg3": "#2c221a",
    "--border": "#3a2e22",
    "--border2": "#4a3c2c",
    "--text": "#e8d8c0",
    "--text2": "#b09878",
    "--accent": "#c87941",
    "--accent2": "#e8a060",
    "--danger": "#c05050",
  },
  dracula: {
    "--bg": "#0d0e16",
    "--bg2": "#13141f",
    "--bg3": "#191a2e",
    "--border": "#20223a",
    "--border2": "#2e3055",
    "--text": "#f0ecff",
    "--text2": "#9d8fcc",
    "--accent": "#bd93f9",
    "--accent2": "#ff79c6",
    "--danger": "#ff5555",
  },
  light: {
    "--bg": "#f4f6f9",
    "--bg2": "#ffffff",
    "--bg3": "#eef1f5",
    "--border": "#dde3ea",
    "--border2": "#c8d0da",
    "--text": "#1a2030",
    "--text2": "#5a6a7e",
    "--accent": "#1f6feb",
    "--accent2": "#4a81ff",
    "--danger": "#d83a3a",
  },
};

const DENSITIES: Record<Density, Record<string, string>> = {
  compact: {
    "--item-padding": "6px 10px",
    "--item-gap": "4px",
    "--font-size-item": "13px",
  },
  normal: {
    "--item-padding": "10px 12px",
    "--item-gap": "8px",
    "--font-size-item": "15px",
  },
  spacious: {
    "--item-padding": "16px 18px",
    "--item-gap": "14px",
    "--font-size-item": "16px",
  },
};

const RADII: Record<BorderRadius, string> = {
  sharp: "4px",
  normal: "12px",
  round: "20px",
};

function applySettings(s: Settings) {
  const root = document.documentElement;
  Object.entries(THEMES[s.theme]).forEach(([k, v]) => root.style.setProperty(k, v));
  Object.entries(DENSITIES[s.density]).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.setProperty("--radius", RADII[s.borderRadius]);
  root.style.setProperty("--base-font-size", `${s.fontSize}px`);
}

// Simple audio synthesis for sounds
export function playCompletionSound(sound: Sound) {
  if (sound === "none") return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (sound === "pop") {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else if (sound === "bell") {
      [0, 0.05, 0.1].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880 + i * 220, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.5);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.5);
      });
    } else if (sound === "chime") {
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
    }
  } catch {}
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem("app-settings");
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    applySettings(settings);
    localStorage.setItem("app-settings", JSON.stringify(settings));
  }, [settings]);

  function updateSettings(patch: Partial<Settings>) {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }

  return { settings, updateSettings };
}