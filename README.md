# Hydro 二次开发：OI 安全考试客户端

本项目是在 Hydro OJ 基础上做的二次开发方案，目标是把在线评测系统和 Windows 考试客户端结合起来，形成适合 OI/算法竞赛机房考试的受控环境。

学生打开客户端后会直接进入指定的 Hydro OJ 服务器，同时自动打开本地 C++ 编辑器和样例运行器。正式提交、隐藏测试数据、排名和远程判题仍由 Hydro 服务端完成，客户端只负责考试入口、本地样例调试和基础监考限制。

## 加入的功能

相比原始 Hydro，本项目增加了这些工程能力：

- Windows 桌面考试客户端：基于 Electron，学生不再用普通浏览器进入考试。
- 默认考试模式：正式启动时自动全屏、置顶、kiosk。
- Hydro 页面嵌入：客户端主窗口直接加载你自己的 Hydro OJ，不是官方演示站。
- 本地 C++ 编辑器：客户端自动打开本地 OI 编辑器窗口，内置 A+B 模板。
- CPH 式本地测试工作区：左侧列出源码文件和 `0.in / 0.out`、`1.in / 1.out` 等测试数据，中间编辑代码，右侧编辑输入数据、期望输出和查看测试结果。
- 本地样例运行：内置 MinGW/g++，支持编译运行 C++14 代码，编译错误、运行错误、超时、答案错误和通过状态会在客户端中直接提示。
- 远程正式判题：隐藏测试数据不下发到客户端，仍通过 Hydro/HydroJudge 判题。
- 禁止复制粘贴：拦截 `Ctrl+C`、`Ctrl+V`、`Ctrl+X`，并定时清空剪贴板。
- 禁止切屏：拦截常见切屏快捷键，窗口失焦后锁定考试。
- 黑名单进程检测：发现浏览器、聊天软件、外部 IDE、远程控制工具后锁定。
- 教师解锁：锁屏后输入教师密码恢复考试。
- 中文默认环境：客户端请求头和前端语言偏好默认设置为 `zh-CN`。
- Hydro WSL 部署脚本：提供安装、启动、管理员初始化、局域网发布脚本。
- 旧 Hydro 数据迁移文档：支持从已有 Hydro 站点迁移用户、题目、比赛、提交和测试数据。

> 注意：本项目属于用户态监考方案，适合受控 Windows 机房、管理员权限和非内核级对抗条件。不要将其描述为“绝对防作弊”。

## 项目结构

```text
client/oj-shell/              Electron 学生考试客户端
client/oj-shell/gyoj-shell.json  客户端核心配置文件
deploy/                       Hydro 部署、启动、局域网发布脚本
docs/                         接入、迁移、测试和运维文档
server/                       Hydro 监考插件后续扩展设计
```

当前可交付的学生端在：

```text
client/oj-shell/dist/Hydro-Exam-Client-win-x64.zip
```

学生解压后运行：

```text
Hydro Exam Client.exe
```

## 一、部署 Hydro OJ

本项目推荐 Windows + WSL2 部署 Hydro。当前脚本默认使用 WSL 发行版 `Ubuntu-26.04-E`，如果你的 WSL 名称不同，请用 `-Distro` 参数替换。

安装 Hydro：

```powershell
cd <project-root>
.\deploy\install-hydro-wsl.ps1 -Distro Ubuntu-26.04-E
```

启动 Hydro：

```powershell
cd <project-root>
.\deploy\start-hydro-wsl.ps1 -Distro Ubuntu-26.04-E
```

本机访问：

```text
http://localhost/
```

初始化超级管理员：

```powershell
cd <project-root>
.\deploy\init-hydro-admin.ps1 `
  -Distro Ubuntu-26.04-E `
  -BaseUrl http://localhost `
  -Email admin@example.com `
  -Username admin `
  -Password "CHANGE_ME_STRONG_PASSWORD"
```

首次部署后请立刻修改管理员密码。

## 二、配置 Hydro 服务端

登录 Hydro 管理员账号后，建议检查这些配置：

- 系统语言：设为中文。
- Server BaseURL：设为学生实际访问地址，例如 `http://YOUR_SERVER_IP/` 或你的公网域名。
- 题库和比赛：按 OI 赛制创建题目、测试数据和比赛。
- 评测服务：确认 `hydrojudge`、`hydro-sandbox` 在线。

检查 Hydro 服务状态：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; pm2 list"
```

应看到 `hydrooj`、`hydro-sandbox`、`mongodb`、`caddy` 在线。

## 三、发布到局域网

如果学生电脑和服务器在同一个机房局域网内，需要让学生访问服务器的局域网 IP，例如：

```text
http://YOUR_SERVER_IP/
```

WSL 内部服务默认只保证 Windows 本机能访问。要让其他学生机访问，需要管理员 PowerShell 执行：

```powershell
cd <project-root>
.\deploy\publish-hydro-lan.ps1 -Distro Ubuntu-26.04-E
```

这个脚本会：

- 获取 WSL 的内部 IP。
- 把 Windows `0.0.0.0:80` 转发到 WSL Hydro 的 `:80`。
- 添加 Windows 防火墙入站规则。

如果部署到云服务器，不需要这个 Windows 端口转发脚本，直接把域名或公网 IP 配到 Hydro 和客户端即可。

## 四、配置考试客户端

客户端配置文件：

```text
client/oj-shell/gyoj-shell.json
```

默认配置示例：

```json
{
  "serverBaseUrl": "http://localhost",
  "compilerPath": "tools/mingw/bin/g++.exe",
  "localRunTimeoutMs": 3000,
  "language": "zh-CN",
  "editor": {
    "autoOpen": true
  },
  "proctor": {
    "enabled": true,
    "teacherUnlockPassword": "CHANGE_ME_TEACHER_UNLOCK_PASSWORD",
    "clearClipboard": true,
    "lockOnBlur": true,
    "terminateBlacklistedProcesses": true,
    "processBlacklist": [
      "chrome.exe",
      "msedge.exe",
      "firefox.exe",
      "wechat.exe",
      "qq.exe",
      "devenv.exe",
      "code.exe",
      "devcpp.exe",
      "teamviewer.exe",
      "anydesk.exe"
    ]
  }
}
```

配置项说明：

| 字段 | 作用 |
| --- | --- |
| `serverBaseUrl` | 学生端启动后默认打开的 Hydro OJ 地址。局域网用服务器 IP，公网部署用域名。 |
| `compilerPath` | 内置 g++ 路径。打包后通常保持 `tools/mingw/bin/g++.exe`。 |
| `localRunTimeoutMs` | 本地样例运行超时时间，单位毫秒。 |
| `language` | 客户端请求语言，默认 `zh-CN`。 |
| `editor.autoOpen` | 是否启动后自动打开本地 C++ 编辑器窗口。 |
| `proctor.enabled` | 是否默认启用考试监考限制。正式发给学生应保持 `true`。 |
| `teacherUnlockPassword` | 教师解锁密码。正式使用前必须修改。 |
| `clearClipboard` | 是否定时清空剪贴板。 |
| `lockOnBlur` | 客户端失去焦点后是否锁定考试。 |
| `terminateBlacklistedProcesses` | 命中黑名单进程后是否尝试强制关闭该软件及其子进程。 |
| `processBlacklist` | 黑名单进程列表，命中后会锁定考试；如果 `terminateBlacklistedProcesses` 为 `true`，还会调用 Windows `taskkill /F /T /IM` 尝试关闭违规软件。 |

常见配置场景：

局域网服务器：

```json
{
  "serverBaseUrl": "http://YOUR_SERVER_IP"
}
```

云服务器：

```json
{
  "serverBaseUrl": "https://YOUR_DOMAIN"
}
```

开发调试时不改配置，也可以临时覆盖地址：

```powershell
npm run start:dev -- --oj-url=http://localhost
```

## 五、启动客户端

开发调试模式，不启用监考，适合自己检查页面和编辑器：

```powershell
cd <project-root>\client\oj-shell
npm run start:dev -- --oj-url=http://localhost
```

正式考试模式，默认启用全屏、置顶、剪贴板限制、失焦锁定和黑名单检测：

```powershell
cd <project-root>\client\oj-shell
npm start
```

快捷键：

- `F8`：显示或隐藏本地编辑器工具窗口。
- `Ctrl+L`：聚焦工具窗口中的 OJ 地址栏。
- 本地编辑器支持 `()`、`[]`、`{}`、`""`、`''` 自动补全，`Enter` 自动缩进，`Tab`/`Shift+Tab` 缩进或取消缩进，`Ctrl+/` 快捷注释或取消注释。

## 六、重新打包学生端

修改 `gyoj-shell.json` 或客户端代码后，重新打包：

```powershell
cd <project-root>\client\oj-shell
npm run dist:win
tar -a -cf .\dist\Hydro-Exam-Client-win-x64.zip -C .\dist\win-unpacked .
```

打包结果：

```text
client/oj-shell/dist/win-unpacked/Hydro Exam Client.exe
client/oj-shell/dist/Hydro-Exam-Client-win-x64.zip
```

给学生发 zip 包即可。不要只发单个 exe，因为内置 MinGW/g++ 和 Electron 运行文件都在 `win-unpacked` 目录中。

## 七、迁移旧 Hydro 数据

如果已有旧 Hydro OJ，可以迁移用户、题目、比赛、提交记录和测试数据。优先使用 Hydro 自带备份恢复：

```bash
hydrooj backup
hydrooj restore 备份文件路径
```

完整步骤见：

```text
docs/hydro-data-migration.md
```

迁移后要重点检查：

- 管理员能否登录。
- 用户、题目、比赛、提交记录是否存在。
- 测试数据是否恢复完整。
- 示例题是否能提交并评测。
- Hydro 的 Server BaseURL 是否改成新地址。

## 八、参考文档

- Hydro 官方文档：https://hydro.js.org/zh/docs/Hydro
- Hydro 安装文档：https://hydro.js.org/zh/docs/Hydro/install
- 数据迁移说明：`docs/hydro-data-migration.md`
