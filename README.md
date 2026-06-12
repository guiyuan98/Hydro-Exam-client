# GYOJ 强监考 OI 客户端毕业设计原型

本项目用于对 QingdaoU/OnlineJudge 进行二次开发，目标不是打开官方演示站，而是部署一套自己的中文 OnlineJudge，并提供一个 Windows 考试客户端。

## 项目目标

- 从零部署 QingdaoU OnlineJudge。
- 你作为超级管理员登录自己的 OJ，创建题目、比赛和用户。
- 学生打开桌面软件后，主界面就是你的 OJ 页面，效果和浏览器打开青岛 OJ 一致。
- 客户端默认自动打开本地 C++ 编辑器和样例运行器。
- 正式提交仍走远程 OJ 判题，隐藏测试数据不进入客户端。
- 客户端默认启用禁止切屏、禁止复制粘贴、剪贴板清空、黑名单进程检测和教师解锁。
- 项目可作为毕业论文《面向 OI 竞赛的在线评测系统安全考试客户端设计与实现》的工程基础。

## 目录结构

- `deploy/`：自部署 OnlineJudge 的 PowerShell 脚本和说明。
- `client/oj-shell/`：当前主客户端，Electron 实现，主窗口直接加载你的 OJ。
- `client/gyoj-client/`：早期 Qt/C++ 原型，保留作参考。
- `server/onlinejudge_proctoring/`：OnlineJudge 后端监考审计扩展原型。
- `docs/`：接入说明、客户端设计、测试矩阵、论文大纲和论文初稿。

## 先部署自己的 OJ

当前机器没有检测到 Docker，因此不能在这里直接启动 OJ 容器。安装 Docker Desktop 后执行：

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\bootstrap-onlinejudge.ps1 -InstallDir C:\OJ\OnlineJudgeDeploy -PublicHost http://127.0.0.1
.\deploy\create-super-admin.ps1 -InstallDir C:\OJ\OnlineJudgeDeploy -Username admin -Password "Admin@123456"
```

然后访问：

```text
http://127.0.0.1
```

## 启动考试客户端

正式考试模式，默认启用监考限制：

```powershell
cd C:\Users\13456\Documents\GYOJ\client\oj-shell
npm install
npm start
```

打包给学生使用的 Windows 文件夹版：

```powershell
cd C:\Users\13456\Documents\GYOJ\client\oj-shell
npm run dist:win
```

生成目录位于：

```text
client/oj-shell/dist/win-unpacked/
```

学生运行里面的 `GYOJ Exam Client.exe` 后默认就是正式考试模式，会直接打开 `http://192.168.1.149`。不要优先使用单 exe 便携包，因为内置 MinGW 后首次解压会很慢。

开发调试模式，不锁屏、不清空剪贴板：

```powershell
npm run start:dev
```

默认配置文件：

```text
client/oj-shell/gyoj-shell.json
```

默认学生端 OJ 地址是：

```text
http://192.168.1.149
```

这是当前服务器的局域网 IP。学生电脑必须和服务器在同一网络内才能访问。若部署到云服务器，把 `serverBaseUrl` 改成你的域名或公网 IP。

## 论文材料

- 论文大纲：[docs/thesis-outline.md](docs/thesis-outline.md)
- 论文初稿：[docs/thesis-draft.md](docs/thesis-draft.md)
- 测试矩阵：[docs/test-matrix.md](docs/test-matrix.md)

## 安全边界

本系统适用于受控 Windows 机房、管理员权限客户端和非内核级对抗场景。论文中建议表述为“提高发现和阻断切屏、复制、换机、换 IP 等行为的能力”，不要宣称“绝对防作弊”。
