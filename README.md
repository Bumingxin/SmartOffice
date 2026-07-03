# SmartOffice

SmartOffice 是 OpenClaw 的 Web 客户端 / 控制台。

## 🌟 核心亮点

- **🤖 多智能体，全 UI 界面配置**：支持多智能体快速创建与管理，通过全 UI 可视化界面完成所有配置逻辑，告别手动修改 JSON 和 Markdown 文件。
- **📉 独立模型配置 & 节约 Token**：每个智能体可独立配置不同模型，结合完全隔离的 Workspace 和独立配置文件，精准控制模型分流，减少背景重叠导致的 Token 浪费。
- **📱 移动端优化**：适配移动端屏幕与交互逻辑，适合手机和平板使用。

---

## 🚀 快速安装

默认安装目录为 `~/SmartOffice`，默认服务端口为 `3456`。

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Bumingxin/SmartOffice/main/install.sh)
```

指定端口安装，例如 `8080`：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Bumingxin/SmartOffice/main/install.sh) 8080
```

安装完成后访问：

```text
http://服务器IP:3456
```

---

## 🔄 更新 / 重新部署

### 推荐方式：使用部署脚本

当代码已经更新到服务器后，执行：

```bash
cd ~/SmartOffice
chmod +x deploy-release.sh
./deploy-release.sh 3456
```

如果使用的是其他端口，例如 `8080`：

```bash
cd ~/SmartOffice
./deploy-release.sh 8080
```

该命令会自动执行：

- 安装 / 更新依赖
- 构建前端和后端
- 写入 systemd 用户服务
- 重启 SmartOffice 服务
- 尝试重启 OpenClaw gateway

### 从 GitHub 强制同步并更新

如果服务器上是 Git 仓库部署，并希望强制同步 `main` 分支：

```bash
cd ~/SmartOffice
chmod +x update.sh
./update.sh 3456
```

注意：`update.sh` 会执行 `git reset --hard origin/main` 和 `git clean -fd`，会丢弃服务器源码目录中的本地未提交改动。

---

## 🛠️ 手动构建

如果只想手动安装依赖并构建：

```bash
cd ~/SmartOffice
npm install --include=dev
cd backend && npm install --include=dev && cd ..
cd frontend && npm install --include=dev && cd ..
npm run build
```

仅构建前端：

```bash
cd ~/SmartOffice/frontend
npm install --include=dev
npm run build
```

仅构建后端：

```bash
cd ~/SmartOffice/backend
npm install --include=dev
npm run build
```

类型检查 / 编译检查：

```bash
cd ~/SmartOffice
npm run test
```

分别检查：

```bash
cd ~/SmartOffice/backend && npm run test
cd ~/SmartOffice/frontend && npm run test
```

---

## 🧩 systemd 服务运维命令

部署脚本默认创建用户级 systemd 服务，服务名格式为：

```text
clawui-端口.service
```

默认端口 `3456` 对应服务名：

```text
clawui-3456.service
```

### 查看服务状态

```bash
systemctl --user status clawui-3456.service
```

### 启动服务

```bash
systemctl --user start clawui-3456.service
```

### 停止服务

```bash
systemctl --user stop clawui-3456.service
```

### 重启服务

```bash
systemctl --user restart clawui-3456.service
```

### 重新加载 systemd 配置

修改服务文件后执行：

```bash
systemctl --user daemon-reload
```

### 设置开机 / 登录后自动运行

```bash
systemctl --user enable clawui-3456.service
```

### 取消自动运行

```bash
systemctl --user disable clawui-3456.service
```

### 查看服务日志

实时查看日志：

```bash
journalctl --user -u clawui-3456.service -f
```

查看最近 200 行日志：

```bash
journalctl --user -u clawui-3456.service -n 200 --no-pager
```

查看今天的日志：

```bash
journalctl --user -u clawui-3456.service --since today --no-pager
```

### 查看所有 SmartOffice 服务

```bash
systemctl --user list-units 'clawui-*'
```

### 查看服务文件位置

```bash
ls -l ~/.config/systemd/user/clawui-*.service
cat ~/.config/systemd/user/clawui-3456.service
```

---

## ▶️ 使用 start-all.sh 手动启动

如果没有使用 systemd，或者只想临时手动运行，可以使用：

```bash
cd ~/SmartOffice
bash start-all.sh
```

`start-all.sh` 会执行：

- 停止当前 `backend/dist/index.js` 进程
- 执行 `npm run build`
- 使用 `nohup node backend/dist/index.js` 后台启动服务
- 默认日志写入 `/tmp/clawui_back.log`

查看日志：

```bash
tail -f /tmp/clawui_back.log
```

查看端口监听：

```bash
ss -tlnp | grep ':3456'
```

手动停止 `start-all.sh` 启动的进程：

```bash
pkill -f "$HOME/SmartOffice/backend/dist/index.js"
```

注意：如果已经使用 `deploy-release.sh` 创建了 systemd 服务，推荐使用 systemd 命令管理，不建议同时使用 `start-all.sh`，避免多个进程抢占同一端口。

---

## 🌐 端口与访问地址

默认端口：

```text
3456
```

本机访问：

```text
http://localhost:3456
```

局域网访问：

```text
http://服务器IP:3456
```

查看本机 IP：

```bash
hostname -I
```

查看端口是否监听：

```bash
ss -tlnp | grep ':3456'
```

如果使用云服务器，请确认安全组 / 防火墙已放行端口。

Ubuntu UFW 示例：

```bash
sudo ufw allow 3456/tcp
sudo ufw status
```

---

## 🔁 修改代码后如何生效

### 推荐：使用 restart.sh 一键重建并重启

如果已经把最新文件更新到服务器，只想重新构建并让最新程序生效，可以执行：

```bash
cd ~/SmartOffice
chmod +x restart.sh
./restart.sh 3456
```

如果使用其他端口，例如 `8080`：

```bash
cd ~/SmartOffice
./restart.sh 8080
```

`restart.sh` 会自动安装缺失依赖、执行 `npm run build`、优先重启对应的 `clawui-端口.service`，如果 systemd 服务不存在则回退为 `nohup` 启动，并检查端口和 `/health`。

### 完整重新部署

如果需要重新安装依赖、刷新 systemd 服务文件、同步 OpenClaw 配置，可以执行完整部署脚本：

```bash
cd ~/SmartOffice
./deploy-release.sh 3456
```

然后浏览器强制刷新：

```text
Ctrl + F5
```

### 如果只改了后端代码

仍推荐使用 `restart.sh`：

```bash
cd ~/SmartOffice
./restart.sh 3456
```

### 如果只改了前端代码

仍推荐使用 `restart.sh`，因为前端需要重新构建，后端负责提供构建后的静态资源：

```bash
cd ~/SmartOffice
./restart.sh 3456
```

## 🧯 常见故障排查

### 1. 页面打不开

检查服务状态：

```bash
systemctl --user status clawui-3456.service
```

检查端口：

```bash
ss -tlnp | grep ':3456'
```

检查日志：

```bash
journalctl --user -u clawui-3456.service -n 200 --no-pager
```

### 2. 修改后页面没有变化

重新构建并重启：

```bash
cd ~/SmartOffice
./deploy-release.sh 3456
```

浏览器强制刷新：

```text
Ctrl + F5
```

必要时清理浏览器站点缓存。

### 3. 端口被占用

查看占用进程：

```bash
ss -tlnp | grep ':3456'
```

如果是旧的手动进程：

```bash
pkill -f "$HOME/SmartOffice/backend/dist/index.js"
```

然后重启服务：

```bash
systemctl --user restart clawui-3456.service
```

### 4. systemd 用户服务无法开机保持运行

启用 linger：

```bash
sudo loginctl enable-linger $(whoami)
```

检查：

```bash
loginctl show-user $(whoami) | grep Linger
```

### 5. OpenClaw gateway 异常

如果已安装 `openclaw` 命令，可以尝试：

```bash
openclaw gateway restart
```

或查看 OpenClaw 相关日志 / 状态：

```bash
openclaw gateway status
```

---

## 🧹 卸载

如果项目包含卸载脚本：

```bash
cd ~/SmartOffice
chmod +x uninstall.sh
./uninstall.sh 3456
```

也可以手动停止并禁用服务：

```bash
systemctl --user stop clawui-3456.service
systemctl --user disable clawui-3456.service
rm -f ~/.config/systemd/user/clawui-3456.service
systemctl --user daemon-reload
```

如需删除源码目录：

```bash
rm -rf ~/SmartOffice
```

---

## 📁 常用目录

项目源码：

```text
~/SmartOffice
```

后端构建产物：

```text
~/SmartOffice/backend/dist
```

前端构建产物：

```text
~/SmartOffice/frontend/dist
```

用户级 systemd 服务文件：

```text
~/.config/systemd/user/clawui-3456.service
```

手动启动日志：

```text
/tmp/clawui_back.log
```

