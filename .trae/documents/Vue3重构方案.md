# GEO Studio — Vue 3 + TypeScript + Element Plus 重构方案

## Context

当前前端是原生 JS + Vite，13055 行代码散落在 8 个 JS 文件 + 1 个 HTML + 1 个 CSS 中。`events.js`（2800行）和 `render.js`（1822行）过大，手动 DOM 同步、无组件复用、无类型保护，长期维护成本高。

本次目标：**重构为 Vue 3 + TypeScript + Element Plus + Pinia + Vue Router 架构**，后端（PocketBase + migrations）完全不动。简化代码、提升可维护性，并通过充分的测试验证保证功能 1:1 还原。

## 技术栈

| 维度 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3 + `<script setup>` | Composition API |
| 语言 | TypeScript | 类型安全 |
| UI 库 | Element Plus + @element-plus/icons-vue | 替代 5262 行自定义 CSS 的大部分 |
| 状态 | Pinia | 替代 state.js 全局对象 |
| 路由 | Vue Router（hash 模式） | 保持 `#/products/{id}/deep` 可分享 URL |
| 构建 | Vite 6（已有） | 配置改为 `@vitejs/plugin-vue` |

## 目录结构

```
frontend/
├── src/
│   ├── App.vue                       # 根组件：sidebar + topbar + router-view + 全局组件
│   ├── main.ts                       # 入口：createApp + 注册插件
│   ├── env.d.ts                      # TS 环境声明
│   ├── router/index.ts               # 路由（hash 模式，保持 URL 格式）
│   ├── types/index.ts                # 业务类型定义（Product/Article/Platform/Task 等）
│   ├── stores/
│   │   ├── auth.ts                   # 认证（token/user/login/logout/refresh）
│   │   ├── data.ts                   # 业务数据（products/articles/tasks 等 + load/select）
│   │   └── ai.ts                     # AI 设置 + user_models
│   ├── api/
│   │   ├── client.ts                 # geoApi 核心（translatePath/fetchAllRecords/pbRecordToApp）
│   │   ├── auth.ts                   # userLogin/userRegister/JWT 管理
│   │   └── ai.ts                     # callAI/aiFetch（含 PB 代理回退）
│   ├── composables/
│   │   ├── useTheme.ts               # 暗色模式
│   │   ├── useToast.ts               # 封装 ElMessage
│   │   ├── useShortcut.ts            # ⌘K/⌘S/⌘/ 快捷键
│   │   ├── useAchievements.ts        # 成就系统
│   │   └── useArticleDraft.ts        # 文章草稿自动保存
│   ├── utils/
│   │   ├── markdown.ts               # markdownToHtml
│   │   ├── csv.ts                    # CSV/JSON 导出
│   │   ├── helpers.ts                # escapeHtml/debounce/formatLocalNow 等
│   │   └── ai-prompts.ts             # AI Prompt 模板（纯函数，最易迁移）
│   ├── views/
│   │   ├── DashboardView.vue         # 总览：stats + coverage + quick actions + wizard
│   │   ├── ProductsView.vue          # 产品档案：左列表 + 右详情（3 Tab）
│   │   ├── WorkshopView.vue          # 内容工坊：左列表 + 右编辑器
│   │   ├── PlatformsView.vue         # 发布平台：左列表 + 右详情
│   │   ├── TasksView.vue             # 发布记录：3 Tab（日历/看板/发布）
│   │   └── SettingsView.vue          # AI 设置 + 自定义模型
│   └── components/
│       ├── AppSidebar.vue            # 侧边导航
│       ├── AppTopbar.vue             # 顶栏（搜索/主题/刷新/用户）
│       ├── AuthView.vue              # 登录/注册（el-tabs + el-form）
│       ├── GlobalSearch.vue          # ⌘K 全局搜索（el-dialog）
│       ├── GlobalAi.vue              # 全局 AI 助手（el-drawer）
│       ├── FatalError.vue            # 致命错误遮罩
│       ├── ProductDetail.vue         # 产品详情（el-tabs：基础/GEO/深度）
│       ├── GeoQuestionCard.vue       # GEO 问题卡片
│       ├── ArticleEditor.vue         # 文章编辑器（Markdown + 工具栏 + 预览）
│       ├── PlatformDetail.vue        # 平台详情/编辑
│       ├── TaskCalendar.vue          # 发布日历（el-calendar）
│       ├── TaskBoard.vue             # 看板视图（拖拽）
│       ├── TaskForm.vue              # 新建发布记录表单
│       ├── PlatformSelectModal.vue   # 平台选择弹窗（el-dialog）
│       └── OnboardingWizard.vue      # 新手引导
├── index.html                        # Vite 入口 HTML（仅 <div id="app">）
├── vite.config.ts                    # 替代 vite.config.js
├── tsconfig.json
└── package.json
```

## 关键迁移映射

### 1. API 层（保持逻辑 1:1）

| 原文件 | 目标 | 说明 |
|--------|------|------|
| `api-client.js` 全局函数 | `api/client.ts` 导出函数 | 保留 `translatePath`/`fetchAllRecords`/`pbRecordToApp`/`cleanPayload`/`apiBootstrap`/`apiCoverage`/`apiAssignTasks` |
| `window.geoApi` | `import { geoApi } from '@/api/client'` | 改为 ES module |
| `callAI`/`aiFetch` | `api/ai.ts` | 保留 PB 代理回退逻辑 |
| 登录/token | `stores/auth.ts` + `api/auth.ts` | 保留 JWT refresh 逻辑 |

**必须保留的技术决策**（来自 AGENTS.md）：
- 列表查询用 `sort=-updated_at`（非系统 `updated`）
- POST/PATCH 自动注入 `created_at`/`updated_at`
- `cleanPayload` 只剥离 `id`，不剥离时间戳
- `publish_tasks` 用 `expand=article_id,platform_id` 并 `flattenTaskExpand`
- AI 请求优先走 `/api/ai/proxy`（PB hook），失败回退浏览器直连

### 2. 状态层

| 原 `state.js` | Pinia store |
|---------------|-------------|
| `state.products` | `useDataStore().products` |
| `state.ai_settings` | `useAiStore().settings` |
| `load()` | `useDataStore().load()` |
| `seedDefaultPlatforms()` | `useDataStore().seedDefaultPlatforms()` |
| `selectedProductId`（render.js 顶层） | 路由参数 `route.params.id` |
| `selectedArticleId` | 路由参数 |

### 3. 路由（保持 hash 格式）

```ts
// router/index.ts
const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: DashboardView },
  { path: '/products', name: 'products', component: ProductsView },
  { path: '/products/:id', component: ProductsView },
  { path: '/products/:id/:tab', component: ProductsView },  // tab: deep/geo
  { path: '/workshop', name: 'workshop', component: WorkshopView },
  { path: '/workshop/:id', component: WorkshopView },
  { path: '/platforms', name: 'platforms', component: PlatformsView },
  { path: '/platforms/:id', component: PlatformsView },
  { path: '/tasks', name: 'tasks', component: TasksView },
  { path: '/tasks/:tab', component: TasksView },  // tab: calendar/board/publish
  { path: '/settings', name: 'settings', component: SettingsView },
]
// createWebHashHistory() 保持 URL 可分享
```

`autoPickFirstItem` 逻辑改为路由守卫 `beforeEnter`：进入 `/products` 时若列表非空且无 id，自动跳转 `/products/{firstId}`。

### 4. 视图迁移

| 原函数 | Vue 组件 |
|--------|----------|
| `renderProducts()` + `renderProductDetail()` | `ProductsView.vue` + `ProductDetail.vue` |
| `renderWorkshop()` + 文章编辑 | `WorkshopView.vue` + `ArticleEditor.vue` |
| `renderPlatforms()` + `renderPlatformDetail()` | `PlatformsView.vue` + `PlatformDetail.vue` |
| `renderTasks()` + 日历 + 看板 | `TasksView.vue` + `TaskCalendar.vue` + `TaskBoard.vue` |
| `renderStats()` + `renderCoverage()` | `DashboardView.vue` |
| `renderSettings()` + `renderUserModels()` | `SettingsView.vue` |

### 5. Element Plus 组件映射

| 原生实现 | Element Plus |
|----------|-------------|
| `<form>` + 手动校验 | `<el-form>` + rules |
| 手拼表格 HTML | `<el-table>` |
| 自定义弹窗 | `<el-dialog>` |
| 自定义日历 | `<el-calendar>` |
| 自定义 Tab | `<el-tabs>` + `<el-tab-pane>` |
| toast 通知 | `ElMessage` |
| 全局 loader | `ElLoading.service` |
| 下拉菜单 | `<el-dropdown>` |
| 状态标签 | `<el-tag>` |
| 空状态 | `<el-empty>` |
| 确认删除 | `ElMessageBox.confirm` |

### 6. 样式策略

- **删除** `styles.css`（5262 行），用 Element Plus 主题替代
- 仅保留少量全局样式（CSS 变量、布局容器、品牌色）写在 `src/styles/global.css`
- 组件特定样式用 `<style scoped>`
- 暗色模式用 Element Plus 的 dark theme（`html.dark` class）

## 实施步骤

### Phase 1：项目搭建（脚手架）
1. 更新 `frontend/package.json`：添加 vue/vue-router/pinia/element-plus/@element-plus/icons-vue/@vitejs/plugin-vue/typescript/vue-tsc
2. 新建 `vite.config.ts`（替代 .js）、`tsconfig.json`、`env.d.ts`
3. 新建 `main.ts`：createApp + 注册 Pinia/Router/Element Plus
4. 新建 `App.vue`：基础布局
5. 删除 `copyLegacyScriptsPlugin`（不再需要）

### Phase 2：类型定义
- `types/index.ts`：定义 Product/Article/Platform/Task/GeoQuestion/AiSettings/UserModel 等 interface

### Phase 3：API 层迁移
- `api/client.ts`：从 `api-client.js` 移植 `geoApi` + 所有辅助函数
- `api/auth.ts`：移植登录/注册/token 逻辑
- `api/ai.ts`：移植 `callAI`/`aiFetch`
- 保留所有业务逻辑（path 翻译、expand、时间戳注入等）

### Phase 4：Store 迁移
- `stores/auth.ts`：token/user/登录/登出/refresh
- `stores/data.ts`：业务数据 + `load()` + `seedDefaultPlatforms()` + `seedDefaultAiSettings()`
- `stores/ai.ts`：AI 设置 + 自定义模型

### Phase 5：工具函数迁移
- `utils/helpers.ts`：escapeHtml/debounce/formatLocalNow/copyToClipboard/downloadFile/toCSV
- `utils/markdown.ts`：markdownToHtml
- `utils/ai-prompts.ts`：所有 prompt 模板（纯函数）

### Phase 6：App 壳 + 认证
- `App.vue`：sidebar + topbar + router-view + GlobalSearch + GlobalAi + FatalError
- `AppSidebar.vue`：导航菜单
- `AppTopbar.vue`：搜索 + 主题 + 刷新 + 用户菜单
- `AuthView.vue`：登录/注册
- 路由守卫：未登录跳转 AuthView

### Phase 7：六个业务视图（按复杂度递增）
1. `SettingsView.vue`（最简单，表单为主）
2. `PlatformsView.vue`（列表 + 详情）
3. `DashboardView.vue`（统计 + 覆盖率）
4. `TasksView.vue`（3 Tab：日历/看板/发布）
5. `ProductsView.vue`（3 Tab：基础/GEO/深度，最复杂）
6. `WorkshopView.vue`（Markdown 编辑器 + AI 生成 + JSON 导入）

### Phase 8：增强功能
- `composables/useTheme.ts`：暗色模式
- `composables/useShortcut.ts`：⌘K/⌘S/⌘/
- `composables/useAchievements.ts`：成就系统
- `GlobalSearch.vue`：全局搜索
- `GlobalAi.vue`：全局 AI 助手
- `OnboardingWizard.vue`：新手引导

### Phase 9：清理旧文件
- 删除 `frontend/src/js/` 整个目录
- 删除 `frontend/src/app.js`
- 删除 `frontend/src/index.html`（被新的 index.html 替代）
- 删除 `frontend/src/styles.css`
- 删除 `frontend/vite.config.js`

## 验证方案

### 本地测试（必须全过）

1. **启动**：`bash run.sh restart` → 前端 5175 + 后端 8085 正常启动
2. **登录**：
   - user001@geo.local / test1234 登录成功
   - 注册新账号成功
   - 登出后右侧详情不残留
3. **总览**：stats 数字正确、覆盖率显示、quick actions 跳转正常
4. **产品档案**：
   - 新建产品 → 列表更新
   - 编辑产品 → 保存成功
   - 3 Tab 切换：基础信息 / GEO 问题 / 深度编辑
   - AI 梳理产品档案（需 API Key）
   - GEO 问题：新建/编辑/AI 批量生成/AI 优化
   - 深度编辑：Markdown 编辑 + 图片库 + AI 助手
   - 删除产品
5. **内容工坊**：
   - 新建文章 → 编辑器打开
   - Markdown 工具栏 + 实时预览
   - AI 直接生成（需 API Key）
   - 生成 Prompt
   - JSON 批量导入
   - 状态流转：draft → review → approved → archived
   - 草稿自动保存
6. **发布平台**：
   - 新建/编辑/删除平台
   - 状态切换（启用/观察/停用）
   - 打开平台链接
7. **发布记录**：
   - 日历视图：按月显示
   - 看板视图：4 列拖拽
   - 发布表单：创建/编辑任务
   - 批量分配：选文章 + 选平台
   - 统计卡片：按产品/按平台
   - 快捷复制
8. **AI 设置**：
   - 预设切换
   - 保存 API Key
   - 自定义模型 CRUD
9. **路由**：
   - 刷新 `#/products/{id}/deep` 能恢复
   - 刷新 `#/workshop/{id}` 能恢复
   - 分享 URL 他人可访问
10. **全局功能**：
    - ⌘K 搜索
    - ⌘/ AI 助手
    - 暗色模式切换
    - 导出备份 JSON
    - 导入备份

### 部署测试
- `bash .local/deploy.sh` 部署到 geo.fulianli.top
- HTTPS 访问验证
- API 健康检查
- 登录 + 基础 CRUD 验证

## 风险与对策

| 风险 | 对策 |
|------|------|
| 13000 行重写，regression 多 | 按视图分批迁移，每完成一个视图立即测试 |
| Element Plus 视觉风格变化 | 用户已确认接受，利用 EP 主题定制保持简洁 |
| styles.css 删除后样式丢失 | Element Plus 覆盖 90% 场景，少数定制样式写 scoped |
| API 层逻辑复杂 | 逻辑 1:1 移植，不改任何业务逻辑，仅改模块化方式 |
| PB migration 不兼容 | 后端完全不动，migrations 不改 |

## 不变的部分

- `pocketbase/` 整个目录（migrations/hooks/二进制）
- `run.sh` / `start.bat` 启动脚本
- `.local/deploy.sh` 部署脚本
- PocketBase 数据模型（9 个集合）
- API 端点（`/api/bootstrap` `/api/coverage` `/api/tasks/assign` 等）
- 默认凭证（admin@geo.local / user001~005）
- Hash 路由 URL 格式
