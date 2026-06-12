# 测试矩阵

| 编号 | 场景 | 操作 | 预期结果 |
| --- | --- | --- | --- |
| D-01 | Docker 环境 | 执行 `docker --version` | 能显示 Docker 版本 |
| D-02 | 从零部署 OJ | 执行 `deploy/bootstrap-onlinejudge.ps1` | 克隆 `OnlineJudgeDeploy` 并启动容器 |
| D-03 | 超级管理员初始化 | 执行 `deploy/create-super-admin.ps1` | 可用管理员账号登录自己的 OJ |
| D-04 | 中文环境 | 访问 OJ 首页和个人设置 | 默认或可切换为中文 |
| D-05 | 局域网访问 | 学生电脑访问 `http://192.168.1.149` | 能打开 OJ 首页 |
| D-06 | 防火墙 | 服务器管理员执行 `deploy/open-server-firewall.ps1` | Windows 防火墙允许 80/443 入站 |
| C-01 | 客户端默认地址 | 启动 `npm start` | 主窗口访问 `gyoj-shell.json` 中的 `serverBaseUrl` |
| C-02 | 编辑器自动打开 | 启动客户端 | 本地 C++ 编辑器窗口自动显示 |
| C-03 | 开发模式 | 执行 `npm run start:dev` | 不启用锁屏和剪贴板清理 |
| C-04 | 学生发行包 | 解压 `GYOJ-Student-Exam-Client-win-x64.zip` 并运行 `GYOJ Exam Client.exe` | 默认进入考试模式并打开服务器 OJ |
| P-01 | 全屏置顶 | 正式模式启动 | 主窗口全屏置顶 |
| P-02 | 复制粘贴限制 | 按 `Ctrl+C` / `Ctrl+V` / `Ctrl+X` | 快捷键被拦截，剪贴板被清空 |
| P-03 | 右键限制 | 在 OJ 页面右键 | 不显示右键菜单 |
| P-04 | 切屏检测 | 离开客户端窗口 | 显示考试锁定界面 |
| P-05 | 教师解锁 | 输入配置中的教师密码 | 锁定界面关闭，回到考试 |
| P-06 | 黑名单进程 | 打开浏览器、外部 IDE 或远控工具 | 客户端锁定并显示原因 |
| L-01 | 样例 AC | 运行 A+B 正确代码，输入 `1 2` | 输出 `3` |
| L-02 | 编译错误 | 运行语法错误代码 | 显示编译错误，不远程提交 |
| L-03 | 运行超时 | 运行死循环代码 | 超时终止并显示超时 |
| R-01 | 正式提交 | 在 OJ 页面提交代码 | 进入 OnlineJudge 远程判题队列 |
| R-02 | OI 分数 | 提交部分正确代码 | OJ 返回 OI 分数并更新排名 |
| S-01 | 监考会话 | 客户端接入后端监考 API | 服务端创建 `ExamSession` |
| S-02 | 违规上报 | 客户端发生锁定 | 服务端记录 `ProctorEvent` |
