export type ThemeMode = "light" | "dark" | "system";

export interface BuilderSettings {
  mode: ThemeMode;
  lightTheme: string;
  darkTheme: string;
  autoUpdates: boolean;
  fontScale: number;
  compactDensity: boolean;
  enableProxy: boolean;
  proxyHost: string;
  proxyPort: string;
  enableBeta: boolean;
  usageTelemetry: boolean;
  secureSecrets: boolean;
}

export interface ThemePreset {
  id: string;
  label: string;
  colors: [string, string, string];
  vars: Record<string, string>;
}

export const BUILDER_THEME_STORAGE_KEY = "api-captain-builder-preferences-v1";

const LIGHT_BASE: Record<string, string> = {
  "--background": "0 0% 98%",
  "--foreground": "222 47% 10%",
  "--card": "0 0% 100%",
  "--card-foreground": "222 47% 10%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "222 47% 10%",
  "--primary": "38 92% 45%",
  "--primary-foreground": "222 47% 8%",
  "--secondary": "220 16% 94%",
  "--secondary-foreground": "222 47% 12%",
  "--muted": "220 16% 92%",
  "--muted-foreground": "218 14% 40%",
  "--accent": "38 92% 45%",
  "--accent-foreground": "222 47% 8%",
  "--destructive": "0 72% 51%",
  "--destructive-foreground": "210 40% 98%",
  "--success": "142 56% 35%",
  "--success-foreground": "210 40% 98%",
  "--warning": "38 92% 45%",
  "--warning-foreground": "222 47% 8%",
  "--info": "199 72% 46%",
  "--info-foreground": "210 40% 98%",
  "--border": "220 14% 88%",
  "--input": "220 16% 94%",
  "--ring": "38 92% 45%",
  "--editor-background": "210 35% 96%",
  "--editor-foreground": "222 47% 12%",
  "--editor-border": "220 18% 84%",
  "--sidebar-background": "0 0% 100%",
  "--sidebar-foreground": "222 47% 10%",
  "--sidebar-primary": "38 92% 45%",
  "--sidebar-primary-foreground": "222 47% 8%",
  "--sidebar-accent": "220 16% 94%",
  "--sidebar-accent-foreground": "222 47% 10%",
  "--sidebar-border": "220 14% 88%",
  "--sidebar-ring": "38 92% 45%",
};

const DARK_BASE: Record<string, string> = {
  "--background": "222 47% 6%",
  "--foreground": "210 40% 98%",
  "--card": "222 47% 8%",
  "--card-foreground": "210 40% 98%",
  "--popover": "222 47% 8%",
  "--popover-foreground": "210 40% 98%",
  "--primary": "38 92% 50%",
  "--primary-foreground": "222 47% 6%",
  "--secondary": "222 30% 14%",
  "--secondary-foreground": "210 40% 98%",
  "--muted": "222 30% 18%",
  "--muted-foreground": "215 20% 55%",
  "--accent": "38 92% 50%",
  "--accent-foreground": "222 47% 6%",
  "--destructive": "0 72% 51%",
  "--destructive-foreground": "210 40% 98%",
  "--success": "142 76% 36%",
  "--success-foreground": "210 40% 98%",
  "--warning": "38 92% 50%",
  "--warning-foreground": "222 47% 6%",
  "--info": "199 89% 48%",
  "--info-foreground": "210 40% 98%",
  "--border": "222 30% 18%",
  "--input": "222 30% 14%",
  "--ring": "38 92% 50%",
  "--editor-background": "212 58% 10%",
  "--editor-foreground": "210 40% 96%",
  "--editor-border": "222 30% 20%",
  "--sidebar-background": "222 47% 8%",
  "--sidebar-foreground": "210 40% 98%",
  "--sidebar-primary": "38 92% 50%",
  "--sidebar-primary-foreground": "222 47% 6%",
  "--sidebar-accent": "222 30% 14%",
  "--sidebar-accent-foreground": "210 40% 98%",
  "--sidebar-border": "222 30% 18%",
  "--sidebar-ring": "38 92% 50%",
};

export const LIGHT_PRESETS: ThemePreset[] = [
  {
    id: "light",
    label: "Light",
    colors: ["#d0a168", "#e6d6c5", "#ffffff"],
    vars: {},
  },
  {
    id: "light-monochrome",
    label: "Light Monochrome",
    colors: ["#777", "#d7d7d7", "#ffffff"],
    vars: {
      "--primary": "221 5% 35%",
      "--primary-foreground": "0 0% 98%",
      "--accent": "221 5% 35%",
      "--accent-foreground": "0 0% 98%",
      "--warning": "221 5% 35%",
      "--ring": "221 5% 35%",
    },
  },
  {
    id: "light-pastel",
    label: "Light Pastel",
    colors: ["#d99aa5", "#f3dce0", "#fff8f8"],
    vars: {
      "--primary": "349 54% 70%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "349 54% 70%",
      "--accent-foreground": "0 0% 100%",
      "--warning": "349 54% 70%",
      "--ring": "349 54% 70%",
    },
  },
  {
    id: "cappuccino-latte",
    label: "Cappuccino Latte",
    colors: ["#b78450", "#efe2d2", "#fffaf2"],
    vars: {
      "--background": "34 45% 95%",
      "--secondary": "34 30% 89%",
      "--muted": "34 28% 86%",
      "--primary": "32 43% 50%",
      "--primary-foreground": "34 60% 98%",
      "--accent": "32 43% 50%",
      "--accent-foreground": "34 60% 98%",
      "--border": "34 24% 82%",
      "--ring": "32 43% 50%",
    },
  },
  {
    id: "vs-code-light",
    label: "VS Code Light",
    colors: ["#4f8fd6", "#dce8f6", "#f8fbff"],
    vars: {
      "--primary": "208 63% 57%",
      "--primary-foreground": "210 100% 99%",
      "--accent": "208 63% 57%",
      "--accent-foreground": "210 100% 99%",
      "--background": "210 60% 98%",
      "--secondary": "210 42% 93%",
      "--muted": "210 32% 90%",
      "--border": "210 26% 84%",
      "--ring": "208 63% 57%",
    },
  },
];

export const DARK_PRESETS: ThemePreset[] = [
  {
    id: "dark",
    label: "Dark",
    colors: ["#d0a168", "#1b212e", "#0a0f17"],
    vars: {},
  },
  {
    id: "dark-monochrome",
    label: "Dark Monochrome",
    colors: ["#9fa3ab", "#272b31", "#13161b"],
    vars: {
      "--primary": "220 8% 62%",
      "--accent": "220 8% 62%",
      "--warning": "220 8% 62%",
      "--ring": "220 8% 62%",
    },
  },
  {
    id: "dark-pastel",
    label: "Dark Pastel",
    colors: ["#b489c5", "#2a2236", "#16121f"],
    vars: {
      "--primary": "279 33% 66%",
      "--primary-foreground": "262 32% 12%",
      "--accent": "279 33% 66%",
      "--accent-foreground": "262 32% 12%",
      "--background": "267 28% 10%",
      "--card": "267 22% 13%",
      "--secondary": "267 18% 18%",
      "--border": "267 16% 22%",
      "--ring": "279 33% 66%",
    },
  },
  {
    id: "cappuccino-mocha",
    label: "Cappuccino Mocha",
    colors: ["#bb8c68", "#241b17", "#14100d"],
    vars: {
      "--primary": "24 40% 58%",
      "--primary-foreground": "24 34% 12%",
      "--accent": "24 40% 58%",
      "--accent-foreground": "24 34% 12%",
      "--background": "26 24% 8%",
      "--card": "26 20% 11%",
      "--secondary": "26 16% 16%",
      "--border": "26 14% 22%",
      "--ring": "24 40% 58%",
    },
  },
  {
    id: "nord",
    label: "Nord",
    colors: ["#88c0d0", "#2e3440", "#222833"],
    vars: {
      "--primary": "192 43% 67%",
      "--primary-foreground": "220 33% 14%",
      "--accent": "192 43% 67%",
      "--accent-foreground": "220 33% 14%",
      "--background": "220 22% 14%",
      "--card": "220 19% 18%",
      "--secondary": "220 16% 23%",
      "--border": "220 12% 30%",
      "--ring": "192 43% 67%",
    },
  },
  {
    id: "vs-code-dark",
    label: "VS Code Dark",
    colors: ["#4fc1ff", "#1f2430", "#11151f"],
    vars: {
      "--primary": "202 100% 66%",
      "--primary-foreground": "223 30% 9%",
      "--accent": "202 100% 66%",
      "--accent-foreground": "223 30% 9%",
      "--background": "223 31% 9%",
      "--card": "223 27% 12%",
      "--secondary": "223 20% 17%",
      "--border": "223 15% 23%",
      "--ring": "202 100% 66%",
    },
  },
];

export const DEFAULT_BUILDER_SETTINGS: BuilderSettings = {
  mode: "dark",
  lightTheme: "light",
  darkTheme: "dark",
  autoUpdates: true,
  fontScale: 100,
  compactDensity: false,
  enableProxy: false,
  proxyHost: "",
  proxyPort: "8080",
  enableBeta: false,
  usageTelemetry: false,
  secureSecrets: true,
};

const normalizeMergedTheme = (mode: "light" | "dark", merged: Record<string, string>) => {
  if (!merged["--card"]) merged["--card"] = merged["--background"];
  if (!merged["--card-foreground"]) merged["--card-foreground"] = merged["--foreground"];
  if (!merged["--popover"]) merged["--popover"] = merged["--card"];
  if (!merged["--popover-foreground"]) merged["--popover-foreground"] = merged["--card-foreground"];
  if (!merged["--sidebar-background"]) merged["--sidebar-background"] = merged["--card"];
  if (!merged["--sidebar-foreground"]) merged["--sidebar-foreground"] = merged["--foreground"];
  if (!merged["--sidebar-primary"]) merged["--sidebar-primary"] = merged["--primary"];
  if (!merged["--sidebar-primary-foreground"]) merged["--sidebar-primary-foreground"] = merged["--primary-foreground"];
  if (!merged["--sidebar-accent"]) merged["--sidebar-accent"] = merged["--secondary"];
  if (!merged["--sidebar-accent-foreground"]) merged["--sidebar-accent-foreground"] = merged["--secondary-foreground"];
  if (!merged["--sidebar-border"]) merged["--sidebar-border"] = merged["--border"];
  if (!merged["--sidebar-ring"]) merged["--sidebar-ring"] = merged["--ring"];
  if (!merged["--editor-background"]) merged["--editor-background"] = mode === "dark" ? "212 58% 10%" : "210 35% 96%";
  if (!merged["--editor-foreground"]) merged["--editor-foreground"] = mode === "dark" ? "210 40% 96%" : "222 47% 12%";
  if (!merged["--editor-border"]) merged["--editor-border"] = mode === "dark" ? "222 30% 20%" : "220 18% 84%";
};

const getActiveMode = (mode: ThemeMode): "light" | "dark" => {
  if (mode !== "system") {
    return mode;
  }
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const getStoredBuilderSettings = (): BuilderSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_BUILDER_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(BUILDER_THEME_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_BUILDER_SETTINGS;
    }
    return {
      ...DEFAULT_BUILDER_SETTINGS,
      ...(JSON.parse(raw) as Partial<BuilderSettings>),
    };
  } catch {
    return DEFAULT_BUILDER_SETTINGS;
  }
};

export const saveBuilderSettings = (settings: BuilderSettings): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(BUILDER_THEME_STORAGE_KEY, JSON.stringify(settings));
};

export const applyBuilderTheme = (settings: BuilderSettings): void => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const mode = getActiveMode(settings.mode);
  root.classList.toggle("dark", mode === "dark");

  const baseVars = mode === "dark" ? DARK_BASE : LIGHT_BASE;
  const presetId = mode === "dark" ? settings.darkTheme : settings.lightTheme;
  const preset = (mode === "dark" ? DARK_PRESETS : LIGHT_PRESETS).find((item) => item.id === presetId);
  const merged = { ...baseVars, ...(preset?.vars || {}) } as Record<string, string>;

  normalizeMergedTheme(mode, merged);

  const primary = merged["--primary"];
  const accent = merged["--accent"] || primary;
  const card = merged["--card"];
  const background = merged["--background"];
  const secondary = merged["--secondary"];

  merged["--glow-primary"] = `0 0 40px hsl(${primary} / 0.3)`;
  merged["--glow-primary-strong"] = `0 0 60px hsl(${primary} / 0.5)`;
  merged["--glow-accent"] = `0 0 60px hsl(${accent} / 0.15)`;
  merged["--gradient-hero"] = `linear-gradient(135deg, hsl(${card}) 0%, hsl(${background}) 100%)`;
  merged["--gradient-card"] = `linear-gradient(180deg, hsl(${secondary}) 0%, hsl(${card}) 100%)`;
  merged["--gradient-gold"] = `linear-gradient(135deg, hsl(${primary}) 0%, hsl(${accent}) 100%)`;
  merged["--gradient-text"] = `linear-gradient(135deg, hsl(${primary}) 0%, hsl(${accent}) 100%)`;

  Object.entries(merged).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  root.style.fontSize = `${settings.fontScale}%`;
};
