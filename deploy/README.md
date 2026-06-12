# 自部署 QingdaoU OnlineJudge

本目录用于把项目部署成“自己的青岛 OJ”，而不是打开官方演示站。

官方部署方式是使用 `OnlineJudgeDeploy` 的 `2.0` 分支，并通过 Docker Compose 一键启动。当前上游公开标签最新仍是 `v1.6.1`，`2.0` 分支也指向该标签；如果你使用的是新版 fork 或新版分支，可以通过脚本参数替换部署来源。

```bash
git clone -b 2.0 https://github.com/QingdaoU/OnlineJudgeDeploy.git
cd OnlineJudgeDeploy
docker-compose up -d
```

本项目额外提供 PowerShell 脚本，便于在 Windows/服务器上统一初始化。

## 1. 前置条件

- 已安装 Docker Desktop 或 Linux Docker Engine。
- 已安装 Git。
- Windows 上建议开启 Docker Desktop 的 WSL2 后端。

当前这台机器没有检测到 `docker` 命令，所以这里暂时不能直接跑容器。

## 2. 一键拉取并启动

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\bootstrap-onlinejudge.ps1 -InstallDir C:\OJ\OnlineJudgeDeploy -PublicHost http://127.0.0.1
```

使用指定新版仓库或分支：

```powershell
.\deploy\bootstrap-onlinejudge.ps1 `
  -InstallDir C:\OJ\OnlineJudgeDeploy `
  -PublicHost http://192.168.1.149 `
  -DeployRepo https://github.com/你的新版部署仓库/OnlineJudgeDeploy.git `
  -DeployBranch main `
  -Update
```

启动后访问：

```text
http://127.0.0.1
```

当前这台服务器的局域网访问地址是：

```text
http://192.168.1.149
```

如果学生电脑无法访问，请用管理员权限打开 PowerShell 后执行：

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\open-server-firewall.ps1
```

如果部署到云服务器，把 `PublicHost` 改成你的域名或公网 IP，例如：

```powershell
.\deploy\bootstrap-onlinejudge.ps1 -InstallDir C:\OJ\OnlineJudgeDeploy -PublicHost https://oj.example.com
```

然后把 `client/oj-shell/gyoj-shell.json` 里的 `serverBaseUrl` 改成同一个地址。

## 3. 初始化超级管理员

OJ 启动完成后执行：

```powershell
.\deploy\create-super-admin.ps1 -InstallDir C:\OJ\OnlineJudgeDeploy -Username admin -Password "Admin@123456" -Email admin@example.com
```

脚本会调用后端容器里的 `python3 manage.py inituser`。如果上游镜像命令有变化，可进入后端容器手工执行：

```bash
docker exec -it oj-backend /bin/sh
python3 manage.py inituser --username admin --password "Admin@123456" --action=reset
```

## 4. 中文界面

客户端会默认设置 `Accept-Language: zh-CN,zh;q=0.9`，并在页面加载后尝试写入常见前端语言配置到 `localStorage`。

如果已有用户仍显示英文，在 OJ 个人设置中把语言改为中文；也可以在数据库中把已有用户语言字段更新为 `zh-CN`，具体字段名以当前上游版本为准。

## 5. 和考试客户端的关系

- OJ 服务端负责用户、题库、比赛、正式提交、隐藏数据判题、排名。
- `client/oj-shell` 负责全屏考试入口、本地 C++ 编辑器、样例运行、禁止复制粘贴、切屏锁定、违规提示。
- 正式隐藏测试数据不进入客户端，仍由远程 JudgeServer/Judger 判题。
