import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPDATE_CHANNEL = "desktop:update-status";
const UPDATE_PREFS_FILE = () => path.join(app.getPath("userData"), "update-preferences.json");
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const GITHUB_RELEASES_API = "https://api.github.com/repos/nagarjune/API-Captain/releases/latest";

const updateState = {
  supported: app.isPackaged,
  status: "idle",
  currentVersion: app.getVersion(),
  latestVersion: null,
  updateAvailable: false,
  autoUpdateEnabled: true,
  errorMessage: null,
};

let updateCheckTimer = null;

const resolvePreloadPath = () => {
  const jsPath = path.join(__dirname, "preload.js");
  if (fs.existsSync(jsPath)) return jsPath;
  return path.join(__dirname, "preload.ts");
};

const readAutoUpdatePreference = () => {
  try {
    const raw = fs.readFileSync(UPDATE_PREFS_FILE(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed?.autoUpdateEnabled !== false;
  } catch {
    return true;
  }
};

const saveAutoUpdatePreference = (enabled) => {
  try {
    fs.mkdirSync(path.dirname(UPDATE_PREFS_FILE()), { recursive: true });
    fs.writeFileSync(
      UPDATE_PREFS_FILE(),
      JSON.stringify({ autoUpdateEnabled: enabled }, null, 2),
      "utf8"
    );
  } catch {
    // Ignore local preference persistence errors.
  }
};

const broadcastUpdateState = () => {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send(UPDATE_CHANNEL, { ...updateState });
  });
};

const setUpdateState = (nextState) => {
  Object.assign(updateState, nextState);
  broadcastUpdateState();
};

const normalizeVersion = (value) =>
  String(value || "")
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .split("+")[0];

const compareVersions = (left, right) => {
  const leftParts = normalizeVersion(left)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = normalizeVersion(right)
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const maxLen = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLen; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }
  return 0;
};

const checkGitHubReleaseUpdates = async () => {
  try {
    setUpdateState({
      status: "checking",
      errorMessage: null,
    });
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      throw new Error(`GitHub update check failed (${response.status}).`);
    }

    const payload = await response.json();
    const latestVersion = normalizeVersion(payload?.tag_name || payload?.name || "");
    const currentVersion = normalizeVersion(app.getVersion());
    const updateAvailable = latestVersion
      ? compareVersions(latestVersion, currentVersion) > 0
      : false;

    setUpdateState({
      latestVersion: latestVersion || null,
      updateAvailable,
      status: updateAvailable ? "available" : "not-available",
      errorMessage: null,
    });
  } catch (error) {
    setUpdateState({
      status: "error",
      errorMessage: error instanceof Error ? error.message : "GitHub update check failed.",
    });
  }
  return { ...updateState };
};

const checkForAppUpdates = async () => {
  if (!app.isPackaged) {
    return checkGitHubReleaseUpdates();
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    await checkGitHubReleaseUpdates();
  }
  return { ...updateState };
};

const registerUpdateIpc = () => {
  ipcMain.handle("desktop:update:get-state", async () => ({ ...updateState }));
  ipcMain.handle("desktop:update:check-now", async () => checkForAppUpdates());
  ipcMain.handle("desktop:update:set-auto-enabled", async (_event, enabled) => {
    const autoUpdateEnabled = Boolean(enabled);
    saveAutoUpdatePreference(autoUpdateEnabled);
    setUpdateState({
      autoUpdateEnabled,
      errorMessage: null,
    });

    if (app.isPackaged) {
      autoUpdater.autoDownload = autoUpdateEnabled;
      await checkForAppUpdates();
    }

    return { ...updateState };
  });
};

const configureAutoUpdater = () => {
  const autoUpdateEnabled = readAutoUpdatePreference();
  setUpdateState({
    autoUpdateEnabled,
    currentVersion: app.getVersion(),
    supported: app.isPackaged,
  });

  if (!app.isPackaged) return;

  autoUpdater.autoDownload = autoUpdateEnabled;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    setUpdateState({
      status: "checking",
      errorMessage: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    setUpdateState({
      status: "available",
      latestVersion: info?.version || null,
      updateAvailable: true,
      errorMessage: null,
    });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateState({
      status: "not-available",
      latestVersion: null,
      updateAvailable: false,
      errorMessage: null,
    });
  });

  autoUpdater.on("download-progress", () => {
    setUpdateState({ status: "downloading" });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState({
      status: "downloaded",
      latestVersion: info?.version || updateState.latestVersion,
      updateAvailable: true,
      errorMessage: null,
    });

    if (updateState.autoUpdateEnabled) {
      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
      }, 1200);
    }
  });

  autoUpdater.on("error", (error) => {
    setUpdateState({
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Updater error.",
    });
  });

  void checkForAppUpdates();
  updateCheckTimer = setInterval(() => {
    void checkForAppUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 850,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    // DEV
    win.loadURL("http://localhost:8080");
  } else {
    // ✅ PROD — load from app root (asar-safe)
    const appPath = app.getAppPath();
    const indexHtml = path.join(appPath, "dist", "index.html");
    win.loadFile(indexHtml);
  }
}

app.whenReady().then(() => {
  registerUpdateIpc();
  configureAutoUpdater();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
});
