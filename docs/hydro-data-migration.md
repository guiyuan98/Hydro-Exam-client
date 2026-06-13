# Hydro 旧站数据迁移到新 OJ

本文用于把原有 Hydro OJ 的数据迁移到新的 Hydro OJ。推荐优先使用 Hydro 自带的 `hydrooj backup` / `hydrooj restore`，它会处理数据库和文件数据，比直接复制 MongoDB 数据目录更稳。

## 迁移内容

完整迁移通常包含：

- 用户、权限、域、题目、比赛、作业、训练、提交记录、讨论等数据库数据。
- 题目测试数据、附件、头像、文件存储等 `/data/file` 内容。
- 系统配置，例如站点 URL、邮件、存储、插件配置等。

如果只是从旧 Hydro 迁移到本项目部署的新 Hydro，一般走“完整备份恢复”即可。

## 迁移前检查

1. 旧站和新站尽量使用相同或接近的 Hydro 版本。新站版本更高时，恢复后让 Hydro 自动执行升级迁移。
2. 新站如果已经录入了题目、用户或比赛，恢复前先备份新站，因为恢复会覆盖或合并现有数据，可能造成冲突。
3. 迁移时尽量暂停旧站写入，避免备份过程中还有学生提交。
4. 备份文件不要只放在旧服务器本机，应复制到新服务器或外部硬盘。

## 方案一：Hydro 官方备份恢复

### 1. 在旧 Hydro 上备份

旧服务器执行：

```bash
hydrooj backup
```

命令完成后，当前目录会生成一个备份压缩包。建议立刻查看文件大小：

```bash
ls -lh *.zip *.tar *.tgz 2>/dev/null
```

如果旧 Hydro 也是 WSL 部署，可以在 Windows PowerShell 中执行：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; mkdir -p /root/hydro-backup; cd /root/hydro-backup; hydrooj backup; ls -lh"
```

### 2. 把备份复制到新服务器

Linux 服务器之间可以使用 `scp`：

```bash
scp hydro-backup-file.zip root@新服务器IP:/root/
```

如果旧站在 WSL 中，可以从 Windows 复制：

```powershell
Copy-Item "\\wsl$\Ubuntu-26.04-E\root\hydro-backup\hydro-backup-file.zip" "C:\Users\13456\Documents\GYOJ\backup\"
```

再复制到新 WSL：

```powershell
wsl -d Ubuntu-26.04-E -u root -- mkdir -p /root/hydro-restore
Copy-Item "C:\Users\13456\Documents\GYOJ\backup\hydro-backup-file.zip" "\\wsl$\Ubuntu-26.04-E\root\hydro-restore\"
```

### 3. 在新 Hydro 上恢复

恢复前建议停止 Hydro，避免恢复过程中有写入：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; pm2 stop hydrooj"
```

执行恢复：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; hydrooj restore /root/hydro-restore/hydro-backup-file.zip"
```

恢复完成后重启：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; pm2 restart all; pm2 list"
```

### 4. 恢复后检查

打开新站：

```text
http://localhost/
```

重点检查：

- 管理员能否登录。
- 用户数量、题目数量、比赛数量是否正确。
- 题目测试数据是否存在，能否重新提交并评测。
- 比赛榜单和提交记录是否能打开。
- 系统设置中的 `Server BaseURL` 是否改成新服务器地址，例如 `http://192.168.1.149/` 或公网域名。

## 方案二：手动迁移数据库和文件

只有在 `hydrooj backup` 不可用时再使用手动方案。

旧站备份 MongoDB：

```bash
mongodump --host 127.0.0.1 --port 27017 --out /root/hydro-mongodump
```

备份文件目录：

```bash
tar -czf /root/hydro-file.tar.gz /data/file
```

新站恢复 MongoDB：

```bash
mongorestore --host 127.0.0.1 --port 27017 --drop /root/hydro-mongodump
```

恢复文件目录：

```bash
tar -xzf /root/hydro-file.tar.gz -C /
```

再重启 Hydro：

```bash
pm2 restart all
```

注意：不要在 MongoDB 正在运行且仍有写入时直接复制 `/data/db`。直接复制数据库文件夹容易得到不一致的数据。

## 只导入题目，不迁移用户和提交

如果只想把旧站题目导入新站，不迁移用户、比赛和提交记录，建议在旧站导出题目包，再在新 Hydro 的题库页面导入。Hydro 支持常见题目包格式，具体以当前 Hydro 后台“题目导入”页面为准。

适用场景：

- 新站重新建用户和比赛。
- 只保留题面、测试数据、题解，不保留旧提交记录。
- 演示或正式新站上线时希望数据更干净。

## 常见问题

### 恢复后仍然显示旧域名

进入 Hydro 管理端，修改系统设置中的站点地址。也可以检查配置文件中的服务地址配置。

### 恢复后评测失败

先确认 `hydro-sandbox` 和 `hydrojudge` 在线：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; pm2 list"
```

再提交示例题测试。如果测试数据目录没有恢复完整，题目会无法正常评测。

### 恢复后管理员不是当前账号

可以重新把 UID 2 设置为超级管理员：

```powershell
wsl -d Ubuntu-26.04-E -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; hydrooj cli user setSuperAdmin 2; pm2 restart hydrooj"
```

如果旧站管理员 UID 不是 2，应在用户管理中确认实际 UID 后再执行。
