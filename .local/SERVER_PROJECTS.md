# 服务器项目登记 v3

> 服务器: 81.70.168.55 (SSH alias: `tengxun2c2g`, user: `ubuntu`) | 系统: Ubuntu 22.04 | nginx 共享
> 配套手册: `~/SERVER_DEPLOY_GUIDE.md` v3
> 合规工具: `/opt/server-doctor/server-doctor.sh`
> 最后更新: 2026-07-13

末尾的 ✅/⚠️/❌ 表示**与 SERVER_DEPLOY_GUIDE.md v3 标准的符合度**。
✅ 完全符合 · ⚠️ 部分符合（已列差异）· ❌ 不符合（需迁移）· 🔁 frp 穿透（不需服务器进程）

---

## 项目列表

### 1. geo.fulianli.top ✅ 标准

| 项 | 值 |
|---|---|
| 域名 | geo.fulianli.top |
| 状态 | running |
| 路径 | /home/ubuntu/geo.fulianli.top |
| 子目录 | frontend/dist + backend |
| 技术栈 | 原生 JS + Vite（前端静态）+ PocketBase |
| 前端托管 | **nginx 静态**（无 Node 进程）|
| 后端端口 | 8085 (PocketBase) |
| 进程管理 | systemd: pocketbase-geo-fulianli-top.service |
| 日志 | journald |
| 证书 | /etc/nginx/certs/geo.fulianli.top/（手动 zip，**待切 acme.sh**）|
| nginx 站点 | /etc/nginx/sites-enabled/geo.fulianli.top.conf |
| systemd unit | /etc/systemd/system/pocketbase-geo-fulianli-top.service |
| 备份 | ✅ /home/ubuntu/backups/geo.fulianli.top_pb_*.tar.gz（每日 02:00 cron）|
| 标准化日期 | 2026-07-13 |

### 2. voice.fulianli.top ✅ 标准

| 项 | 值 |
|---|---|
| 域名 | voice.fulianli.top |
| 状态 | running |
| 路径 | /home/ubuntu/voice-community |
| 子目录 | frontend/dist + backend |
| 技术栈 | Vue3 + Vite + PocketBase |
| 前端托管 | **nginx 静态**（无 Node 进程）|
| 后端端口 | 8086 (PocketBase) |
| 进程管理 | systemd: pocketbase-voice-fulianli-top.service |
| 日志 | journald |
| 证书 | /etc/nginx/certs/voice.fulianli.top/（手动 zip，**待切 acme.sh**）|
| nginx 站点 | /etc/nginx/sites-enabled/voice.fulianli.top.conf |
| systemd unit | /etc/systemd/system/pocketbase-voice-fulianli-top.service |
| 备份 | ✅ /home/ubuntu/backups/voice-community_pb_*.tar.gz |
| 标准化日期 | 2026-07-13（从 serve.mjs + nohup 迁移到 systemd + nginx 静态）|

### 3. dev.offernotes.cn 🔁 frp 穿透（本地服务）

| 项 | 值 |
|---|---|
| 域名 | dev.offernotes.cn |
| 状态 | **本地服务 + frp 代理**，服务器无进程 |
| 实际服务 | 用户**本地电脑**运行（开发版）|
| 服务器侧 | 仅 frp 隧道（端口 8090）+ 证书目录（保留备用）|
| 路径（仅数据） | /home/ubuntu/dev.offernotes.cn/（历史遗留，**应清理**）|
| 进程管理 | ❌（不需要，PB 在本地）|
| 日志 | ❌（不需要，本地有）|
| 证书 | /etc/nginx/certs/dev.offernotes.cn/（保留）|
| nginx 站点 | /etc/nginx/sites-enabled/dev.offernotes.cn.conf（保留）|
| 备份 | ✅ /home/ubuntu/backups/dev.offernotes.cn_pb_*.tar.gz |
| **server-doctor 例外** | 该项目不检查 systemd/进程（因不需在服务器跑）|
| frp 端口 | 8090 (TCP) → 用户本地 |
| **建议清理** | ① 备份后清空 /home/ubuntu/dev.offernotes.cn/ ② 保留 nginx + 证书作 fallback |

### 4. neontalk ❌ 开发中（暂不标准化）

| 项 | 值 |
|---|---|
| 域名 | 无（直连 IP:8097）|
| 状态 | stopped（开发中）|
| 路径 | /home/ubuntu/neontalk |
| **子目录** | web + pocketbase + pb_data + ...（**全平铺**）|
| 技术栈 | PocketBase + pnpm dev (Next.js?) |
| 前端托管 | **无 nginx**（直连 5177，**与 dev.offernotes.cn 端口冲突**）|
| 后端端口 | 8097 (PocketBase) |
| **进程管理** | nohup + run.sh（**应改 systemd**）|
| **日志** | pb.log + fe.log + pocketbase.log（**3 个，应改 journald**）|
| 备份 | ❌（未纳入 cron）|
| 标准化 | 暂缓（开发中）|

### 5. ~~sound_community~~（已清理）

| 项 | 值 |
|---|---|
| 状态 | ~~已停~~（2026-07-13 清理）|
| 旧路径 | /home/ubuntu/sound_community/ |
| 替代项目 | voice.fulianli.top |
| 备份 | /home/ubuntu/backups/_trash_20260713/sound_community.tar.gz（30 天后删）|
| 备注 | 90+ 天无活动，nginx/sites-available/backup/ 仍有历史归档可查 |

### 6. ~~weixinpay-test~~（已清理）

| 项 | 值 |
|---|---|
| 状态 | ~~已停~~（2026-07-13 清理）|
| 旧路径 | /home/ubuntu/weixinpay-test/ |
| 替代项目 | 微信支付功能已并入 dev.offernotes.cn（用户本地）|
| 备份 | /home/ubuntu/backups/_trash_20260713/weixinpay-test.tar.gz（30 天后删）|
| 备注 | 70+ 天无活动，仅测试 demo |

### 7. frp（基础设施）

| 项 | 值 |
|---|---|
| 状态 | running |
| 路径 | /home/ubuntu/frp |
| 角色 | frp 服务端（frps），为本地服务提供内网穿透 |
| 监听端口 | 7000 (frp 主连接) + 7500 (web dashboard) + 8090 (dev.offernotes.cn 客户端转发的本地端口) |
| 进程管理 | ❌（直挂 PID 1，**应改 systemd**，非紧迫）|
| 配置 | /home/ubuntu/frp/frps.toml |
| **建议** | ① 加 frps.service ② 清理日志用 journald |

---

## 端口分配总览 v3

| 端口 | 服务 | 项目 | 标准 |
|------|------|------|------|
| 80 | nginx | 所有 HTTP | ✅ |
| 443 | nginx | 所有 HTTPS | ✅ |
| 7000 | frp 主连接 | frps | ✅ |
| 7500 | frp dashboard | frps | ✅ |
| 8085 | PocketBase | geo.fulianli.top | ✅ |
| 8086 | PocketBase | voice.fulianli.top | ✅ |
| 8081 | frp | weixinpay-test（备用）| 专用 |
| 8090 | frp 转发 | dev.offernotes.cn（本地）| 专用 |
| 8097 | PocketBase | neontalk（开发中）| ⚠️ |

> **可用端口池**（按手册 §4.1）：8087、8088、8089、**8091~8096、8098、8099**

---

## 进程管理总览

| 项目 | systemd unit | 自启动 | 崩溃恢复 | 日志 |
|------|-------------|--------|---------|------|
| geo.fulianli.top | pocketbase-geo-fulianli-top.service | ✅ | ✅ | journald |
| voice.fulianli.top | pocketbase-voice-fulianli-top.service | ✅ | ✅ | journald |
| dev.offernotes.cn | ❌（frp 模式，不需要）| - | - | - |
| neontalk | ❌ | ❌ | ❌ | 3 个 .log 文件 |
| frps | ❌（直挂 PID 1）| ✅ | ❌ | nohup.out |

> 风险：服务器重启后，neontalk + frps 需手动启动。

---

## 证书总览

| 域名 | 路径 | 续期方式 | 到期天数 | 备注 |
|------|------|---------|---------|------|
| geo.fulianli.top | /etc/nginx/certs/geo.fulianli.top/ | 手动 zip ⚠️ | ~89 | 待切 acme.sh |
| voice.fulianli.top | /etc/nginx/certs/voice.fulianli.top/ | 手动 zip ⚠️ | ~89 | 待切 acme.sh |
| dev.offernotes.cn | /etc/nginx/certs/dev.offernotes.cn/ | 手动 zip ⚠️ | ~57 | 待切 acme.sh |
| devof.fulianli.top | /etc/nginx/certs/devof.fulianli.top/ | 手动 | 过期? | 未用 |
| offernotes.cn | /etc/nginx/certs/offernotes.cn/ | 手动 | 过期? | 未用 |
| sy.fulianli.top | /etc/nginx/certs/sy.fulianli.top/ | 手动 | 过期? | 未用 |
| voice.siyue.online | /etc/nginx/certs/voice.siyue.online/ | 手动 | 过期? | 未用 |
| www.iamclaw.cn | /etc/nginx/certs/www.iamclaw.cn* | 手动 | 过期? | 未用 |

> **待办**：acme.sh 工具未启用（待用户提供腾讯云 DNSPod API key）。
> 提供后由 agent 按 SERVER_DEPLOY_GUIDE.md §5.2 迁移 3 个生产证书。

---

## 备份总览（v3 新增）

| 脚本 | 路径 | 运行时间 | 保留 |
|------|------|---------|------|
| PB 备份 | /home/ubuntu/backups/pb_backup.sh | 每日 02:00 (cron) | 7 天 |
| 备份目录 | /home/ubuntu/backups/ | - | - |
| cron | `0 2 * * * /home/ubuntu/backups/pb_backup.sh >> /home/ubuntu/backups/cron.log 2>&1` | - | - |
| 恢复命令 | 见 SERVER_DEPLOY_GUIDE.md §6.3 | - | - |

---

## server-doctor 例外规则

`/opt/server-doctor/server-doctor.sh` 默认**不检查**以下项目（frp 模式）：

- **dev.offernotes.cn** — 本地服务，服务器无进程

其他项目均按手册 v3 全部 8 项检查。

---

## 待清理清单

| 项 | 原因 | 风险 | 状态 |
|---|------|------|------|
| /home/ubuntu/sound_community/ | 旧项目，已被 voice-community 替代 | 删错可能影响历史 | ✅ 2026-07-13 已清理（备份保留 30 天）|
| /home/ubuntu/weixinpay-test/ | 旧测试项目，已停 | 低 | ✅ 2026-07-13 已清理（备份保留 30 天）|
| /home/ubuntu/dev.offernotes.cn/backend/ | 实际服务在本地，服务器上是死代码 | 中（用户可能有时切回服务器）| ⏸ 保留（68M 不大）|
| /home/ubuntu/frp/nohup.out | 6.9MB 旧日志 | 低 | ✅ 2026-07-13 已清理 |
| /home/ubuntu/dev.offernotes.cn/backend/pb_startup.log | PB 启动日志（PB 已不在服务器跑）| - | ✅ 2026-07-13 已清理 |
| /home/ubuntu/dev.offernotes.cn/backend/weixinpay/weixinpay.log | 微信支付服务日志（已在本地）| - | ✅ 2026-07-13 已清理 |

> 其余清理前需用户确认。

---

## 变更记录

- **2026-07-13 v3.1**：清理废弃项目
  - 删 /home/ubuntu/sound_community/（63M，90+ 天无活动）
  - 删 /home/ubuntu/weixinpay-test/（26M，70+ 天无活动）
  - 删 /home/ubuntu/frp/nohup.out（6.9M 旧日志）
  - 删 dev.offernotes.cn 的 2 个 .log 文件
  - 备份保留在 /home/ubuntu/backups/_trash_20260713/（30 天后删）
- **2026-07-13 v3**：同步 SERVER_DEPLOY_GUIDE.md v3。
  - 增补 frp 模式项目分类（dev.offernotes.cn）
  - 删 dev.offernotes.cn 的 pocketbase-dev.service（实际服务在本地）
  - 增补 §备份总览、§server-doctor 例外规则、§待清理清单
  - 端口总览加 frp 端口（7000/7500/8090）
- 2026-07-13 v2：每项目加 ✅/⚠️/❌ 标准化检查表；端口总览标注冲突；增补进程/证书总览。
- 2026-07-12 v1：初次建立。
