# 服务器网站部署手册 v3

> 服务器: 81.70.168.55 (SSH alias: `tengxun2c2g`, user: `ubuntu`) | 系统: Ubuntu 22.04 | nginx 共享
> 文档位置: `~/SERVER_DEPLOY_GUIDE.md` | 项目登记: `~/SERVER_PROJECTS.md`
> 最后更新: 2026-07-13

## 0. 文档目的 & 范围

- **唯一权威**：本服务器所有项目的部署、迁移、维护规范以本手册为准。
- **多 agent 共享**：后续每个项目可能有独立 agent 维护本服务器，所有 agent 必须在改动前**读完本手册**，改动后**同步更新本手册 + SERVER_PROJECTS.md**。
- **配套工具**：
  - `/opt/server-doctor/server-doctor.sh` — 合规检查（必跑）
  - `~/deploy.sh` — 通用部署脚本（新项目用）
  - `~/.acme.sh/acme.sh` — 证书自动续期

## 目录

- §1 标准目录结构
- §2 进程管理（systemd 强制）
- §3 前端托管策略
- §4 端口分配规则
- §5 域名 + 证书（acme.sh 强制）
- §6 备份策略
- §7 自动化工具
- §8 Agent 协议（强制）
- §9 新项目部署 SOP
- §10 日常维护 SOP
- §11 故障排查
- §12 当前项目状态
- §13 变更记录

---

## 1. 标准目录结构

服务器根：`/home/ubuntu/`，每个项目单独一个目录。

```text
/home/ubuntu/<project-name>/
├── frontend/                  # 前端
│   └── dist/                  # 构建产物（nginx 直接托管）
├── backend/                   # 后端
│   ├── pocketbase             # PB 可执行文件（PB 项目）
│   ├── pb_data/               # PB 数据
│   ├── pb_hooks/              # PB Go hooks（可选）
│   └── pb_migrations/         # PB 迁移脚本
└── README.md                  # 项目说明（可选）
```

**硬性要求**：
- 目录名建议用域名去 TLD（如 `geo.fulianli.top`），便于一眼对应。
- `frontend/` 和 `backend/` 命名固定，**禁止** `web/` `app/` `dist/` `pocketbase/` 等历史命名。
- 前端**只放 `dist/`**（构建产物）。源码、`.env`、`node_modules` 都不应该在这里。
- PB 二进制必须 `backend/pocketbase`，不能是 `pocketbase_linux` 之类。

---

## 2. 进程管理（systemd 强制）

**所有长驻服务必须用 systemd**。禁止 nohup / 直挂 PID 1 / tmux / screen。

### 2.1 PocketBase 模板

路径：`/etc/systemd/system/pocketbase-<name>.service`

```ini
[Unit]
Description=PocketBase <name>
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/<name>/backend
ExecStart=/home/ubuntu/<name>/backend/pocketbase serve --http=0.0.0.0:<PORT>
Restart=always
RestartSec=5
User=ubuntu
Group=ubuntu
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable pocketbase-<name>.service
sudo systemctl start pocketbase-<name>.service
```

### 2.2 Node 模式（必须 Node 时）

`/etc/systemd/system/node-<name>.service`：

```ini
[Unit]
Description=Node frontend <name>
After=network.target pocketbase-<name>.service

[Service]
Type=simple
WorkingDirectory=/home/ubuntu/<name>/frontend
ExecStart=/bin/bash -lc '<cmd>'      # 例: npm start
Restart=always
RestartSec=5
User=ubuntu
Group=ubuntu
Environment=NODE_ENV=production
Environment=PORT=<NODE_PORT>

[Install]
WantedBy=multi-user.target
```

### 2.3 日志：只用 journald

```bash
sudo journalctl -u pocketbase-<name>.service -n 200 --no-pager
sudo journalctl -u pocketbase-<name>.service -f
```

**禁止**往项目目录写 `*.log`、往 `/tmp` 写日志（重启即丢、污染备份）。

### 2.4 命名规范

- `pocketbase-<name>.service` — 所有 PB 服务
- `node-<name>.service` — 所有 Node 前端服务
- `<name>` 用项目名（域名去 TLD），不要含 `.`

---

## 3. 前端托管策略

| 场景 | 推荐 | 进程开销 |
|------|------|---------|
| **纯静态 SPA** (Vite/Webpack 输出 dist) | **nginx 直接 try_files 托管** | 0 |
| Vite preview (开发) | nginx 反代 4173 | 1 |
| Next.js / Nuxt SSR | Node 进程 + nginx 反代 | 1 |
| 自研 Node 服务 (serve.mjs) | ⚠️ 不推荐，改静态托管 | 1 |

**默认走 static**。能用 `vite build` 输出 dist 的，就别起 Node 进程。

---

## 4. 端口分配规则

### 4.1 范围

| 类型 | 范围 | 说明 |
|------|------|------|
| **PocketBase** | 8085 ~ 8099 | 8085 是历史占用；新项目从 **8091** 起递增 |
| **前端 Node** | 5173 ~ 5199 | 仅在必须 Node 时分配 |
| **frp 内网穿透** | 8080 ~ 8099 | 详见 frp 项目 |
| **其他** | 80 / 443 (nginx) | 全局 |

### 4.2 分配原则

1. **新项目前先查最大已用端口**：

   ```bash
   ss -tlnp | grep -E ':80(8[5-9]|9[0-9])\s'
   ```
2. **分配后立即更新** `SERVER_PROJECTS.md` 的端口总览表。
3. **禁止复用**已分配端口（项目彻底下线 + 登记变更后才能复用）。

### 4.3 当前端口总览（详见 SERVER_PROJECTS.md）

| 端口 | 服务 | 项目 |
|------|------|------|
| 80 / 443 | nginx | 全局 |
| 5173 / 5174 | next dev | frp 内网穿透目标 |
| 5176 | ~~serve.mjs~~ | ~~voice-community~~（已改静态托管） |
| 8085 | PocketBase | geo.fulianli.top |
| 8086 | PocketBase | voice.fulianli.top |
| 8081 | frp | weixinpay-test |
| 8090 | frp | 微信支付回调（**注意：与 dev.offernotes.cn PB 端口冲突，按 frp 优先处理**） |
| 8097 | PocketBase | neontalk（开发中） |

> **可用端口池**：8087、8088、8089、8091~8096、8098、8099

---

## 5. 域名 + 证书（acme.sh 强制）

### 5.1 域名规范

- 一个域名 = 一个 nginx 站点：`/etc/nginx/sites-enabled/<domain>.conf`
- 所有站点必须 HTTP 301 → HTTPS（见 §7 模板）
- 每个站点必须有 `/healthz` 端点（LB / 监控用）

### 5.2 证书：强制 acme.sh

**禁止**再手动管理证书。统一用 acme.sh 自动续期。

#### 安装（一次，全局）

```bash
curl https://get.acme.sh | sh -s email=admin@fulianli.top
source ~/.bashrc
# acme.sh 安装到 ~/.acme.sh/acme.sh，自动加 cron
```

#### 申请新证书

```bash
# DNS 验证（推荐，支持泛域名）
export Ali_Key="..."       # 阿里云 DNS API（在阿里云后台创建）
export Ali_Secret="..."

acme.sh --issue -d <domain> -d '*.<domain>' --dns dns_aliyun

# 安装到 nginx 目录（路径固定：/etc/nginx/certs/<domain>/）
acme.sh --install-cert -d <domain> \
  --cert-file       /etc/nginx/certs/<domain>/cert.pem \
  --key-file        /etc/nginx/certs/<domain>/key.pem \
  --fullchain-file  /etc/nginx/certs/<domain>/fullchain.pem \
  --reloadcmd       "sudo nginx -s reload"
```

**路径硬性要求**：

```text
/etc/nginx/certs/<domain>/
├── fullchain.pem    # nginx ssl_certificate 用
├── key.pem          # nginx ssl_certificate_key 用
├── cert.pem         # 单独证书（备用）
└── ca.cer           # CA bundle（备用）
```

#### 自动续期

acme.sh 自带 cron（每天 0 点检查），到期前 30 天自动续期 + reload nginx。

```bash
# 查看所有证书状态
~/.acme.sh/acme.sh list

# 手动触发续期
~/.acme.sh/acme.sh --renew -d <domain> --force
```

### 5.3 nginx 站点配置模板

deploy.sh 会自动生成，结构如下（详见 §7.2）：

```nginx
# HTTP → HTTPS + healthz
server {
    listen 80;
    server_name <domain>;
    location = /healthz { return 200 "ok\n"; add_header Content-Type text/plain; }
    location / { return 301 https://$host$request_uri; }
}

# HTTPS
server {
    listen 443 ssl;
    server_name <domain>;
    ssl_certificate     /etc/nginx/certs/<domain>/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/<domain>/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    client_max_body_size 50M;
    # /api/ → PB; /_/ → PB admin; / → 静态或反代
}
```

---

## 6. 备份策略

| 数据 | 备份方式 | 频率 | 保留 |
|------|---------|------|------|
| PocketBase (`pb_data/`) | `tar czf` 到 `/home/ubuntu/backups/<name>/` | 每日 cron 02:00 | 7 天 |
| 前端 `dist/` | 不备份（可从仓库重建） | - | - |
| nginx 站点配置 | git 仓库存档 | 每次改 | 永久 |
| 证书 | acme.sh 自管（不备份） | - | - |

### 6.1 备份脚本

`/home/ubuntu/backups/pb_backup.sh`（由 agent 部署时**必须**安装）：

```bash
#!/bin/bash
# 自动遍历所有 /home/ubuntu/*/backend/pb_data 目录
set -e
DATE=$(date +%Y%m%d)
BACKUP_DIR=/home/ubuntu/backups
mkdir -p "$BACKUP_DIR"

for proj_dir in /home/ubuntu/*/; do
    name=$(basename "$proj_dir")
    src="$proj_dir/backend/pb_data"
    [ -d "$src" ] || continue
    tar czf "$BACKUP_DIR/${name}_pb_${DATE}.tar.gz" -C "$src" . 2>/dev/null || true
    # 清理 7 天前
    find "$BACKUP_DIR" -name "${name}_pb_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
done
```

### 6.2 备份 cron

```bash
# 每日 02:00 跑
0 2 * * * /home/ubuntu/backups/pb_backup.sh >> /home/ubuntu/backups/cron.log 2>&1
```

### 6.3 恢复

```bash
# 1. 停止 PB
sudo systemctl stop pocketbase-<name>.service
# 2. 解压
rm -rf /home/ubuntu/<name>/backend/pb_data
mkdir -p /home/ubuntu/<name>/backend/pb_data
tar xzf /home/ubuntu/backups/<name>_pb_<DATE>.tar.gz -C /home/ubuntu/<name>/backend/pb_data
# 3. 启动
sudo systemctl start pocketbase-<name>.service
```

---

## 7. 自动化工具

### 7.1 server-doctor.sh（合规检查）

路径：`/opt/server-doctor/server-doctor.sh`（所有用户可读，root 可写）

```bash
# 全量扫描
/opt/server-doctor/server-doctor.sh

# 单个项目
/opt/server-doctor/server-doctor.sh --project <name>

# JSON 输出（agent 用）
/opt/server-doctor/server-doctor.sh --json

# 只看失败项
/opt/server-doctor/server-doctor.sh --quiet

# 自动修复部分项目（如缺 frontend/ backend/）
/opt/server-doctor/server-doctor.sh --fix <name>
```

**检查项**（每项 0=ok / 10=warn / 20=fail）：
1. 目录结构（必须 `frontend/` + `backend/`）
2. systemd unit（必须存在 + enabled + active）
3. 日志统一（项目内不能有 `*.log`）
4. nginx 站点（必须能反查到项目）
5. SSL 证书（必须有效，>30 天）
6. 端口监听（PB 端口必须被 PB 占用）
7. orphan 进程（无 nohup 残留）
8. 文档登记（必须出现在 `SERVER_PROJECTS.md`）

### 7.2 deploy.sh（标准部署）

路径：`~/deploy.sh`

```bash
sudo ~/deploy.sh \
  --name <project-name> \
  --domain <domain.com> \
  --pb-port <port> \
  [--mode static|node] \
  [--node-port <port>] \
  [--node-cmd "<cmd>"]
```

`deploy.sh` 会自动：
1. 前置检查（路径、证书、端口）
2. 写 systemd unit
3. 写 nginx 站点（HTTP+HTTPS，反代 PB `/api/` `/_/`，前端按 mode 选静态/反代）
4. 启动 + reload
5. 端到端验证
6. 提示更新 `SERVER_PROJECTS.md`

### 7.3 acme.sh（证书管理）

```bash
# 申请 + 安装
~/.acme.sh/acme.sh --issue -d <domain> -d '*.<domain>' --dns dns_aliyun
~/.acme.sh/acme.sh --install-cert -d <domain> \
  --cert-file       /etc/nginx/certs/<domain>/cert.pem \
  --key-file        /etc/nginx/certs/<domain>/key.pem \
  --fullchain-file  /etc/nginx/certs/<domain>/fullchain.pem \
  --reloadcmd       "sudo nginx -s reload"

# 列表 / 续期
~/.acme.sh/acme.sh list
~/.acme.sh/acme.sh --renew -d <domain> --force
```

---

## 8. Agent 协议（强制）

**所有 agent 修改本服务器前，必须遵守本协议。**

### 8.1 启动前必读

agent 在执行任何写操作前，必须先 `cat ~/SERVER_DEPLOY_GUIDE.md` 和 `cat ~/SERVER_PROJECTS.md`，理解当前所有项目状态。

### 8.2 改动前必跑

```bash
/opt/server-doctor/server-doctor.sh
```

确认改动前全量合规（或记录已有警告基线）。

### 8.3 改动中必守

- 严格按本手册 §1-§6 规范操作。
- 不创造新的目录命名、端口范围、进程管理方式。
- **绝不在**已运行的项目上做"实验性改动"。要改就先在本手册登记方案。

### 8.4 改动后必做

1. **跑 server-doctor** 确认没引入新警告：
   ```bash
   /opt/server-doctor/server-doctor.sh
   ```
2. **更新 `SERVER_PROJECTS.md`**：新增/修改/下线项目，必须改登记表。
3. **更新本手册**：如改了规范、新增了工具、修改了流程，必须在 §13 变更记录登记。
4. **跑备份**：
   ```bash
   /home/ubuntu/backups/pb_backup.sh
   ```

### 8.5 跨项目隔离

- 改 A 项目时**绝不能**误停 B 项目的 systemd 服务。
- 改 nginx 前必须 `nginx -t`，reload 后**验证其他域名仍可访问**。
- 改 systemd 前先 `systemctl list-units --type=service | grep -v 'pocketbase-\|node-'` 看清楚。

### 8.6 危险操作清单（必须先报告人类）

- 删项目目录 / 删数据库 / 删证书
- `rm -rf` / `git reset --hard` / `nginx -s stop` 之外的批量 kill
- 任何会影响其他在线项目的操作
- 改 SSH 端口 / 改 sudoers

---

## 9. 新项目部署 SOP（agent 必须按此走）

```text
1. 读本手册（§0-§7）+ cat ~/SERVER_PROJECTS.md
2. 选端口：ss -tlnp 查最大已用，从 8091 起递增
3. 申请证书：acme.sh --issue + --install-cert
4. 上传项目：scp / git clone 到 /home/ubuntu/<name>/
5. 改属主：sudo chown -R ubuntu:ubuntu /home/ubuntu/<name>/
6. 跑 deploy.sh：sudo ~/deploy.sh --name ... --domain ... --pb-port ...
7. 更新登记：编辑 ~/SERVER_PROJECTS.md
8. 跑检查：/opt/server-doctor/server-doctor.sh --project <name>
9. 跑备份：/home/ubuntu/backups/pb_backup.sh
10. 报告：给人类一份变更总结（项目名/端口/域名/标准化状态）
```

---

## 10. 日常维护 SOP

### 10.1 每周一次

```bash
/opt/server-doctor/server-doctor.sh            # 标准化检查
~/.acme.sh/acme.sh list                        # 证书状态
df -h | grep ubuntu                             # 磁盘
systemctl list-failed                           # 失败的服务
```

### 10.2 每月一次

```bash
journalctl --disk-usage                         # journald 日志占用
ls -lh /home/ubuntu/backups/                    # 备份存量
```

### 10.3 服务异常排查

```bash
# PB 起不来
sudo journalctl -u pocketbase-<name>.service -n 100 --no-pager
ss -tlnp | grep :<port>                         # 看端口被谁占

# 502
sudo nginx -t                                   # nginx 配置语法
systemctl status pocketbase-<name>.service      # PB 状态
curl -v http://127.0.0.1:<port>/api/health      # 直连 PB

# 证书即将过期
~/.acme.sh/acme.sh list
~/.acme.sh/acme.sh --renew -d <domain> --force
```

---

## 11. 故障排查

| 症状 | 优先排查 | 命令 |
|------|---------|------|
| 502 Bad Gateway | PB 是否在跑、端口是否对 | `systemctl status pocketbase-<name>` + `ss -tlnp` |
| 证书过期 | acme.sh cron 是否在跑 | `crontab -l \| grep acme` + `~/.acme.sh/acme.sh list` |
| 磁盘满 | journald、备份 | `journalctl --disk-usage` + `du -sh /home/ubuntu/backups/*` |
| systemd 启动失败 | journalctl | `journalctl -u <svc> -n 50 --no-pager` |
| nginx reload 报错 | 语法 | `nginx -t` |
| 项目目录属主错 | chown | `ls -la /home/ubuntu/<name>/` |

---

## 12. 当前项目状态

详见 `~/SERVER_PROJECTS.md`（每项标 ✅ 标准 / ⚠️ 部分 / ❌ 不符）。

---

## 13. 变更记录

- **2026-07-13 v3**：全面 agent 化重构。
  - 加入 §7 自动化工具（server-doctor、deploy.sh、acme.sh）
  - 加入 §8 Agent 协议（强制）
  - 加入 §9 新项目部署 SOP
  - 证书强制 acme.sh（§5.2）
  - 备份强制 cron（§6）
  - 加入 §10 维护 SOP、§11 故障排查
- 2026-07-13 v2：明确目录结构、systemd、端口分配规则。
- 2026-04-16 v1：初次建立。
