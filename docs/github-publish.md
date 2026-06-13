# 发布到 GitHub

当前机器没有检测到 GitHub CLI，也没有可用的 GitHub token，因此不能自动创建远程仓库。

推荐流程：

1. 在 GitHub 网页中新建仓库，例如：

   ```text
   hydro-exam-client
   ```

2. 复制仓库地址，例如：

   ```text
   https://github.com/你的用户名/hydro-exam-client.git
   ```

3. 在本项目根目录执行：

   ```powershell
   cd C:\Users\13456\Documents\GYOJ
   .\deploy\publish-github.ps1 -RemoteUrl https://github.com/你的用户名/gyoj-secure-client.git
   ```

如果 Git 弹出登录窗口，按提示登录 GitHub 即可。

## 发布前检查

已通过 `.gitignore` 排除：

- Qt 本地工具链 `.qt/`
- Python 安装工具 `.tools/`
- Qt 构建产物 `client/gyoj-client/build*/`
- Electron 依赖 `client/oj-shell/node_modules/`
- Electron 打包产物 `client/oj-shell/dist/`
  打包产物较大，不提交到 GitHub。需要发给学生时在本机生成 zip。

仓库中应保留：

- 源代码
- 配置模板
- 部署脚本
- 测试和运维文档
- `package-lock.json`
