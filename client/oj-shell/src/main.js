const { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, session } = require("electron");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const configPath = path.join(rootDir, "gyoj-shell.json");

function loadConfig() {
  const fallback = {
    serverBaseUrl: "http://192.168.1.149",
    compilerPath: "tools/mingw/bin/g++.exe",
    localRunTimeoutMs: 3000,
    language: "zh-CN",
    editor: {
      autoOpen: true,
    },
    proctor: {
      enabled: true,
      teacherUnlockPassword: "123456",
      clearClipboard: true,
      lockOnBlur: true,
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

app.commandLine.appendSwitch("lang", config.language || "zh-CN");

function normalizedUrl(url) {
  const value = String(url || "").trim() || "http://192.168.1.149";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
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
  if (!mainWindow || !toolsWindow) return;
  const bounds = mainWindow.getBounds();
  const toolsWidth = Math.min(520, Math.max(420, Math.floor(bounds.width * 0.32)));
  toolsWindow.setBounds({
    x: Math.max(bounds.x, bounds.x + bounds.width - toolsWidth - 24),
    y: bounds.y,
    width: toolsWidth,
    height: bounds.height,
  });
}

function toggleTools() {
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
  if (!proctorEnabled() || locked || !lockWindow) return;
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
  lockWindow.hide();
  mainWindow.focus();
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
  processTimer = setInterval(() => {
    childProcess.exec("tasklist /fo csv /nh", { windowsHide: true }, (_error, stdout) => {
      const running = parseTaskList(stdout);
      const hit = running.find((name) => blacklist.has(name));
      if (hit) {
        lockExam(`检测到禁止进程: ${hit}`);
      }
    });
  }, 5000);
}

function injectChinesePreference() {
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
    title: "GYOJ OnlineJudge Client",
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
    width: 520,
    height: 900,
    title: "GYOJ Local OI Editor",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  toolsWindow.setMenuBarVisibility(false);
  toolsWindow.setAlwaysOnTop(true, "floating");

  lockWindow = new BrowserWindow({
    title: "GYOJ Exam Locked",
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
  mainWindow.loadURL(normalizedUrl(config.serverBaseUrl));
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
    if (toolsWindow) toolsWindow.close();
    if (lockWindow) lockWindow.close();
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

ipcMain.handle("load-oj-url", async (_event, url) => {
  const target = normalizedUrl(url);
  await mainWindow.loadURL(target);
  return target;
});

ipcMain.handle("unlock-exam", async (_event, password) => unlockExam(password));

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["Accept-Language"] = `${config.language || "zh-CN"},zh;q=0.9`;
    callback({ requestHeaders: details.requestHeaders });
  });
  createWindow();
  globalShortcut.register("F8", toggleTools);
  globalShortcut.register("CommandOrControl+L", () => {
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
  if (clipboardTimer) clearInterval(clipboardTimer);
  if (processTimer) clearInterval(processTimer);
  globalShortcut.unregisterAll();
});
