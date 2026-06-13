const urlInput = document.querySelector("#url");
const goButton = document.querySelector("#go");
const codeInput = document.querySelector("#code");
const stdinInput = document.querySelector("#stdin");
const runButton = document.querySelector("#run");
const output = document.querySelector("#output");
const status = document.querySelector("#status");

async function initDefaultUrl() {
  const target = await window.gyoj.getDefaultOjUrl();
  urlInput.value = target;
}

async function loadOjUrl() {
  const target = await window.gyoj.loadOjUrl(urlInput.value);
  urlInput.value = target;
  status.textContent = `已加载 ${target}`;
}

async function runSample() {
  runButton.disabled = true;
  status.textContent = "正在编译运行...";
  output.textContent = "";
  try {
    const result = await window.gyoj.runSample({
      code: codeInput.value,
      stdin: stdinInput.value,
    });
    const lines = [
      result.phase === "compile" ? "编译失败" : "运行完成",
      `退出码: ${result.code}`,
      `耗时: ${result.ms}ms`,
      result.timedOut ? "状态: 超时" : "状态: 正常结束",
      "",
      "[stdout]",
      result.stdout || "",
      "",
      "[stderr]",
      result.stderr || "",
    ];
    output.textContent = lines.join("\n");
    status.textContent = result.ok ? "样例运行通过" : "样例运行未通过";
  } catch (error) {
    output.textContent = error?.message || String(error);
    status.textContent = "运行失败";
  } finally {
    runButton.disabled = false;
  }
}

goButton.addEventListener("click", loadOjUrl);
urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadOjUrl();
});
runButton.addEventListener("click", runSample);
initDefaultUrl().catch(() => {
  urlInput.value = "http://192.168.1.149";
});

window.gyoj.onToolsVisible((visible) => {
  if (visible) codeInput.focus();
});
window.gyoj.onFocusUrl(() => {
  urlInput.focus();
  urlInput.select();
});
