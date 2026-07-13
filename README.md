# GEO Studio

> **English summary**: GEO Studio is an open-source content operations workbench for Generative Engine Optimization (GEO) — the practice of getting your brand and product into AI assistant answers (ChatGPT, 智谱清言, 文心一言, etc.). It manages product profiles, mines real user questions, generates multi-platform content (soft articles, short-video scripts, 小红书 notes), and tracks publishing tasks.

---

## 项目介绍

GEO Studio 是一款开源的**生成式引擎优化（Generative Engine Optimization）内容运营工具**，帮助内容创作者和运营团队：

- 📦 **管理产品档案**：产品定位、卖点、受众、禁用表达，一处管理多处复用
- 🎯 **挖掘 GEO 问题**：整理用户在 AI 助手中真实会问的问题，按优先级排期
- ✍️ **生成多平台内容**：基于产品档案 + GEO 问题，AI 生成差异化软文、短视频脚本、小红书笔记
- 📅 **管理发布任务**：看板 + 日历视图，按平台/产品统计，记录发布状态与链接
- 🤖 **多模型支持**：智谱 GLM、DeepSeek、OpenAI、通义千问、豆包、本地 Ollama 等任意 OpenAI 兼容接口

> **GEO 是什么？** 随着 AI 助手（ChatGPT、智谱清言、文心一言等）成为用户新的搜索入口，让品牌/产品出现在 AI 回答中的优化就叫 GEO，也叫 AIO（AI Optimization）。

## 在线 DEMO

访问 **https://geo.fulianli.top** 体验完整功能（账号 `user001@geo.local`，密码 `test1234`）。

> ⚠️ DEMO 站点数据公开可读，请勿填写真实 API Key 或发布敏感内容。

## 快速开始

### 前置要求

- macOS / Linux / WSL 或 Windows 10+
- Node.js **18+**（推荐 20 LTS；仓库含 `.nvmrc` 自动锁定）
- Bash + curl + unzip

### 一键启动

```bash
git clone https://github.com/LiFulian/GEO.git
cd geo-studio
bash run.sh start    # macOS / Linux / WSL
# 或
start.bat            # Windows
```

首次启动会自动完成：下载 PocketBase 二进制 → 安装前端依赖 → 初始化数据库与超级管理员 → 启动后端（8085）和前端（5175）。

打开 **http://localhost:5175** 即可使用。

### Docker 部署

```bash
docker compose up -d
```

打开 http://localhost:8085 即可（Docker 模式下前端由 PocketBase 同源托管）。详见 [Dockerfile](Dockerfile) 与 [docker-compose.yml](docker-compose.yml)。

### 默认账号

| 角色 | 邮箱 | 密码 | 入口 |
|------|------|------|------|
| 超级管理员 | `admin@geo.local` | `admin123456` | http://127.0.0.1:8085/_/ |
| 预注册用户 | `user001@geo.local` ~ `user005@geo.local` | `test1234` | http://localhost:5175 |

> ⚠️ 仅限本地开发使用。**生产部署请立即修改所有默认密码。**

### 常用命令

```bash
bash run.sh start    # 启动前端 + 后端
bash run.sh stop     # 停止
bash run.sh restart  # 重启
bash run.sh install  # 仅装依赖（PocketBase 二进制 + node_modules），不启服务
bash run.sh status   # 查看运行状态
```

## 功能特性

### 1. 产品档案管理
- 左右分栏（语雀风格），左侧列表，右侧详情
- 查看 / 编辑模式无缝切换
- 结构化字段：类型、链接、受众、卖点、竞品、品牌语气、转化目标、禁用表达
- AI 一键梳理产品档案：粘贴零散描述，AI 自动整理成结构化档案

### 2. GEO 问题库（深度融合 AI）
- 问题扁平化展示，嵌入产品档案页面，无需跳转
- 卡片式 UI，点击即编辑
- **AI 智能优化**：一键优化问题措辞、补全意图/人群、生成内容创作角度
- **AI 批量生成**：基于产品档案自动生成 N 个高优先级 GEO 问题
- 按状态（active/covered/paused）+ 优先级（high/medium/low）管理
- 覆盖率统计：每个产品/GEO 问题的内容覆盖一目了然

### 3. 内容工坊
- 左侧文章列表（按产品/状态筛选 + 搜索），右侧编辑器
- AI 生成：软文 / 短视频脚本 / 小红书笔记 / 创意文案 / 教程 / 竞品分析 / 新闻稿 / 社媒动态 / SEO 文章
- Markdown 编辑器：工具栏 + 实时预览 + 草稿自动保存
- AI 改写 / 扩写 / 平台适配改写
- 文章审核流：draft → review → approved → archived

### 4. 发布平台矩阵
- 预置 14+ 国内主流平台：微信公众号、知乎、小红书、抖音、B站、掘金等
- 链接规则：允许外链 / 有限 / 禁止
- 软文适配度评估
- 平台状态管理

### 5. 发布任务管理
- **日历视图**：按月查看每天发布计划与已发布内容
- **看板视图**：4 列（待发布 / 已发布 / 需修改 / 已跳过），支持拖拽
- **批量分配**：选择文章 + 平台，一键创建 N 个发布任务
- 文章审核通过后**自动创建**发布任务

### 6. AI 集成
- 开箱即用：默认配置智谱 GLM-4-Flash（免费额度）
- 多模型：智谱 GLM + CogView、OpenAI (GPT-4.1-mini + GPT-Image-1)、DeepSeek、字节豆包、阿里通义千问、本地 Ollama
- 双模式：手动 Prompt 模式 / API 直连模式
- 自定义模型：添加任意 OpenAI-compatible 接口

### 7. 全局增强
- 🌗 暗色模式
- ⌘K 全局搜索 · ⌘S 保存 · ⌘/ AI 助手
- 🏆 成就系统 · 💡 每日写作灵感 · 📊 内容质量评分
- 🔄 导入/导出备份（JSON）

## 架构

```
┌────────────────────────────────────────────────────────┐
│                  浏览器 (localhost:5175)                │
│  原生 JS + Vite（无框架）                              │
│  app.js / state / api-client / render / events         │
│  ai-prompts / enhancements / utils                      │
└──────────────────────────┬─────────────────────────────┘
                           │ /api/*
                           ▼
┌──────────────────────────────────────────────────────────┐
│            PocketBase (127.0.0.1:8085)                  │
│  REST API + Auth (JWT) + SQLite                        │
│  Collections: products / platforms / articles           │
│  geo_questions / publish_tasks / ai_settings            │
│  user_models / product_images / users                   │
└──────────────────────────────────────────────────────────┘
```

**设计哲学**：零框架、一键启动、多用户隔离（`user_id` 字段）、数据可移植（SQLite 单文件备份）。

## 文档

- [AGENTS.md](AGENTS.md) — **AI 助手专用**入口（项目记忆、约束、约定）
- [CONTRIBUTING.md](CONTRIBUTING.md) — 贡献指南（开发流程、代码风格、Conventional Commits）
- [CHANGELOG.md](CHANGELOG.md) — 版本变更日志
- [SECURITY.md](SECURITY.md) — 漏洞报告与安全建议
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — 社区行为准则

## 贡献

欢迎贡献代码、提 Issue、完善文档！详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`。

## 路线图

- [x] 产品档案 CRUD + AI 梳理
- [x] GEO 问题库 + AI 批量生成 + AI 智能优化
- [x] 内容工坊 + 多类型 AI 生成 + Markdown 编辑器
- [x] 发布平台矩阵 + 任务看板 + 日历视图
- [x] 多用户隔离 + JWT 认证
- [x] 暗色模式 + 全局搜索 + 成就系统
- [x] Hash 路由 + Docker 化部署 + CI
- [ ] 团队协作（共享产品档案、协作编辑）
- [ ] 内容效果分析（接入 AI 助手引用监测）
- [ ] 更多 AI 模型预设（Claude、Gemini）
- [ ] 国际化（i18n）
- [ ] PWA 离线支持

## License

[MIT](./LICENSE) © GEO Studio Contributors

## 致谢

- [PocketBase](https://pocketbase.io/) — 单文件后端
- [Vite](https://vitejs.dev/) — 下一代前端构建工具
- [智谱 AI](https://open.bigmodel.cn/) — 默认 AI 模型提供商
- 所有贡献者 ✨
