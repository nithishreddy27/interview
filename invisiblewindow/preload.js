// const { contextBridge, ipcRenderer } = require("electron");

// contextBridge.exposeInMainWorld("captions", {
//   onCaption: (cb) => ipcRenderer.on("caption", (_e, text) => cb(text)),
// });

// const { contextBridge, ipcRenderer } = require("electron");

// contextBridge.exposeInMainWorld("captions", {
//   onCaption: (cb) => ipcRenderer.on("caption", (_e, text) => cb(text)),
// });

// contextBridge.exposeInMainWorld("llm", {
//   ask: (payload) => ipcRenderer.invoke("llm:ask", payload),
//   cancel: (blockId) => ipcRenderer.invoke("llm:cancel", { blockId }),

//   onDelta: (cb) => ipcRenderer.on("llm:delta", (_e, data) => cb(data)),
//   onDone: (cb) => ipcRenderer.on("llm:done", (_e, data) => cb(data)),
//   onError: (cb) => ipcRenderer.on("llm:error", (_e, data) => cb(data)),
// });

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("captions", {
  onCaption: (cb) => ipcRenderer.on("caption", (_e, text) => cb(text)),
});

contextBridge.exposeInMainWorld("llm", {
  ask: (payload) => ipcRenderer.invoke("llm:ask", payload),
  askWithImages: (payload) => ipcRenderer.invoke("llm:ask_images", payload), // NEW
  cancel: (blockId) => ipcRenderer.invoke("llm:cancel", { blockId }),

  onDelta: (cb) => ipcRenderer.on("llm:delta", (_e, data) => cb(data)),
  onDone: (cb) => ipcRenderer.on("llm:done", (_e, data) => cb(data)),
  onError: (cb) => ipcRenderer.on("llm:error", (_e, data) => cb(data)),
});

// NEW: screen capture bridge
// contextBridge.exposeInMainWorld("screenCap", {
//   getSources: () => ipcRenderer.invoke("cap:getSources"),
//   captureFrame: (sourceId) =>
//     ipcRenderer.invoke("cap:captureFrame", { sourceId }),
// });

contextBridge.exposeInMainWorld("screenCap", {
  getSources: () => ipcRenderer.invoke("cap:getSources"),
  captureFrame: (sourceId) =>
    ipcRenderer.invoke("cap:captureFrame", { sourceId }),
});
