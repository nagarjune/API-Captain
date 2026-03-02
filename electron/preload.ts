import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  version: process.versions.electron
});
