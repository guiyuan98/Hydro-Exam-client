# QingdaoU OnlineJudge 二次开发接入指南

## 目标

本项目不是打开 QingdaoU 官方演示站，而是部署一套属于自己的 OnlineJudge，并使用桌面考试客户端作为入口。

最终结构：

- `OnlineJudgeDeploy`：部署 OJ 服务端、前端、数据库、Redis、JudgeServer。
- `server/onlinejudge_proctoring`：后端监考审计扩展。
- `client/oj-shell`：考试客户端，主窗口直接加载自己的 OJ 页面。
- 内置 MinGW/g++：提供本地样例编译运行。

## 部署 OJ

官方推荐使用 `OnlineJudgeDeploy` 的 `2.0` 分支。当前上游公开标签最新仍是 `v1.6.1`；如果你要使用新版 fork 或新版分支，可以把 `DeployRepo`、`DeployBranch` 换成对应来源。

```powershell
git clone -b 2.0 https://github.com/QingdaoU/OnlineJudgeDeploy.git C:\OJ\OnlineJudgeDeploy
cd C:\OJ\OnlineJudgeDeploy
docker compose up -d
```

本项目封装了脚本：

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\bootstrap-onlinejudge.ps1 -InstallDir C:\OJ\OnlineJudgeDeploy -PublicHost http://127.0.0.1
```

指定新版来源：

```powershell
.\deploy\bootstrap-onlinejudge.ps1 `
  -InstallDir C:\OJ\OnlineJudgeDeploy `
  -PublicHost http://192.168.1.149 `
  -DeployRepo https://github.com/你的新版部署仓库/OnlineJudgeDeploy.git `
  -DeployBranch main `
  -Update
```

## 初始化超级管理员

```powershell
.\deploy\create-super-admin.ps1 -InstallDir C:\OJ\OnlineJudgeDeploy -Username admin -Password "Admin@123456"
```

初始化后访问：

```text
http://127.0.0.1
```

登录 `admin / Admin@123456`，进入管理后台创建题目、比赛和用户。

## 配置客户端连接自己的 OJ

编辑：

```text
client/oj-shell/gyoj-shell.json
```

本机部署：

```json
{
  "serverBaseUrl": "http://127.0.0.1"
}
```

机房局域网部署时，学生端不能使用 `127.0.0.1`，必须使用服务器局域网 IP，例如当前服务器：

```json
{
  "serverBaseUrl": "http://192.168.1.149"
}
```

云服务器部署：

```json
{
  "serverBaseUrl": "https://你的域名"
}
```

## 启动考试客户端

正式考试模式：

```powershell
cd C:\Users\13456\Documents\GYOJ\client\oj-shell
npm start
```

开发调试模式，不启用锁屏和剪贴板清理：

```powershell
npm run start:dev
```

## 默认考试限制

正式模式默认启用：

- 全屏。
- 置顶。
- 自动打开本地 C++ 编辑器。
- 禁止右键菜单。
- 拦截 `Ctrl+C`、`Ctrl+V`、`Ctrl+X`、`Shift+Insert`。
- 周期性清空剪贴板。
- 失焦/切屏后显示锁定界面。
- 检测黑名单进程并锁定。
- 教师使用配置中的密码解锁。

## 后端监考模块接入

将：

```text
server/onlinejudge_proctoring
```

复制到 OnlineJudge 后端工程，加入 Django `INSTALLED_APPS`，并挂载路由：

```python
url(r"^api/proctoring/", include("onlinejudge_proctoring.urls")),
```

迁移数据库：

```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

第一版可先使用 Django Admin 管理 `ExamPolicy`、`ExamSession`、`ProctorEvent`。
