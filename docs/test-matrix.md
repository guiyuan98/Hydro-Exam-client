# 测试矩阵

| 编号 | 模块 | 操作 | 期望结果 |
| --- | --- | --- | --- |
| D-01 | Hydro 安装 | 执行 `deploy/install-hydro-wsl.ps1` | WSL 中安装 Hydro、MongoDB、Caddy、HydroJudge |
| D-02 | Hydro 启动 | 执行 `deploy/start-hydro-wsl.ps1` | PM2 中 `hydrooj`、`hydro-sandbox`、`mongodb`、`caddy` 在线 |
| D-03 | 本机访问 | 打开 `http://localhost/` | 显示中文 Hydro 首页 |
| D-04 | 超级管理员 | 登录 `admin / Admin@123456` | 可进入控制面板 |
| D-05 | 局域网发布 | 管理员运行 `deploy/publish-hydro-lan.ps1` | 学生机可访问 `http://192.168.1.149/` |
| C-01 | 客户端默认地址 | 解压发行包运行 `GYOJ Exam Client.exe` | 默认打开 `gyoj-shell.json` 中的 Hydro 地址 |
| C-02 | 开发调试 | `npm run start:dev -- --oj-url=http://localhost` | 不进入强监考，主窗口加载本机 Hydro |
| C-03 | 编辑器自动打开 | 启动客户端 | 本地 C++ 编辑器自动显示 |
| P-01 | 禁止复制 | 按 `Ctrl+C`、`Ctrl+V`、`Ctrl+X` | 快捷键被拦截，剪贴板被清空 |
| P-02 | 切屏检测 | 离开客户端窗口 | 显示考试锁定界面 |
| P-03 | 黑名单进程 | 打开配置中的黑名单程序 | 客户端锁定并提示命中进程 |
| P-04 | 教师解锁 | 输入教师密码 | 锁定界面关闭，回到考试 |
| L-01 | 本地样例 | 运行 A+B 默认样例 | 编译成功，输出 `3` |
| L-02 | 编译错误 | 输入错误 C++ 代码 | 输出编译错误 |
| L-03 | 运行超时 | 编写死循环 | 超时终止并显示超时状态 |
| R-01 | 远程判题 | 在 Hydro 页面提交代码 | 进入 Hydro 远程判题队列 |
| R-02 | OI 比赛 | 创建 OI 比赛并提交 | Hydro 返回 OI 分数和排名 |

