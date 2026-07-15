# AGENTS.md — AI 开发上下文

> 本文件供 Trae/AI 助手每次会话自动加载，帮助 AI 理解项目结构与约定。
> 用户面向文档见 [README.md](README.md)。

## 技术栈

- **前端**：原生 JS + Vite 6（无框架），源码在 `frontend/src/`
- **后端**：PocketBase 0.39.4（单二进制），迁移在 `pocketbase/pb_migrations/`
- **零框架设计**：依赖极少（仅 vite），纯 HTML + CSS + JS

## 架构

```
frontend/src/
├── app.js              应用入口
├── index.html          单页 HTML
├── styles.css          全局样式
└── js/
    ├── state.js        全局状态
    ├── api-client.js   三层 API 客户端（PB → bootstrap → 业务）
    ├── render.js       视图渲染（showView + autoPickFirstItem）
    ├── events.js       事件处理
    ├── ai-prompts.js   AI Prompt 模板
    ├── enhancements.js 主题/快捷键/搜索
    └── utils.js        工具函数（$、$$、escapeHtml、api、toast）

pocketbase/
├── pocketbase          PB 二进制（gitignore，run.sh 自动下载）
├── pb_data/            SQLite 数据（gitignore）
├── pb_hooks/           Go hooks（ai_proxy.js：AI 反代）
└── pb_migrations/      迁移脚本（仅追加）
```
## 默认ai
https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash
https://docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash
https://docs.bigmodel.cn/cn/guide/models/free/glm-4-flash-250414
apikey：2b954231cd31454ea6e1e044970c96e6.vU4RfVaGkyCKm7D7

## 数据模型

| 集合 | 类型 | 说明 |
|------|------|------|
| `products` | base | 产品档案（含 status: active/draft/paused/archived） |
| `platforms` | base | 发布平台矩阵 |
| `articles` | base | 文章内容库（draft → review → approved → archived） |
| `geo_questions` | base | GEO 问题库 |
| `publish_tasks` | base | 发布任务 |
| `ai_settings` | base | AI 模型设置 |
| `user_models` | base | 用户自定义模型 |
| `product_images` | base | 产品图片库 |
| `users` | auth | 用户账号 |

**多用户隔离**：所有业务集合通过 `user_id` 字段隔离，PocketBase API rules 强制每用户只能 CRUD 自己的数据。

## 默认凭证（仅本地开发）

- 超级管理员：`admin@geo.local` / `admin123456`（PB 管理面板 http://127.0.0.1:8085/_/）
- 预注册用户：`user001@geo.local` ~ `user005@geo.local` / `test1234`
- 凭证由 `run.sh` 首次启动时通过 `pocketbase superuser upsert` 创建

## 工程约定

- **代码风格**：2 空格缩进、单引号、末尾无分号（见 `.editorconfig`）
- **提交规范**：Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`）
- **模块化**：新功能独立成模块，优先复用 `utils.js` 中的 `$`、`$$`、`escapeHtml`、`api`、`toast`
- **迁移仅追加**：`pb_migrations/` 只新增不修改，保证向后兼容

## 关键技术决策（必读）

- 列表查询必须用 `sort=-updated_at`（非系统 `updated` 字段），否则可能返回空结果
- POST/PATCH 自动注入 `created_at` 和 `updated_at`（自定义文本字段）
- `cleanPayload` 不得剥离 `created_at` / `updated_at`
- GEO 问题直接嵌入产品档案页面（非独立子页面），点击卡片即编辑
- 进入 products/platforms/workshop 列表页时自动选中第一项（`autoPickFirstItem`）
- 用 `_routingGuard` 防止 hash 路由恢复时触发自动选中
- 默认 AI 模型为 `glm-4-flash`，AI 设置含默认预设 + 用户自定义
- 环境变量通过 `window.__GEO_ENV__` 注入（非 module script 无法用 `import.meta.env`）

## 核心工作流

```
产品档案 → GEO 问题库 → 内容生成 → 文章审核 → 人工发布 → 发布记录
   │            │           │           │            │           │
   └── AI 梳理 └── AI 挖掘 └── AI 生成 └── 自动创建 └── 人工执行 └─ 标记完成
```

## 启动

```bash
bash run.sh start    # 一键：下载 PB + 安装依赖 + 初始化 + 启动（前端 5175 + 后端 8085）
```
