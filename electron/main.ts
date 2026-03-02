import { app, BrowserWindow } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 850
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

app.whenReady().then(createWindow);
