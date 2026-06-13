# Hydro 二次开发：OI 安全考试客户端

本项目把 [Hydro OJ](https://hydro.js.org/zh/docs/Hydro) 和 Windows 考试客户端合在一起，用于毕业设计和机房 OI 考试演示。学生打开客户端后默认进入正式考试模式，主窗口直接加载你的 Hydro 服务器，右侧自动打开本地 C++ 编辑器和样例运行器。

## 当前状态

- Hydro OJ 已安装到 WSL2 `Ubuntu-26.04-E`，PM2 中包含 `hydrooj`、`hydro-sandbox`、`mongodb`、`caddy`。
- 本机可访问 `http://localhost/`，Hydro 页面为中文。
- Hydro 超级管理员已创建：`admin / Admin@123456`，邮箱 `guiyuan98@foxmail.com`。
- 学生端默认服务器地址仍按局域网发布目标配置为 `http://192.168.1.149`。
- 局域网发布需要管理员权限运行 `deploy/publish-hydro-lan.ps1`，用于把 Windows 80 端口转发到 WSL Hydro。

## 目录

- `client/oj-shell/`：Electron 学生考试客户端，集成 Hydro 页面、本地 C++ 编辑器、样例运行、禁止复制粘贴、失焦锁定、进程黑名单。
- `deploy/`：Hydro WSL 安装、启动、管理员初始化和局域网发布脚本。
- `docs/`：接入说明、测试矩阵、客户端设计和毕业论文材料。
- `server/`：监考审计扩展的后续开发位置，Hydro 插件化改造见文档说明。

## 启动 Hydro

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\start-hydro-wsl.ps1
```

本机访问：

```text
http://localhost/
```

局域网发布需要管理员 PowerShell：

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\publish-hydro-lan.ps1
```

发布成功后学生机访问：

```text
http://192.168.1.149/
```

## 启动考试客户端

开发调试模式，不启用监考限制，并临时指向本机 Hydro：

```powershell
cd C:\Users\13456\Documents\GYOJ\client\oj-shell
npm run start:dev -- --oj-url=http://localhost
```

正式考试模式默认启用全屏、置顶、禁止复制粘贴、失焦锁定和黑名单进程检测：

```powershell
cd C:\Users\13456\Documents\GYOJ\client\oj-shell
npm start
```

学生发行包位置：

```text
C:\Users\13456\Documents\GYOJ\client\oj-shell\dist\Hydro-Exam-Client-win-x64.zip
```

学生解压后运行 `Hydro Exam Client.exe`，默认进入考试模式并打开 `http://192.168.1.149`。

## 重新打包

```powershell
cd C:\Users\13456\Documents\GYOJ\client\oj-shell
npm run dist:win
Compress-Archive -Path .\dist\win-unpacked\* -DestinationPath .\dist\Hydro-Exam-Client-win-x64.zip -Force
```

## 毕业论文主题

推荐题目：**《面向 OI 竞赛的在线评测系统安全考试客户端设计与实现》**。

论文表述建议：系统基于 Hydro OJ 提供题库、比赛、提交、排名和远程判题能力；Windows 客户端提供受控考试入口、本地样例测评和用户态监考。不要声称“绝对防作弊”，应表述为“在受控 Windows 机房、管理员权限和非内核级对抗条件下，提高切屏、复制粘贴、换机、换 IP 等行为的发现和阻断能力”。
