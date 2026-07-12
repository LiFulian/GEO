# Security Policy

## 支持的版本

下表说明本项目哪些版本会收到安全更新。

| 版本 | 是否支持 |
|------|---------|
| 0.1.x | ✅ 当前主版本，会收到所有安全补丁 |
| < 0.1 | ❌ 不再维护，请升级到 0.1.x |

## 报告漏洞

**请勿在公开 issue 中报告安全漏洞。** 通过以下方式私密报告：

- 📧 Email：**security@geo-studio.local**（占位，请替换为项目实际邮箱）
- 🔒 GitHub Security Advisories：<https://github.com/your-org/geo-studio/security/advisories/new>

### 报告应包含

1. 漏洞概述（影响范围、严重性自评）
2. 复现步骤 / PoC（代码、截图、HTTP 请求均可）
3. 受影响版本（commit hash 或 release tag）
4. 你的联系方式（便于我们追问细节）

### 我们的承诺

- **48 小时内**确认收到你的报告
- **7 天内**给出初判（是否接受、严重性评级、修复时间表）
- 修复发布后会在 release notes 致谢（除非你要求匿名）
- 修复前不公开漏洞细节

## 安全使用建议

### 1. API Key 存储（重要）

GEO Studio 当前将 AI API Key 以**明文**存储在本地 SQLite（`pocketbase/pb_data/data.db`）中。
这是为简化本地部署做的设计权衡，请遵守：

- ✅ **使用受限 Key**：在 AI 服务商控制台开启 IP 白名单、用量上限、单独预算
- ✅ **不要**用生产大额 Key
- ✅ 在公网部署前**必须**修改默认管理员密码（`admin@geo.local` / `admin123456`）
- ❌ 不要把 `pb_data/` 目录 commit 到 git、共享、上传到公开网盘

### 2. 生产部署

- 反向代理必须启用 HTTPS（Nginx / Caddy）
- 关闭 PocketBase 的 `0.0.0.0` 公网绑定（仅 127.0.0.1）
- 修改所有默认账号密码
- 定期备份 `pb_data/` 目录
- 启用防火墙，仅暴露 80/443 端口

### 3. AI 反向代理（`pb_hooks/ai_proxy.js`）

内置代理仅校验 URL 协议（必须 http/https）以防 `file://` 等本地协议读取。
**对 AI 服务商域名不做白名单**——意味着如果你误配了模型端点，可能会向任意域名发出请求（携带 API Key）。
建议：

- 部署时审查 `pb_hooks/ai_proxy.js`
- 如需严格隔离，使用网络层 egress 白名单

### 4. 用户数据隔离

业务集合（products / articles / publish_tasks 等）通过 `user_id` 字段和 PocketBase 的 API rules 强制隔离。
跨用户数据泄露风险**已通过规则消除**，但请勿在自定义 hook 中绕过 `request.auth.id` 校验。

## 安全更新订阅

- Watch 本仓库 → Custom → **Releases only**（避免噪音，仅安全公告触发通知）
- GitHub Security Advisories 会在新漏洞披露时通知 Watchers
