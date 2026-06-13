# Hydro OJ 部署说明

本目录用于把项目部署成“自己的 Hydro OJ + Windows 考试客户端”，不是打开 Hydro 官方演示站。Hydro 官方文档推荐 Linux 环境，安装脚本为：

```bash
LANG=zh . <(curl https://hydro.ac/setup.sh)
```

本项目在 Windows 上采用 WSL2 部署 Hydro，在 Windows 客户端里加载 Hydro 页面。

## 1. 安装 Hydro

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\install-hydro-wsl.ps1 -Distro Ubuntu-26.04-E
```

安装后检查：

```powershell
.\deploy\start-hydro-wsl.ps1
```

PM2 应显示 `hydrooj`、`hydro-sandbox`、`mongodb`、`caddy` 在线。本机访问：

```text
http://localhost/
```

## 2. 初始化超级管理员

如果是全新 Hydro，可执行：

```powershell
.\deploy\init-hydro-admin.ps1 `
  -Distro Ubuntu-26.04-E `
  -BaseUrl http://localhost `
  -Email guiyuan98@foxmail.com `
  -Username admin `
  -Password "Admin@123456"
```

也可以按 Hydro 官方提示：先在网页注册账号，再运行：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; hydrooj cli user setSuperAdmin 2; pm2 restart hydrooj"
```

## 3. 发布到局域网

WSL 内部服务默认能被 Windows 本机访问，但同一机房学生机要访问 `http://192.168.1.149/`，需要管理员权限建立端口代理：

```powershell
cd C:\Users\13456\Documents\GYOJ
.\deploy\publish-hydro-lan.ps1
```

这个脚本会把 Windows `0.0.0.0:80` 转发到 WSL 中的 Hydro `:80`，并添加 Windows 防火墙入站规则。

## 4. 客户端服务器地址

学生端配置文件：

```text
C:\Users\13456\Documents\GYOJ\client\oj-shell\gyoj-shell.json
```

关键字段：

```json
{
  "serverBaseUrl": "http://192.168.1.149",
  "language": "zh-CN",
  "editor": { "autoOpen": true },
  "proctor": { "enabled": true }
}
```

如果部署到云服务器，把 `serverBaseUrl` 改成你的公网域名或公网 IP，例如 `https://oj.example.com`。

## 5. 和考试客户端的关系

- Hydro 负责账号、题库、比赛、正式提交、隐藏数据判题和排名。
- `client/oj-shell` 负责全屏考试入口、本地 C++ 编辑器、样例运行、禁止复制粘贴、切屏锁定和违规提示。
- 隐藏测试数据只保存在 Hydro 服务端，客户端只运行题面样例和自定义样例。
