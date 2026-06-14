const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gyoj", {
  runSample: (payload) => ipcRenderer.invoke("run-sample", payload),
  runTests: (payload) => ipcRenderer.invoke("run-tests", payload),
  openSourceFile: () => ipcRenderer.invoke("open-source-file"),
  saveSourceFile: (payload) => ipcRenderer.invoke("save-source-file", payload),
  saveSourceFileAs: (payload) => ipcRenderer.invoke("save-source-file-as", payload),
  importTestZip: () => ipcRenderer.invoke("import-test-zip"),
  getDefaultOjUrl: () => ipcRenderer.invoke("get-default-oj-url"),
  loadOjUrl: (url) => ipcRenderer.invoke("load-oj-url", url),
  unlockExam: (password) => ipcRenderer.invoke("unlock-exam", password),
  onToolsVisible: (handler) => ipcRenderer.on("tools-visible", (_event, visible) => handler(visible)),
  onFocusUrl: (handler) => ipcRenderer.on("focus-url", handler),
  onLockReason: (handler) => ipcRenderer.on("lock-reason", (_event, reason) => handler(reason)),
});
