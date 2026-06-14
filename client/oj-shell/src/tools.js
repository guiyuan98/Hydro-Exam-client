const urlInput = document.querySelector("#url");
const goButton = document.querySelector("#go");
const openSourceButton = document.querySelector("#openSource");
const saveSourceButton = document.querySelector("#saveSource");
const saveSourceAsButton = document.querySelector("#saveSourceAs");
const importZipButton = document.querySelector("#importZip");
const runAllButton = document.querySelector("#runAll");
const addSourceButton = document.querySelector("#addSource");
const addCaseButton = document.querySelector("#addCase");
const runCurrentButton = document.querySelector("#runCurrent");
const deleteCaseButton = document.querySelector("#deleteCase");
const sourceList = document.querySelector("#sourceList");
const caseList = document.querySelector("#caseList");
const sourceCount = document.querySelector("#sourceCount");
const caseCount = document.querySelector("#caseCount");
const activeTab = document.querySelector("#activeTab");
const filePathText = document.querySelector("#filePath");
const statusText = document.querySelector("#status");
const codeInput = document.querySelector("#code");
const lineNumbers = document.querySelector("#lineNumbers");
const caseTitle = document.querySelector("#caseTitle");
const caseMeta = document.querySelector("#caseMeta");
const stdinInput = document.querySelector("#stdin");
const expectedInput = document.querySelector("#expected");
const resultList = document.querySelector("#resultList");
const stdoutPanel = document.querySelector("#stdoutPanel");
const stderrPanel = document.querySelector("#stderrPanel");

const STORAGE_KEY = "hydro-local-tools-workspace-v3";

const cppTemplate = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int a, b;
    cin >> a >> b;
    cout << a + b << '\\n';
    return 0;
}
`;

let state = loadState();

function defaultState() {
  return {
    activeSourceId: "main",
    activeCaseId: "case-0",
    sources: [
      { id: "main", name: "main.cpp", path: "", code: cppTemplate, dirty: false },
    ],
    cases: [
      { id: "case-0", name: "0", input: "1 2\n", expected: "3\n", last: null },
      { id: "case-1", name: "1", input: "10 20\n", expected: "30\n", last: null },
    ],
  };
}

function normalizeSource(source) {
  return {
    id: source.id || `source-${Date.now()}`,
    name: source.name || "main.cpp",
    path: source.path || "",
    code: source.code || "",
    dirty: Boolean(source.dirty),
  };
}

function normalizeCase(testCase, index) {
  return {
    id: testCase.id || `case-${Date.now()}-${index}`,
    name: testCase.name || String(index),
    input: testCase.input || "",
    expected: testCase.expected || "",
    last: testCase.last || null,
  };
}

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    if (value?.sources?.length && value?.cases?.length) {
      return {
        activeSourceId: value.activeSourceId,
        activeCaseId: value.activeCaseId,
        sources: value.sources.map(normalizeSource),
        cases: value.cases.map(normalizeCase),
      };
    }
  } catch {}
  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeSource() {
  return state.sources.find((item) => item.id === state.activeSourceId) || state.sources[0];
}

function activeCase() {
  return state.cases.find((item) => item.id === state.activeCaseId) || state.cases[0];
}

function normalizeOutput(text) {
  return String(text || "").replace(/\r\n/g, "\n").trimEnd();
}

function outputMatches(actual, expected) {
  if (!String(expected || "").trim()) return null;
  return normalizeOutput(actual) === normalizeOutput(expected);
}

function setStatus(text) {
  statusText.textContent = text;
}

function syncEditorAfterProgrammaticChange() {
  const source = activeSource();
  source.code = codeInput.value;
  source.dirty = true;
  updateLineNumbers();
  saveState();
}

function setEditorText(value, selectionStart, selectionEnd = selectionStart) {
  codeInput.value = value;
  codeInput.selectionStart = selectionStart;
  codeInput.selectionEnd = selectionEnd;
  syncEditorAfterProgrammaticChange();
}

function selectedRange() {
  return {
    start: codeInput.selectionStart,
    end: codeInput.selectionEnd,
    value: codeInput.value,
  };
}

function lineStartAt(text, position) {
  const index = text.lastIndexOf("\n", Math.max(0, position - 1));
  return index === -1 ? 0 : index + 1;
}

function lineEndAt(text, position) {
  const index = text.indexOf("\n", position);
  return index === -1 ? text.length : index;
}

function lineIndentAt(text, position) {
  const start = lineStartAt(text, position);
  const match = text.slice(start, lineEndAt(text, position)).match(/^\s*/);
  return match ? match[0] : "";
}

function replaceEditorRange(start, end, inserted, caretStart = start + inserted.length, caretEnd = caretStart) {
  const text = codeInput.value;
  setEditorText(text.slice(0, start) + inserted + text.slice(end), caretStart, caretEnd);
}

function handleAutoPair(event) {
  const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
  const closeToOpen = { ")": "(", "]": "[", "}": "{", '"': '"', "'": "'" };
  const key = event.key;
  if (!pairs[key] && !closeToOpen[key]) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;

  const { start, end, value } = selectedRange();
  const selected = value.slice(start, end);

  if (start === end && value[start] === key && closeToOpen[key]) {
    event.preventDefault();
    setEditorText(value, start + 1);
    return true;
  }

  if (pairs[key]) {
    event.preventDefault();
    const close = pairs[key];
    if (selected) {
      replaceEditorRange(start, end, `${key}${selected}${close}`, start + 1, end + 1);
      return true;
    }
    replaceEditorRange(start, end, `${key}${close}`, start + 1);
    return true;
  }

  return false;
}

function handleBackspacePair(event) {
  if (event.key !== "Backspace" || event.ctrlKey || event.metaKey || event.altKey) return false;
  const { start, end, value } = selectedRange();
  if (start !== end || start <= 0) return false;
  const before = value[start - 1];
  const after = value[start];
  const pairs = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
  if (pairs[before] !== after) return false;
  event.preventDefault();
  replaceEditorRange(start - 1, start + 1, "", start - 1);
  return true;
}

function handleSmartEnter(event) {
  if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.altKey) return false;
  const { start, end, value } = selectedRange();
  const indent = lineIndentAt(value, start);
  const before = value[start - 1] || "";
  const after = value[start] || "";
  event.preventDefault();

  if (before === "{" && after === "}") {
    const inserted = `\n${indent}    \n${indent}`;
    replaceEditorRange(start, end, inserted, start + indent.length + 5);
    return true;
  }

  const extraIndent = before === "{" || before === ":" ? "    " : "";
  const inserted = `\n${indent}${extraIndent}`;
  replaceEditorRange(start, end, inserted, start + inserted.length);
  return true;
}

function handleTabIndent(event) {
  if (event.key !== "Tab") return false;
  event.preventDefault();

  const { start, end, value } = selectedRange();
  if (start === end) {
    replaceEditorRange(start, end, "    ", start + 4);
    return true;
  }

  const blockStart = lineStartAt(value, start);
  const blockEnd = lineEndAt(value, end);
  const block = value.slice(blockStart, blockEnd);
  const lines = block.split("\n");
  let updated;
  let startShift = 0;
  let endShift = 0;

  if (event.shiftKey) {
    updated = lines.map((line, index) => {
      const removed = line.startsWith("    ") ? 4 : line.startsWith("\t") ? 1 : 0;
      if (index === 0) startShift = -Math.min(removed, start - blockStart);
      endShift -= removed;
      return removed ? line.slice(removed) : line;
    }).join("\n");
  } else {
    updated = lines.map((line) => `    ${line}`).join("\n");
    startShift = 4;
    endShift = lines.length * 4;
  }

  const newText = value.slice(0, blockStart) + updated + value.slice(blockEnd);
  setEditorText(newText, Math.max(blockStart, start + startShift), Math.max(blockStart, end + endShift));
  return true;
}

function toggleLineComment(event) {
  if (event.key !== "/" || (!event.ctrlKey && !event.metaKey) || event.altKey) return false;
  event.preventDefault();

  const { start, end, value } = selectedRange();
  const blockStart = lineStartAt(value, start);
  const blockEnd = lineEndAt(value, end);
  const block = value.slice(blockStart, blockEnd);
  const lines = block.split("\n");
  const hasCodeLine = lines.some((line) => line.trim().length > 0);
  const shouldUncomment = hasCodeLine && lines
    .filter((line) => line.trim().length > 0)
    .every((line) => /^(\s*)\/\//.test(line));

  let startShift = 0;
  let endShift = 0;
  const updated = lines.map((line, index) => {
    if (!line.trim()) return line;
    if (shouldUncomment) {
      const next = line.replace(/^(\s*)\/\/ ?/, "$1");
      const diff = next.length - line.length;
      if (index === 0) startShift += diff;
      endShift += diff;
      return next;
    }
    const next = line.replace(/^(\s*)/, "$1// ");
    const diff = next.length - line.length;
    if (index === 0) startShift += diff;
    endShift += diff;
    return next;
  }).join("\n");

  const newText = value.slice(0, blockStart) + updated + value.slice(blockEnd);
  setEditorText(newText, Math.max(blockStart, start + startShift), Math.max(blockStart, end + endShift));
  return true;
}

function handleEditorKeydown(event) {
  if (
    toggleLineComment(event) ||
    handleTabIndent(event) ||
    handleSmartEnter(event) ||
    handleBackspacePair(event) ||
    handleAutoPair(event)
  ) {
    return;
  }
}

function updateLineNumbers() {
  const count = Math.max(1, codeInput.value.split("\n").length);
  lineNumbers.textContent = Array.from({ length: count }, (_value, index) => index + 1).join("\n");
}

function statusClass(status) {
  if (status === "通过") return "pass";
  if (status === "超时") return "warn";
  if (status && status !== "未运行" && status !== "已运行") return "fail";
  return "";
}

function renderSources() {
  sourceList.innerHTML = "";
  sourceCount.textContent = String(state.sources.length);
  for (const source of state.sources) {
    const row = document.createElement("div");
    row.className = `file-item ${source.id === state.activeSourceId ? "active" : ""}`;
    row.innerHTML = `<span class="file-kind">CPP</span><span class="file-name"></span><span class="file-status"></span>`;
    row.querySelector(".file-name").textContent = `${source.name}${source.dirty ? " *" : ""}`;
    row.querySelector(".file-status").textContent = source.path ? "本地" : "草稿";
    row.title = source.path || source.name;
    row.addEventListener("click", () => {
      syncInputsToState();
      state.activeSourceId = source.id;
      render();
    });
    sourceList.appendChild(row);
  }
}

function renderCases() {
  caseList.innerHTML = "";
  caseCount.textContent = String(state.cases.length);
  for (const testCase of state.cases) {
    const active = testCase.id === state.activeCaseId ? "active" : "";
    const last = testCase.last?.status || "";
    const row = document.createElement("div");
    row.className = `file-item ${active}`;
    row.innerHTML = `<span class="file-kind">IO</span><span class="file-name"></span><span class="file-status"></span>`;
    row.querySelector(".file-name").textContent = `${testCase.name}.in / ${testCase.name}.out`;
    row.querySelector(".file-status").textContent = last;
    row.addEventListener("click", () => {
      syncInputsToState();
      state.activeCaseId = testCase.id;
      render();
    });
    caseList.appendChild(row);
  }
}

function renderEditor() {
  const source = activeSource();
  activeTab.textContent = `${source.name}${source.dirty ? " *" : ""}`;
  filePathText.textContent = source.path || "未保存的本地文件";
  if (codeInput.value !== source.code) codeInput.value = source.code;
  updateLineNumbers();
}

function renderCaseEditor() {
  const testCase = activeCase();
  caseTitle.textContent = `${testCase.name}.in / ${testCase.name}.out`;
  caseMeta.textContent = testCase.last
    ? `${testCase.last.status} · ${testCase.last.ms ?? 0}ms`
    : "编辑输入数据和期望输出";
  if (stdinInput.value !== testCase.input) stdinInput.value = testCase.input;
  if (expectedInput.value !== testCase.expected) expectedInput.value = testCase.expected;
  deleteCaseButton.disabled = state.cases.length <= 1;
}

function renderResults() {
  resultList.innerHTML = "";
  for (const testCase of state.cases) {
    const last = testCase.last;
    const status = last?.status || "未运行";
    const card = document.createElement("div");
    card.className = `result-card ${statusClass(status)}`;
    card.innerHTML = `
      <div class="result-head">
        <span>${testCase.name}.in / ${testCase.name}.out</span>
        <span class="badge">${status}</span>
      </div>
      <div class="diff"></div>
    `;
    const detail = card.querySelector(".diff");
    if (last) {
      const expected = String(testCase.expected || "").trim()
        ? `期望: ${normalizeOutput(testCase.expected) || "(空)"}`
        : "未填写期望输出";
      const actual = `实际: ${normalizeOutput(last.stdout) || "(空)"}`;
      detail.textContent = `退出码: ${last.code} · 耗时: ${last.ms}ms\n${expected}\n${actual}`;
    } else {
      detail.textContent = "点击运行当前或运行全部。";
    }
    card.addEventListener("click", () => {
      syncInputsToState();
      state.activeCaseId = testCase.id;
      render();
      showCaseOutput(testCase);
    });
    resultList.appendChild(card);
  }
}

function render() {
  renderSources();
  renderCases();
  renderEditor();
  renderCaseEditor();
  renderResults();
  showCaseOutput(activeCase());
  saveState();
}

function syncInputsToState() {
  const source = activeSource();
  const testCase = activeCase();
  if (source) source.code = codeInput.value;
  if (testCase) {
    testCase.input = stdinInput.value;
    testCase.expected = expectedInput.value;
  }
  saveState();
}

function showCaseOutput(testCase) {
  const last = testCase?.last;
  stdoutPanel.textContent = last?.stdout || "";
  stderrPanel.textContent = last?.stderr || "";
}

function setRunning(running) {
  runAllButton.disabled = running;
  runCurrentButton.disabled = running;
}

function resultStatus(result, expected) {
  if (result.timedOut) return "超时";
  if (!result.ok) return "运行错误";
  const matched = outputMatches(result.stdout, expected);
  if (matched === null) return "已运行";
  return matched ? "通过" : "答案错误";
}

async function runTests(testIds = null) {
  syncInputsToState();
  const source = activeSource();
  const selectedCases = testIds
    ? state.cases.filter((item) => testIds.includes(item.id))
    : state.cases;
  setRunning(true);
  setStatus("正在编译...");
  stdoutPanel.textContent = "";
  stderrPanel.textContent = "";
  try {
    const result = await window.gyoj.runTests({
      code: source.code,
      tests: selectedCases.map((item) => ({
        id: item.id,
        name: item.name,
        input: item.input,
        expected: item.expected,
      })),
    });
    if (result.phase === "compile") {
      setStatus("编译失败");
      stderrPanel.textContent = result.compile.stderr || result.compile.stdout || "编译失败，但没有返回错误信息。";
      activateResultPanel("stderr");
      for (const item of selectedCases) {
        item.last = {
          status: "编译失败",
          code: result.compile.code,
          ms: result.compile.ms,
          stdout: "",
          stderr: result.compile.stderr || result.compile.stdout || "",
        };
      }
      render();
      return;
    }
    for (const run of result.tests) {
      const testCase = state.cases.find((item) => item.id === run.id);
      if (!testCase) continue;
      testCase.last = {
        ...run,
        status: resultStatus(run, testCase.expected),
      };
    }
    const passed = selectedCases.filter((item) => item.last?.status === "通过").length;
    setStatus(`运行完成，${passed}/${selectedCases.length} 通过`);
    activateResultPanel("summary");
    render();
  } catch (error) {
    setStatus("运行失败");
    stderrPanel.textContent = error?.message || String(error);
    activateResultPanel("stderr");
  } finally {
    setRunning(false);
  }
}

function addSource() {
  syncInputsToState();
  const index = state.sources.length + 1;
  const id = `source-${Date.now()}`;
  state.sources.push({ id, name: `solution${index}.cpp`, path: "", code: cppTemplate, dirty: false });
  state.activeSourceId = id;
  setStatus("已新建源码文件");
  render();
}

function addCase() {
  syncInputsToState();
  const nextNumber = state.cases.reduce((max, item) => Math.max(max, Number(item.name) || 0), -1) + 1;
  const id = `case-${Date.now()}`;
  state.cases.push({ id, name: String(nextNumber), input: "", expected: "", last: null });
  state.activeCaseId = id;
  setStatus("已新建测试点");
  render();
}

function deleteActiveCase() {
  if (state.cases.length <= 1) return;
  const index = state.cases.findIndex((item) => item.id === state.activeCaseId);
  state.cases.splice(index, 1);
  state.activeCaseId = state.cases[Math.max(0, index - 1)].id;
  setStatus("已删除测试点");
  render();
}

async function openSourceFile() {
  syncInputsToState();
  const result = await window.gyoj.openSourceFile();
  if (result.canceled) return;
  const file = result.file;
  const existing = state.sources.find((item) => item.path && item.path === file.path);
  if (existing) {
    existing.code = file.code;
    existing.name = file.name;
    existing.dirty = false;
    state.activeSourceId = existing.id;
  } else {
    const id = `source-${Date.now()}`;
    state.sources.push({ id, name: file.name, path: file.path, code: file.code, dirty: false });
    state.activeSourceId = id;
  }
  setStatus(`已打开 ${file.name}`);
  render();
}

async function saveSource(forceSaveAs = false) {
  syncInputsToState();
  const source = activeSource();
  const payload = {
    name: source.name,
    path: forceSaveAs ? "" : source.path,
    code: source.code,
  };
  const result = forceSaveAs
    ? await window.gyoj.saveSourceFileAs(payload)
    : await window.gyoj.saveSourceFile(payload);
  if (result.canceled) return;
  source.name = result.file.name;
  source.path = result.file.path;
  source.dirty = false;
  setStatus(`已保存 ${source.name}`);
  render();
}

async function importTestZip() {
  syncInputsToState();
  setStatus("正在导入 zip 数据包...");
  const result = await window.gyoj.importTestZip();
  if (result.canceled) {
    setStatus("已取消导入");
    return;
  }
  if (!result.ok) {
    setStatus("导入失败");
    stderrPanel.textContent = result.message || "导入 zip 失败";
    activateResultPanel("stderr");
    return;
  }
  if (!result.cases.length) {
    setStatus("zip 中没有找到 .in/.out 数据");
    return;
  }
  const replace = state.cases.length <= 2 || confirm(`从 ${result.name} 识别到 ${result.count} 组数据，是否替换当前测试数据？\n选择“取消”则追加到当前列表。`);
  const importedCases = result.cases.map(normalizeCase);
  if (replace) {
    state.cases = importedCases;
  } else {
    state.cases.push(...importedCases);
  }
  state.activeCaseId = importedCases[0].id;
  setStatus(`已导入 ${result.count} 组测试数据`);
  activateResultPanel("summary");
  render();
}

async function initDefaultUrl() {
  const target = await window.gyoj.getDefaultOjUrl();
  urlInput.value = target;
}

async function loadOjUrl() {
  const target = await window.gyoj.loadOjUrl(urlInput.value);
  urlInput.value = target;
  setStatus(`已加载 ${target}`);
}

function activateResultPanel(name) {
  document.querySelectorAll(".result-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === name);
  });
  document.querySelectorAll(".result-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`#${name}Panel`)?.classList.add("active");
}

goButton.addEventListener("click", loadOjUrl);
urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadOjUrl();
});
openSourceButton.addEventListener("click", openSourceFile);
saveSourceButton.addEventListener("click", () => saveSource(false));
saveSourceAsButton.addEventListener("click", () => saveSource(true));
importZipButton.addEventListener("click", importTestZip);
runAllButton.addEventListener("click", () => runTests());
runCurrentButton.addEventListener("click", () => runTests([activeCase().id]));
addSourceButton.addEventListener("click", addSource);
addCaseButton.addEventListener("click", addCase);
deleteCaseButton.addEventListener("click", deleteActiveCase);

codeInput.addEventListener("input", () => {
  const source = activeSource();
  source.code = codeInput.value;
  source.dirty = true;
  updateLineNumbers();
  saveState();
  renderSources();
  renderEditor();
});
codeInput.addEventListener("keydown", handleEditorKeydown);
codeInput.addEventListener("scroll", () => {
  lineNumbers.scrollTop = codeInput.scrollTop;
});
stdinInput.addEventListener("input", () => {
  activeCase().input = stdinInput.value;
  saveState();
});
expectedInput.addEventListener("input", () => {
  activeCase().expected = expectedInput.value;
  saveState();
});
document.querySelectorAll(".result-tab").forEach((tab) => {
  tab.addEventListener("click", () => activateResultPanel(tab.dataset.panel));
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveSource(event.shiftKey).catch((error) => setStatus(error?.message || "保存失败"));
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
    event.preventDefault();
    openSourceFile().catch((error) => setStatus(error?.message || "打开失败"));
  }
});

initDefaultUrl().catch(() => {
  urlInput.value = "http://localhost";
});

window.gyoj.onToolsVisible((visible) => {
  if (visible) codeInput.focus();
});
window.gyoj.onFocusUrl(() => {
  urlInput.focus();
  urlInput.select();
});

render();
