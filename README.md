# GEO Studio

<p align="center">
  <strong>生成式引擎优化（GEO）内容运营工作台</strong><br>
  管理产品档案 · 挖掘 GEO 问题 · 生成多平台内容 · 跟踪发布任务
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#功能特性">功能特性</a> ·
  <a href="#部署">部署</a> ·
  <a href="#数据模型">数据模型</a> ·
  <a href="#贡献">贡献</a> ·
  <a href="#路线图">路线图</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
  <img src="https://img.shields.io/badge/PocketBase-0.39.4-blue.svg" alt="PocketBase">
  <img src="https://img.shields.io/badge/Vite-6-646cff.svg" alt="Vite">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-green.svg" alt="Platform">
</p>

---

## 介绍

GEO Studio 是一款开源的**生成式引擎优化（Generative Engine Optimization）内容运营工具**，帮助内容创作者和运营团队：

- 📦 **管理产品档案**：产品定位、卖点、受众、禁用表达，一处管理多处复用
- 🎯 **挖掘 GEO 问题**：整理用户在 AI 助手中真实会问的问题，按优先级排期
- ✍️ **生成多平台内容**：基于产品档案 + GEO 问题，AI 生成差异化软文、短视频脚本、小红书笔记
- 📅 **管理发布任务**：看板 + 日历视图，按平台/产品统计，记录发布状态与链接
- 🤖 **多模型支持**：智谱 GLM、DeepSeek、OpenAI、通义千问、豆包、本地 Ollama 等任意 OpenAI 兼容接口

> **GEO 是什么？** 随着 AI 助手（ChatGPT、智谱清言、文心一言等）成为用户新的搜索入口，让品牌/产品出现在 AI 回答中的优化就叫 GEO，也叫 AIO（AI Optimization）。

## 快速开始

### 方式一：本地一键启动（推荐）

**前置要求**：
- macOS / Linux / WSL
- Bash + curl + unzip
- Node.js 18+（用于前端）

```bash
git clone https://github.com/your-org/geo-studio.git
cd geo-studio
bash run.sh start
```

首次启动会自动：
1. 下载 PocketBase 二进制
2. 安装前端依赖
3. 初始化数据库与超级管理员
4. 启动后端（8085）和前端（5175）

完成后打开 http://localhost:5175 即可使用。

**预注册测试账号**：`user001` ~ `user005`，密码 `test1234`

**PocketBase 管理面板**：http://127.0.0.1:8085/_/

#### 常用命令

```bash
bash run.sh start    # 启动前端 + 后端
bash run.sh stop     # 停止
bash run.sh restart  # 重启
bash run.sh status   # 查看运行状态
```

### 方式二：Windows 一键启动

```cmd
git clone https://github.com/your-org/geo-studio.git
cd geo-studio
start.bat
```

`start.bat` 会自动下载 Windows 版 PocketBase、安装前端依赖、启动服务。

### 方式三：Docker 一键部署

适合服务端部署，无需本地安装 Node.js 或 PocketBase。

```bash
docker compose up -d
```

打开 http://localhost:5175 即可。详见 [Docker 部署文档](#docker-部署)。

## 功能特性

### 1. 产品档案管理

- 左右分栏布局（语雀风格），左侧列表，右侧详情
- 查看模式 / 编辑模式无缝切换
- 结构化字段：类型、链接、受众、卖点、竞品、品牌语气、转化目标、禁用表达
- AI 一键梳理产品档案：把零散描述粘进来，AI 自动整理成结构化档案
- 深度编辑模式：Markdown 编辑器 + 图片库 + AI 助手对话

### 2. GEO 问题库（深度融合 AI）

- 问题扁平化展示，直接嵌入产品档案页面下方，无需跳转
- 卡片式 UI，点击卡片即编辑
- **AI 智能优化**：一键优化问题措辞、补全意图/人群、生成内容创作角度
- **AI 批量生成**：基于产品档案自动生成 N 个高优先级 GEO 问题
- 按问题状态（active/covered/paused）和优先级（high/medium/low）管理
- 覆盖率统计：每个产品/GEO 问题的内容覆盖情况一目了然

### 3. 内容工坊

- 左右分栏：左侧文章列表（按产品/状态筛选 + 搜索），右侧编辑器
- AI 生成内容类型：
  - 软文 / 短视频脚本 / 小红书笔记 / 创意文案
  - 教程 / 竞品分析 / 新闻稿 / 社媒动态 / SEO 文章
- Markdown 编辑器：工具栏 + 实时预览 + 草稿自动保存
- AI 改写 / 扩写 / 平台适配改写
- JSON 批量导入文章库
- 配图提示词生成与 AI 生图
- 文章审核流：draft → review → approved → published

### 4. 发布平台矩阵

- 预置 14+ 国内主流平台：微信公众号、知乎、小红书、抖音、B站、掘金等
- 结构化字段：账号名、登录提示、内容风格、推荐词、标题样式、标签规则
- 链接规则：允许外链 / 有限 / 禁止
- 软文适配度评估
- 平台状态管理（启用/停用）

### 5. 发布任务管理

- **日历视图**：按月查看每天发布计划与已发布内容
- **看板视图**：4 列看板（待发布 / 已发布 / 需修改 / 已跳过），支持拖拽状态
- **批量分配**：选择文章 + 选择平台，一键创建 N 个发布任务
- **统计卡片**：按产品统计、按平台统计，快速识别瓶颈
- **快捷复制**：一键复制标题/正文/整包/分享文案
- **自动任务**：文章审核通过后自动创建发布任务

### 6. AI 集成

- 开箱即用：默认配置智谱 GLM-4-Flash（免费额度），只需填入 API Key
- 多模型支持：
  - 智谱 GLM + CogView
  - OpenAI (GPT-4.1-mini + GPT-Image-1)
  - DeepSeek
  - 字节豆包
  - 阿里通义千问
  - 本地 Ollama 网关
- 双模式：手动 Prompt 模式 / API 直连模式
- 自定义模型：添加任意 OpenAI-compatible 接口
- API Key 加密存储

### 7. 全局增强

- 🌗 暗色模式
- ⌘K 全局搜索（跨产品/问题/文章/任务）
- ⌘N / ⌘G / ⌘P / ⌘T 快捷创建
- 🏆 成就系统（首次建档、5 篇发布、100% 覆盖等）
- 💡 每日写作灵感
- 📊 内容质量评分
- 🔄 导入/导出备份（JSON）

## 架构

```
┌────────────────────────────────────────────────────────┐
│                    浏览器 (http://localhost:5175)       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  原生 JS + Vite (无框架)                          │  │
│  │  ├── app.js          应用入口                     │  │
│  │  ├── js/state.js     全局状态                     │  │
│  │  ├── js/api-client.js 三层 API 客户端             │  │
│  │  ├── js/render.js    视图渲染                     │  │
│  │  ├── js/events.js    事件处理                     │  │
│  │  ├── js/ai-prompts.js AI Prompt 模板              │  │
│  │  ├── js/enhancements.js 主题/快捷键/搜索          │  │
│  │  └── js/utils.js     工具函数                     │  │
│  └──────────────────────────────────────────────────┘  │
│                          │ /api/*                       │
└──────────────────────────┼─────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────┐
│              PocketBase (http://127.0.0.1:8085)           │
│                                                            │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  REST API        │  │  pb_migrations/ (12 个)      │  │
│  │  /api/collections│  │  ├── products                │  │
│  │  /api/bootstrap  │  │  ├── platforms                │  │
│  │  /api/tasks/assign│  │  ├── articles                │  │
│  │  Auth (JWT)      │  │  ├── geo_questions            │  │
│  └─────────────────┘  │  ├── publish_tasks            │  │
│                        │  ├── ai_settings              │  │
│  ┌─────────────────┐  │  ├── user_models               │  │
│  │  SQLite (内置)   │  │  ├── product_images            │  │
│  │  pb_data/        │  │  └── users (auth)              │  │
│  └─────────────────┘  └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**设计哲学**：
- **零框架**：纯原生 JS + HTML + CSS，依赖极少（仅 vite），维护简单
- **一键启动**：`run.sh start` 一条命令搞定一切
- **多用户隔离**：所有业务数据通过 `user_id` 字段实现用户间隔离
- **数据可移植**：SQLite 单文件，复制 `pb_data/` 即可备份

## 部署

### Docker 部署

适合服务端部署，使用 `docker compose` 一键拉起所有服务。

```bash
# 克隆项目
git clone https://github.com/your-org/geo-studio.git
cd geo-studio

# 启动
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

服务暴露：
- 前端：http://localhost:5175
- 后端 API：http://localhost:8085

数据持久化：通过 volume 挂载 `./pocketbase/pb_data` 到容器。

#### 生产环境部署

生产环境推荐反向代理（Nginx / Caddy）+ HTTPS：

```nginx
server {
  listen 443 ssl http2;
  server_name geo.your-domain.com;

  # 前端
  location / {
    proxy_pass http://127.0.0.1:5175;
    proxy_set_header Host $host;
  }

  # 后端 API
  location /api/ {
    proxy_pass http://127.0.0.1:8085;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### 环境变量

在 `frontend/.env` 中配置：

```bash
# PocketBase 后端地址
VITE_PB_URL=http://127.0.0.1:8085

# PocketBase 管理员账号（仅本地开发）
VITE_PB_EMAIL=admin@geo.local
VITE_PB_PASSWORD=admin123456

# 默认 AI API Key（可选，填入后用户首次进入即自动启用 AI）
# 智谱 GLM 免费 key 申请：https://open.bigmodel.cn/usercenter/apikeys
VITE_DEFAULT_AI_KEY=
```

## 数据模型

| 集合 | 类型 | 说明 |
|------|------|------|
| `products` | base | 产品档案 |
| `platforms` | base | 发布平台矩阵 |
| `articles` | base | 文章内容库 |
| `geo_questions` | base | GEO 问题库 |
| `publish_tasks` | base | 发布任务 |
| `ai_settings` | base | AI 模型设置 |
| `user_models` | base | 用户自定义模型 |
| `product_images` | base | 产品图片库 |
| `users` | auth | 用户账号（认证） |

所有业务集合通过 `user_id` 字段实现用户间数据隔离，PocketBase 的 API rules 强制每个用户只能 CRUD 自己的数据。

### 核心工作流

```
产品档案 → GEO 问题库 → 内容生成 → 文章审核 → 人工发布 → 发布记录
   │            │           │           │            │           │
   │            │           │           │            │           │
   └── AI 梳理 └── AI 挖掘 └── AI 生成 └── 自动创建 └── 人工执行 └─ 标记完成
```

## 升级 PocketBase

```bash
# 1. 停止服务
bash run.sh stop

# 2. 下载新版 PocketBase（替换二进制文件）
VER="0.39.4"  # 替换为最新版本
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
[ "$ARCH" = "arm64" ] && ARCH="arm64" || ARCH="amd64"
curl -L -o /tmp/pb.zip \
  "https://github.com/pocketbase/pocketbase/releases/download/v${VER}/pocketbase_${VER}_${OS}_${ARCH}.zip"
unzip -o /tmp/pb.zip -d pocketbase/
chmod +x pocketbase/pocketbase
rm /tmp/pb.zip

# 3. 启动服务（迁移自动执行）
bash run.sh start
```

## 数据备份

PocketBase 数据在 `pocketbase/pb_data/` 目录，直接备份该目录即可。

也支持从 UI 导出 JSON 备份（设置 → 导出备份）。

## 贡献

欢迎贡献代码、提 Issue、完善文档！

### 开发流程

1. Fork 项目
2. 创建特性分支：`git checkout -b feat/your-feature`
3. 提交改动：`git commit -m 'feat: add xxx'`
4. 推送分支：`git push origin feat/your-feature`
5. 提交 Pull Request

### 开发约定

- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
  - `feat:` 新功能
  - `fix:` 修复 bug
  - `docs:` 文档
  - `refactor:` 重构
  - `chore:` 杂项
- 代码风格：4 空格缩进，单引号字符串，末尾无分号（保持与现有代码一致）
- 模块化：新增功能尽量独立成模块，避免单个文件过大
- 优先复用现有工具函数（`utils.js` 中的 `$`、`$$`、`escapeHtml`、`api`、`toast` 等）

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 路线图

- [x] 产品档案 CRUD + AI 梳理
- [x] GEO 问题库 + AI 批量生成 + AI 智能优化
- [x] 内容工坊 + 多类型 AI 生成 + Markdown 编辑器
- [x] 发布平台矩阵 + 任务看板 + 日历视图
- [x] 多用户隔离 + JWT 认证
- [x] 暗色模式 + 全局搜索 + 成就系统
- [x] Hash 路由（URL 可分享、可刷新）
- [x] Docker 化部署
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
