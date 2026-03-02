import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  version: process.versions.electron,
  updates: {
    getState: () => ipcRenderer.invoke("desktop:update:get-state"),
    checkNow: () => ipcRenderer.invoke("desktop:update:check-now"),
    setAutoUpdateEnabled: (enabled) => ipcRenderer.invoke("desktop:update:set-auto-enabled", enabled),
    onStatus: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("desktop:update-status", listener);
      return () => {
        ipcRenderer.removeListener("desktop:update-status", listener);
      };
    },
  },
});
