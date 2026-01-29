const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("captions", {
  onCaption: (cb) => ipcRenderer.on("caption", (_e, text) => cb(text)),
});
