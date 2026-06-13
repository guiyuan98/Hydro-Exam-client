# Hydro OJ 接入指南

本项目当前服务端底座改为 Hydro OJ。学生端不仿制 OJ 页面，而是在 Electron 主窗口中直接加载自部署 Hydro 页面；右侧本地工具窗口提供 C++ 编辑器和样例运行。

## 技术依据

- Hydro 官方文档：https://hydro.js.org/zh/docs/Hydro
- Hydro 安装文档：https://hydro.js.org/zh/docs/Hydro/install

Hydro 提供题库、比赛、提交、排名、沙箱判题、插件扩展和多种题目导入能力，适合作为本项目的 OJ 服务端底座。

## 本机部署结果

- WSL 发行版：`Ubuntu-26.04-E`
- Hydro：`hydrooj@5.0.3`
- Judge：`@hydrooj/hydrojudge@4.0.4`
- 本机地址：`http://localhost/`
- 局域网目标地址：`http://192.168.1.149/`
- 管理员：`admin / Admin@123456`

## 学生端接入

`client/oj-shell/gyoj-shell.json` 中的 `serverBaseUrl` 是学生进入考试后的默认 OJ 地址：

```json
{
  "serverBaseUrl": "http://192.168.1.149"
}
```

正式考试启动：

```powershell
cd C:\Users\13456\Documents\GYOJ\client\oj-shell
npm start
```

调试启动：

```powershell
npm run start:dev -- --oj-url=http://localhost
```

## 默认考试限制

- 全屏置顶和 kiosk 模式。
- 右键菜单禁用。
- 拦截 `Ctrl+C`、`Ctrl+V`、`Ctrl+X`、`Alt+Tab`、`PrintScreen` 等常见快捷键。
- 定时清空剪贴板。
- 离开客户端后锁定考试。
- 检测黑名单进程，如浏览器、聊天软件、外部 IDE、远程控制工具。
- 教师输入解锁密码后恢复。

## 后续 Hydro 插件方向

后续建议把监考审计扩展做成 Hydro 插件，而不是 Django 应用。插件模型建议包含：

- `ExamPolicy`：考试策略，记录是否必须使用客户端、是否禁用复制粘贴、心跳超时、进程黑名单、网络白名单。
- `ExamSession`：学生考试会话，记录用户、比赛、机器指纹、IP、客户端版本、最近心跳、锁定状态。
- `ProctorEvent`：违规事件，记录切屏、复制粘贴、进程命中、IP 变化、教师解锁。

客户端通过 Hydro 插件 API 上报心跳和违规事件，Hydro 管理端提供监考看板。
