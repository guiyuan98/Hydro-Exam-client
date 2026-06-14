const { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, session } = require("electron");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const configPath = path.join(rootDir, "gyoj-shell.json");

function loadConfig() {
  const fallback = {
    serverBaseUrl: "http://localhost",
    compilerPath: "tools/mingw/bin/g++.exe",
    localRunTimeoutMs: 3000,
    language: "zh-CN",
    editor: {
      autoOpen: true,
    },
    proctor: {
      enabled: true,
      teacherUnlockPassword: "CHANGE_ME_TEACHER_UNLOCK_PASSWORD",
      clearClipboard: true,
      lockOnBlur: true,
      terminateBlacklistedProcesses: true,
      processBlacklist: [
        "chrome.exe",
        "msedge.exe",
        "firefox.exe",
        "wechat.exe",
        "qq.exe",
        "devenv.exe",
        "code.exe",
        "devcpp.exe",
        "teamviewer.exe",
        "anydesk.exe",
      ],
    },
  };
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(configPath, "utf8")) };
  } catch {
    return fallback;
  }
}

const config = loadConfig();
let mainWindow;
let toolsWindow;
let lockWindow;
let toolsVisible = false;
let locked = false;
let clipboardTimer;
let processTimer;
let appQuitting = false;
const terminatedProcessNames = new Set();

app.commandLine.appendSwitch("lang", config.language || "zh-CN");

function isLiveWindow(window) {
  return Boolean(window && !window.isDestroyed());
}

function normalizedUrl(url) {
  const value = String(url || "").trim() || "http://localhost";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

function cliOjUrl() {
  const prefix = "--oj-url=";
  const value = process.argv.find((arg) => String(arg).startsWith(prefix));
  return value ? value.slice(prefix.length) : "";
}

function defaultOjUrl() {
  return normalizedUrl(cliOjUrl() || config.serverBaseUrl);
}

function resolveCompilerPath() {
  const configured = String(config.compilerPath || "").trim();
  const candidates = [];
  if (path.isAbsolute(configured)) {
    candidates.push(configured);
  } else {
    if (process.resourcesPath) {
      candidates.push(path.resolve(process.resourcesPath, configured));
    }
    candidates.push(path.resolve(rootDir, configured));
    candidates.push(path.resolve(rootDir, "../../.qt/Tools/mingw1310_64/bin/g++.exe"));
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function proctorEnabled() {
  return config.proctor?.enabled !== false && !process.argv.includes("--no-proctor");
}

function editorAutoOpen() {
  if (process.argv.includes("--tools")) return true;
  if (process.argv.includes("--no-tools")) return false;
  return config.editor?.autoOpen !== false;
}

function setLayout() {
  if (!isLiveWindow(mainWindow) || !isLiveWindow(toolsWindow)) return;
  const bounds = mainWindow.getBounds();
  const toolsWidth = Math.min(bounds.width - 48, Math.max(1120, Math.floor(bounds.width * 0.72)));
  toolsWindow.setBounds({
    x: Math.max(bounds.x, bounds.x + bounds.width - toolsWidth - 24),
    y: bounds.y,
    width: toolsWidth,
    height: bounds.height,
  });
}

function toggleTools() {
  if (!isLiveWindow(toolsWindow)) return;
  toolsVisible = !toolsVisible;
  setLayout();
  if (toolsVisible) {
    toolsWindow.show();
    toolsWindow.focus();
    toolsWindow.webContents.send("tools-visible", true);
  } else {
    toolsWindow.hide();
  }
}

function lockExam(reason) {
  if (!proctorEnabled() || locked || !isLiveWindow(lockWindow)) return;
  locked = true;
  lockWindow.webContents.send("lock-reason", reason);
  lockWindow.show();
  lockWindow.focus();
}

function unlockExam(password) {
  if (String(password || "") !== String(config.proctor?.teacherUnlockPassword || "")) {
    return { ok: false, message: "解锁密码错误" };
  }
  locked = false;
  if (isLiveWindow(lockWindow)) lockWindow.hide();
  if (isLiveWindow(mainWindow)) mainWindow.focus();
  return { ok: true };
}

function blockExamShortcuts(webContents) {
  webContents.on("context-menu", (event) => event.preventDefault());
  webContents.on("before-input-event", (event, input) => {
    if (!proctorEnabled()) return;
    const key = String(input.key || "").toLowerCase();
    const ctrlOrMeta = input.control || input.meta;
    const copyPasteKey = ctrlOrMeta && ["c", "v", "x", "insert"].includes(key);
    const pasteKey = input.shift && key === "insert";
    const systemSwitchKey = (input.alt && key === "tab") || key === "printscreen";
    if (copyPasteKey || pasteKey || systemSwitchKey) {
      event.preventDefault();
      if (copyPasteKey || pasteKey) {
        clipboard.clear();
      }
      if (systemSwitchKey) {
        lockExam("检测到切屏快捷键");
      }
    }
  });
}

function installBlurGuard() {
  const handleBlur = () => {
    if (!proctorEnabled() || !config.proctor?.lockOnBlur) return;
    setTimeout(() => {
      const focused = BrowserWindow.getFocusedWindow();
      if (focused !== mainWindow && focused !== toolsWindow && focused !== lockWindow) {
        lockExam("检测到离开考试客户端");
      }
    }, 250);
  };
  mainWindow.on("blur", handleBlur);
  toolsWindow.on("blur", handleBlur);
}

function startClipboardGuard() {
  if (!proctorEnabled() || !config.proctor?.clearClipboard) return;
  clipboardTimer = setInterval(() => {
    clipboard.clear();
  }, 1000);
}

function parseTaskList(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^"|"$/g, "").split('","')[0].toLowerCase())
    .filter(Boolean);
}

function startProcessGuard() {
  if (!proctorEnabled()) return;
  const blacklist = new Set((config.proctor?.processBlacklist || []).map((name) => String(name).toLowerCase()));
  const terminateProcesses = config.proctor?.terminateBlacklistedProcesses !== false;
  processTimer = setInterval(() => {
    childProcess.exec("tasklist /fo csv /nh", { windowsHide: true }, (_error, stdout) => {
      const running = parseTaskList(stdout);
      const hit = running.find((name) => blacklist.has(name));
      if (hit) {
        if (terminateProcesses && !terminatedProcessNames.has(hit)) {
          terminatedProcessNames.add(hit);
          childProcess.execFile("taskkill", ["/F", "/T", "/IM", hit], { windowsHide: true }, () => {
            terminatedProcessNames.delete(hit);
          });
        }
        lockExam(terminateProcesses ? `检测到违规软件，已尝试强制关闭: ${hit}` : `检测到禁止进程: ${hit}`);
      }
    });
  }, 5000);
}

function injectChinesePreference() {
  if (!isLiveWindow(mainWindow)) return;
  const language = JSON.stringify(config.language || "zh-CN");
  const script = `
    try {
      localStorage.setItem("language", ${language});
      localStorage.setItem("locale", ${language});
      localStorage.setItem("oj_lang", ${language});
      localStorage.setItem("i18nextLng", ${language});
      document.documentElement.lang = ${language};
    } catch (e) {}
  `;
  mainWindow.webContents.executeJavaScript(script, true).catch(() => {});
}

function createWindow() {
  const examMode = proctorEnabled();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Hydro OJ Exam Client",
    backgroundColor: "#ffffff",
    fullscreen: examMode,
    kiosk: examMode,
    alwaysOnTop: examMode,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  Menu.setApplicationMenu(null);

  toolsWindow = new BrowserWindow({
    width: 1120,
    height: 900,
    title: "Hydro OI 本地编辑器",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  toolsWindow.setMenuBarVisibility(false);
  toolsWindow.setAlwaysOnTop(true, "floating");
  toolsWindow.on("close", (event) => {
    if (appQuitting || !isLiveWindow(mainWindow)) return;
    event.preventDefault();
    toolsVisible = false;
    toolsWindow.hide();
  });

  lockWindow = new BrowserWindow({
    title: "Hydro 考试已锁定",
    show: false,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  lockWindow.setMenuBarVisibility(false);
  lockWindow.loadFile(path.join(__dirname, "lock.html"));

  blockExamShortcuts(mainWindow.webContents);
  blockExamShortcuts(toolsWindow.webContents);
  blockExamShortcuts(lockWindow.webContents);
  toolsWindow.loadFile(path.join(__dirname, "tools.html"));
  mainWindow.loadURL(defaultOjUrl());
  mainWindow.webContents.on("did-finish-load", injectChinesePreference);
  setLayout();
  if (editorAutoOpen()) {
    toolsVisible = true;
    setLayout();
    toolsWindow.webContents.once("did-finish-load", () => {
      toolsWindow.show();
      toolsWindow.focus();
    });
  }

  mainWindow.on("resize", setLayout);
  mainWindow.on("move", setLayout);
  mainWindow.on("closed", () => {
    appQuitting = true;
    if (isLiveWindow(toolsWindow)) toolsWindow.close();
    if (isLiveWindow(lockWindow)) lockWindow.close();
    mainWindow = undefined;
    toolsWindow = undefined;
    lockWindow = undefined;
  });

  installBlurGuard();
  startClipboardGuard();
  startProcessGuard();
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const proc = childProcess.spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, options.timeoutMs || 3000);
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, code: -1, stdout, stderr: `${stderr}${error.message}`, timedOut, ms: Date.now() - started });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, code: code ?? -1, stdout, stderr, timedOut, ms: Date.now() - started });
    });
    if (options.stdin) {
      proc.stdin.end(options.stdin);
    } else {
      proc.stdin.end();
    }
  });
}

function dialogOwner() {
  if (isLiveWindow(toolsWindow)) return toolsWindow;
  if (isLiveWindow(mainWindow)) return mainWindow;
  return undefined;
}

function sourceFilePayload(filePath) {
  return {
    name: path.basename(filePath),
    path: filePath,
    code: fs.readFileSync(filePath, "utf8"),
  };
}

function walkFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), "zh-CN", { numeric: true, sensitivity: "base" });
}

function collectZipTestCases(root) {
  const groups = new Map();
  for (const filePath of walkFiles(root)) {
    const ext = path.extname(filePath).toLowerCase();
    if (![".in", ".out", ".ans"].includes(ext)) continue;
    const key = path.basename(filePath, ext);
    const group = groups.get(key) || { name: key, inputPath: "", outputPath: "" };
    if (ext === ".in") {
      group.inputPath = filePath;
    } else if (!group.outputPath || ext === ".out") {
      group.outputPath = filePath;
    }
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .filter((item) => item.inputPath || item.outputPath)
    .sort((a, b) => naturalCompare(a.name, b.name))
    .map((item, index) => ({
      id: `zip-${Date.now()}-${index}`,
      name: item.name || String(index),
      input: item.inputPath ? fs.readFileSync(item.inputPath, "utf8") : "",
      expected: item.outputPath ? fs.readFileSync(item.outputPath, "utf8") : "",
      last: null,
    }));
}

async function expandZip(zipPath, targetDir) {
  const script = "& { param($zipPath, $targetDir) Expand-Archive -LiteralPath $zipPath -DestinationPath $targetDir -Force }";
  const powershell = await runCommand(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script, zipPath, targetDir],
    { timeoutMs: 60000 },
  );
  if (powershell.ok) return powershell;
  return runCommand("tar.exe", ["-xf", zipPath, "-C", targetDir], { timeoutMs: 60000 });
}

ipcMain.handle("run-sample", async (_event, payload) => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gyoj-sample-"));
  const sourcePath = path.join(workDir, "main.cpp");
  const exePath = path.join(workDir, "main.exe");
  fs.writeFileSync(sourcePath, payload.code || "", "utf8");

  const compilerPath = resolveCompilerPath();
  const compile = await runCommand(
    compilerPath,
    ["-std=c++14", "-O2", "-pipe", sourcePath, "-o", exePath],
    { cwd: workDir, timeoutMs: 10000 },
  );
  if (!compile.ok) {
    return { phase: "compile", ...compile };
  }
  const run = await runCommand(exePath, [], {
    cwd: workDir,
    stdin: payload.stdin || "",
    timeoutMs: Number(config.localRunTimeoutMs) || 3000,
  });
  return { phase: "run", ...run };
});

ipcMain.handle("run-tests", async (_event, payload) => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "gyoj-tests-"));
  const sourcePath = path.join(workDir, "main.cpp");
  const exePath = path.join(workDir, "main.exe");
  fs.writeFileSync(sourcePath, payload.code || "", "utf8");

  const compilerPath = resolveCompilerPath();
  const compile = await runCommand(
    compilerPath,
    ["-std=c++14", "-O2", "-pipe", sourcePath, "-o", exePath],
    { cwd: workDir, timeoutMs: 10000 },
  );
  if (!compile.ok) {
    return { phase: "compile", compile, tests: [] };
  }

  const cases = Array.isArray(payload.tests) ? payload.tests : [];
  const tests = [];
  for (const test of cases) {
    const run = await runCommand(exePath, [], {
      cwd: workDir,
      stdin: test.input || "",
      timeoutMs: Number(config.localRunTimeoutMs) || 3000,
    });
    tests.push({
      id: test.id,
      name: test.name,
      input: test.input || "",
      expected: test.expected || "",
      ...run,
    });
  }
  return { phase: "run", compile, tests };
});

ipcMain.handle("open-source-file", async () => {
  const result = await dialog.showOpenDialog(dialogOwner(), {
    title: "打开 C++ 源码文件",
    properties: ["openFile"],
    filters: [
      { name: "C++ 源码", extensions: ["cpp", "cc", "cxx", "c++", "h", "hpp"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };
  return { canceled: false, file: sourceFilePayload(result.filePaths[0]) };
});

ipcMain.handle("save-source-file", async (_event, payload) => {
  let filePath = String(payload?.path || "").trim();
  if (!filePath) {
    const result = await dialog.showSaveDialog(dialogOwner(), {
      title: "保存 C++ 源码文件",
      defaultPath: payload?.name || "main.cpp",
      filters: [
        { name: "C++ 源码", extensions: ["cpp"] },
        { name: "所有文件", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    filePath = result.filePath;
  }
  fs.writeFileSync(filePath, payload?.code || "", "utf8");
  return { canceled: false, file: { name: path.basename(filePath), path: filePath } };
});

ipcMain.handle("save-source-file-as", async (_event, payload) => {
  const result = await dialog.showSaveDialog(dialogOwner(), {
    title: "另存 C++ 源码文件",
    defaultPath: payload?.name || "main.cpp",
    filters: [
      { name: "C++ 源码", extensions: ["cpp"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.writeFileSync(result.filePath, payload?.code || "", "utf8");
  return { canceled: false, file: { name: path.basename(result.filePath), path: result.filePath } };
});

ipcMain.handle("import-test-zip", async () => {
  const result = await dialog.showOpenDialog(dialogOwner(), {
    title: "导入 OI 测试数据 zip",
    properties: ["openFile"],
    filters: [
      { name: "Zip 数据包", extensions: ["zip"] },
      { name: "所有文件", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths.length) return { canceled: true };

  const zipPath = result.filePaths[0];
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "hydro-oi-data-"));
  const expanded = await expandZip(zipPath, extractDir);
  if (!expanded.ok) {
    return {
      canceled: false,
      ok: false,
      message: expanded.stderr || expanded.stdout || "zip 解压失败",
    };
  }
  const cases = collectZipTestCases(extractDir);
  return {
    canceled: false,
    ok: true,
    name: path.basename(zipPath),
    count: cases.length,
    cases,
  };
});

ipcMain.handle("load-oj-url", async (_event, url) => {
  const target = normalizedUrl(url);
  await mainWindow.loadURL(target);
  return target;
});

ipcMain.handle("get-default-oj-url", async () => defaultOjUrl());

ipcMain.handle("unlock-exam", async (_event, password) => unlockExam(password));

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["Accept-Language"] = `${config.language || "zh-CN"},zh;q=0.9`;
    callback({ requestHeaders: details.requestHeaders });
  });
  createWindow();
  globalShortcut.register("F8", toggleTools);
  globalShortcut.register("CommandOrControl+L", () => {
    if (!isLiveWindow(toolsWindow)) return;
    toolsVisible = true;
    setLayout();
    toolsWindow.show();
    toolsWindow.focus();
    toolsWindow.webContents.send("focus-url");
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  appQuitting = true;
  if (clipboardTimer) clearInterval(clipboardTimer);
  if (processTimer) clearInterval(processTimer);
  globalShortcut.unregisterAll();
});
