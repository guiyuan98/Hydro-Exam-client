const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gyoj", {
  runSample: (payload) => ipcRenderer.invoke("run-sample", payload),
  getDefaultOjUrl: () => ipcRenderer.invoke("get-default-oj-url"),
  loadOjUrl: (url) => ipcRenderer.invoke("load-oj-url", url),
  unlockExam: (password) => ipcRenderer.invoke("unlock-exam", password),
  onToolsVisible: (handler) => ipcRenderer.on("tools-visible", (_event, visible) => handler(visible)),
  onFocusUrl: (handler) => ipcRenderer.on("focus-url", handler),
  onLockReason: (handler) => ipcRenderer.on("lock-reason", (_event, reason) => handler(reason)),
});
