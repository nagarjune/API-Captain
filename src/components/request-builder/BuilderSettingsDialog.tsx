import { useEffect, useMemo, useState } from "react";
import {
  Bolt,
  Eye,
  Gauge,
  Github,
  Globe,
  Info,
  KeyRound,
  Keyboard,
  Moon,
  Palette,
  Shield,
  Sun,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useDesktopUpdates } from "@/hooks/useDesktopUpdates";
import {
  applyBuilderTheme,
  BuilderSettings,
  DARK_PRESETS,
  getStoredBuilderSettings,
  LIGHT_PRESETS,
  saveBuilderSettings,
} from "@/lib/builderTheme";

interface BuilderSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const sections = [
  { id: "general", label: "General", icon: Wrench },
  { id: "themes", label: "Themes", icon: Palette },
  { id: "display", label: "Display", icon: Eye },
  { id: "proxy", label: "Proxy", icon: Globe },
  { id: "license", label: "License", icon: Shield },
  { id: "features", label: "Features", icon: Bolt },
  { id: "secrets", label: "Secrets Manager", icon: KeyRound },
  { id: "keybindings", label: "Keybindings", icon: Keyboard },
  { id: "support", label: "Support", icon: Shield },
  { id: "beta", label: "Beta", icon: Gauge },
  { id: "about", label: "About", icon: Globe },
] as const;

const APP_VERSION = "v0.0.3";

type OsType = "mac" | "windows" | "linux" | "other";

const detectOs = (): OsType => {
  if (typeof navigator === "undefined") return "other";
  const platform = navigator.platform?.toLowerCase() || "";
  const userAgent = navigator.userAgent?.toLowerCase() || "";
  if (platform.includes("mac") || userAgent.includes("mac os")) return "mac";
  if (platform.includes("win") || userAgent.includes("windows")) return "windows";
  if (platform.includes("linux") || userAgent.includes("linux")) return "linux";
  return "other";
};

const appDataPathByOs = (os: OsType): string => {
  if (os === "mac") return "~/Library/Application Support/API Captain";
  if (os === "windows") return "%APPDATA%\\API Captain";
  if (os === "linux") return "~/.config/api-captain";
  return "~/.api-captain";
};

const primaryModifier = (os: OsType) => (os === "mac" ? "command" : "ctrl");

const keybindingRows = (os: OsType): Array<{ command: string; keys: string[] }> => {
  const mod = primaryModifier(os);
  return [
    { command: "Save", keys: [mod, "s"] },
    { command: "Send Request", keys: [mod, "enter"] },
    { command: "Edit Environment", keys: [mod, "e"] },
    { command: "New Request", keys: [mod, "b"] },
    { command: "Global Search", keys: [mod, "k"] },
    { command: "Close Tab", keys: [mod, "w"] },
    { command: "Open Preferences", keys: [mod, ","] },
    { command: "Close API Captain", keys: [mod, "q"] },
    { command: "Switch to Previous Tab", keys: [mod, "pageup"] },
    { command: "Switch to Next Tab", keys: [mod, "pagedown"] },
    { command: "Move Tab Left", keys: [mod, "shift", "pageup"] },
    { command: "Move Tab Right", keys: [mod, "shift", "pagedown"] },
    { command: "Close All Tabs", keys: [mod, "shift", "w"] },
    { command: "Collapse Sidebar", keys: [mod, "\\"] },
    { command: "Zoom In", keys: [mod, "="] },
    { command: "Zoom Out", keys: [mod, "-"] },
    { command: "Reset Zoom", keys: [mod, "0"] },
  ];
};

export function BuilderSettingsDialog({ open, onOpenChange }: BuilderSettingsDialogProps) {
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("themes");
  const [settings, setSettings] = useState<BuilderSettings>(() => getStoredBuilderSettings());
  const operatingSystem = useMemo(() => detectOs(), []);
  const { state: updateState, isDesktopSupported, setAutoUpdateEnabled, checkNow } = useDesktopUpdates();

  useEffect(() => {
    applyBuilderTheme(settings);
    saveBuilderSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (settings.mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyBuilderTheme(settings);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [settings]);

  useEffect(() => {
    if (!isDesktopSupported) return;
    setSettings((previous) =>
      previous.autoUpdates === updateState.autoUpdateEnabled
        ? previous
        : { ...previous, autoUpdates: updateState.autoUpdateEnabled }
    );
  }, [isDesktopSupported, updateState.autoUpdateEnabled]);

  const selectedLightTheme = useMemo(
    () => LIGHT_PRESETS.find((item) => item.id === settings.lightTheme) ?? LIGHT_PRESETS[0],
    [settings.lightTheme]
  );
  const selectedDarkTheme = useMemo(
    () => DARK_PRESETS.find((item) => item.id === settings.darkTheme) ?? DARK_PRESETS[0],
    [settings.darkTheme]
  );
  const shouldShowLightThemes = settings.mode === "light" || settings.mode === "system";
  const shouldShowDarkThemes = settings.mode === "dark" || settings.mode === "system";
  const showThemeDivider = shouldShowLightThemes && shouldShowDarkThemes;
  const bindingRows = useMemo(() => keybindingRows(operatingSystem), [operatingSystem]);
  const osLabel = operatingSystem === "mac" ? "macOS" : operatingSystem === "windows" ? "Windows" : operatingSystem === "linux" ? "Linux" : "Current OS";
  const appDataPath = useMemo(() => appDataPathByOs(operatingSystem), [operatingSystem]);
  const displayVersion = updateState.currentVersion ? `v${updateState.currentVersion}` : APP_VERSION;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[90vh] p-0 overflow-hidden">
        <div className="grid h-full grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-r border-border bg-secondary/20 p-3">
            <div className="font-medium px-2 py-1.5">Preferences</div>
            <div className="mt-2 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-left transition-colors",
                      activeSection === section.id
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="h-full min-h-0">
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle className="text-base">
                {sections.find((section) => section.id === activeSection)?.label || "Preferences"}
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="h-[calc(90vh-73px)]">
              <div className="px-6 py-5 space-y-6">
                {activeSection === "general" && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="font-medium">General Preferences</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Compact control density</p>
                      <Switch
                        checked={settings.compactDensity}
                        onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, compactDensity: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Usage telemetry</p>
                      <Switch
                        checked={settings.usageTelemetry}
                        onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, usageTelemetry: checked }))}
                      />
                    </div>
                  </div>
                )}

                {activeSection === "themes" && (
                  <>
                    <div className="space-y-3">
                      <h3 className="font-medium">Appearance Mode</h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={settings.mode === "light" ? "default" : "outline"}
                          size="sm"
                          className="gap-2"
                          onClick={() => setSettings((prev) => ({ ...prev, mode: "light" }))}
                        >
                          <Sun className="h-4 w-4" />
                          Light
                        </Button>
                        <Button
                          variant={settings.mode === "dark" ? "default" : "outline"}
                          size="sm"
                          className="gap-2"
                          onClick={() => setSettings((prev) => ({ ...prev, mode: "dark" }))}
                        >
                          <Moon className="h-4 w-4" />
                          Dark
                        </Button>
                        <Button
                          variant={settings.mode === "system" ? "default" : "outline"}
                          size="sm"
                          className="gap-2"
                          onClick={() => setSettings((prev) => ({ ...prev, mode: "system" }))}
                        >
                          <Globe className="h-4 w-4" />
                          System
                        </Button>
                      </div>
                    </div>

                    {(shouldShowLightThemes || shouldShowDarkThemes) && <Separator />}

                    {shouldShowLightThemes && (
                      <div className="space-y-3">
                        <h3 className="font-medium">Light Themes</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                          {LIGHT_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => setSettings((prev) => ({ ...prev, lightTheme: preset.id }))}
                              className={cn(
                                "rounded-lg border p-3 text-left transition-colors",
                                selectedLightTheme.id === preset.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-card hover:border-primary/50"
                              )}
                            >
                              <div className="rounded-md border border-border/60 p-2 bg-background mb-2">
                                <div className="space-y-1">
                                  <div className="h-1.5 rounded" style={{ background: preset.colors[0] }} />
                                  <div className="h-1.5 rounded" style={{ background: preset.colors[1] }} />
                                  <div className="h-1.5 rounded" style={{ background: preset.colors[2] }} />
                                </div>
                              </div>
                              <p className="text-xs font-medium">{preset.label}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showThemeDivider && <Separator />}

                    {shouldShowDarkThemes && (
                      <div className="space-y-3">
                        <h3 className="font-medium">Dark Themes</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                          {DARK_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => setSettings((prev) => ({ ...prev, darkTheme: preset.id }))}
                              className={cn(
                                "rounded-lg border p-3 text-left transition-colors",
                                selectedDarkTheme.id === preset.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-card hover:border-primary/50"
                              )}
                            >
                              <div className="rounded-md border border-border/60 p-2 bg-secondary mb-2">
                                <div className="space-y-1">
                                  <div className="h-1.5 rounded" style={{ background: preset.colors[0] }} />
                                  <div className="h-1.5 rounded" style={{ background: preset.colors[1] }} />
                                  <div className="h-1.5 rounded" style={{ background: preset.colors[2] }} />
                                </div>
                              </div>
                              <p className="text-xs font-medium">{preset.label}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeSection === "display" && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="font-medium">Display</h3>
                    <div className="space-y-2">
                      <label className="text-sm text-muted-foreground">Font Scale ({settings.fontScale}%)</label>
                      <input
                        type="range"
                        min={85}
                        max={120}
                        step={1}
                        value={settings.fontScale}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, fontScale: Number(event.target.value) }))
                        }
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {activeSection === "proxy" && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="font-medium">Proxy</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Enable proxy</p>
                      <Switch
                        checked={settings.enableProxy}
                        onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableProxy: checked }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Proxy Host</label>
                        <Input
                          placeholder="proxy.company.com"
                          value={settings.proxyHost}
                          onChange={(event) => setSettings((prev) => ({ ...prev, proxyHost: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Proxy Port</label>
                        <Input
                          placeholder="8080"
                          value={settings.proxyPort}
                          onChange={(event) => setSettings((prev) => ({ ...prev, proxyPort: event.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "features" && (
                  <div className="rounded-lg border border-border p-4 space-y-5">
                    <div className="space-y-1">
                      <h3 className="font-medium tracking-[0.14em] text-xs uppercase text-muted-foreground">Features</h3>
                      <p className="text-sm text-muted-foreground">Turn on/off additional features.</p>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={settings.featureApiSpec}
                          onCheckedChange={(checked) =>
                            setSettings((prev) => ({ ...prev, featureApiSpec: Boolean(checked) }))
                          }
                        />
                        <span>API Spec</span>
                      </label>

                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={settings.featureGit}
                          onCheckedChange={(checked) =>
                            setSettings((prev) => ({ ...prev, featureGit: Boolean(checked) }))
                          }
                        />
                        <span>Git</span>
                      </label>

                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={settings.featureFileExplorer}
                          onCheckedChange={(checked) =>
                            setSettings((prev) => ({ ...prev, featureFileExplorer: Boolean(checked) }))
                          }
                        />
                        <span>File Explorer</span>
                      </label>

                      <label className="flex items-center gap-3 text-sm cursor-pointer">
                        <Checkbox
                          checked={settings.featureShowApiCaptainJson}
                          onCheckedChange={(checked) =>
                            setSettings((prev) => ({ ...prev, featureShowApiCaptainJson: Boolean(checked) }))
                          }
                        />
                        <span>Show apicaptain.json</span>
                      </label>
                    </div>
                  </div>
                )}

                {activeSection === "secrets" && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="font-medium">Secrets Manager</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Enable secure secrets manager</p>
                      <Switch
                        checked={settings.secureSecrets}
                        onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, secureSecrets: checked }))}
                      />
                    </div>
                  </div>
                )}

                {activeSection === "beta" && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="font-medium">Beta</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Enable beta features</p>
                      <Switch
                        checked={settings.enableBeta}
                        onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableBeta: checked }))}
                      />
                    </div>
                  </div>
                )}

                {activeSection === "license" && (
                  <div className="rounded-lg border border-border p-4 space-y-2">
                    <h3 className="font-medium">{sections.find((section) => section.id === activeSection)?.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Settings for this section are ready for integration. Current preferences are persisted locally.
                    </p>
                  </div>
                )}

                {activeSection === "support" && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <h3 className="font-medium">Support</h3>
                    <a
                      href="https://github.com/nagarjune/API-Captain"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                    >
                      <Github className="h-4 w-4" />
                      GitHub
                    </a>
                  </div>
                )}

                {activeSection === "keybindings" && (
                  <div className="rounded-lg border border-border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Keybindings</h3>
                      <span className="text-xs text-muted-foreground">{osLabel}</span>
                    </div>
                    <div className="overflow-hidden rounded-md border border-border">
                      <table className="w-full text-sm">
                        <thead className="bg-secondary/40">
                          <tr>
                            <th className="text-left font-medium px-3 py-2">Command</th>
                            <th className="text-left font-medium px-3 py-2">Keybinding</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bindingRows.map((row) => (
                            <tr key={row.command} className="border-t border-border">
                              <td className="px-3 py-2">{row.command}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {row.keys.map((key, index) => (
                                    <span
                                      key={`${row.command}-${key}-${index}`}
                                      className="inline-flex items-center rounded-md border border-border bg-background/60 px-2 py-0.5 text-xs font-mono"
                                    >
                                      {key}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeSection === "about" && (
                  <div className="rounded-lg border border-border p-4 space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <h3 className="font-medium text-foreground">About</h3>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-2 text-sm">
                        <p className="text-muted-foreground">Version</p>
                        <div>
                          <span className="inline-flex items-center rounded-md border border-border bg-secondary/40 px-2 py-0.5 font-mono text-xs">
                            {displayVersion}
                          </span>
                        </div>
                        <p className="text-muted-foreground">AppData Path</p>
                        <p className="font-mono text-xs break-all">{appDataPath}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium">Software Updates</h4>
                      <div className="rounded-md border border-border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">Automatically download and install updates.</p>
                          <Switch
                            checked={settings.autoUpdates}
                            onCheckedChange={(checked) => {
                              setSettings((prev) => ({ ...prev, autoUpdates: checked }));
                              void setAutoUpdateEnabled(checked);
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {isDesktopSupported
                              ? updateState.status === "checking"
                                ? "Checking for updates..."
                                : updateState.updateAvailable
                                ? `New version available${updateState.latestVersion ? `: v${updateState.latestVersion}` : ""}.`
                                : updateState.status === "error" && updateState.errorMessage
                                ? updateState.errorMessage
                                : "No new updates found."
                              : "Desktop updater is available in packaged desktop builds."}
                          </p>
                          {isDesktopSupported && (
                            <Button variant="outline" size="sm" onClick={() => void checkNow()}>
                              Check now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
