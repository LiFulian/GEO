# Vue 3 重构收尾计划：TasksView + 增强 + 清理测试

## Summary

接续已完成的 Phase 1–7（5/6 视图），完成最后三块工作：
1. **TasksView.vue** — 第 6 个也是最后一个业务视图（发布记录：日历/看板/发布表单 3 Tab）
2. **Phase 8 增强** — 补齐成就系统、快捷键、文章草稿自动保存、新手引导
3. **Phase 9 清理 + 测试** — 删除旧 vanilla JS 文件，本地全流程测试，部署验证

后端（PocketBase + migrations + hooks）完全不动。前端从原生 JS 13055 行重写为 Vue 3 + TS + Element Plus 架构。

## Current State Analysis

### 已完成（经 Glob 验证）

| 阶段 | 文件 | 状态 |
|------|------|------|
| Phase 1 脚手架 | package.json / vite.config.ts / tsconfig.json / env.d.ts / index.html / main.ts / styles/global.css | ✅ |
| Phase 2 类型 | types/index.ts（含 PublishTask 完整定义，含 expand 展平字段） | ✅ |
| Phase 3 API | api/client.ts（含 flattenTaskExpand / apiAssignTasks / publish_tasks expand）/ api/auth.ts / api/ai.ts | ✅ |
| Phase 4 Store | stores/auth.ts / stores/data.ts（tasks ref + load + clear） | ✅ |
| Phase 5 Utils | utils/helpers.ts（escapeHtml/debounce/formatLocalNow/copyToClipboard/exportCSV）/ utils/markdown.ts / utils/ai-prompts.ts（含 PLATFORM_BEST_TIME / getPlatformBestPublishTime） | ✅ |
| Phase 6 壳 | App.vue / AppSidebar.vue / AppTopbar.vue / AuthView.vue / FatalError.vue / GlobalSearch.vue / GlobalAi.vue / router/index.ts（含 /tasks 与 /tasks/:tab 路由）/ composables/useTheme.ts / composables/useToast.ts | ✅ |
| Phase 7 视图 5/6 | DashboardView / SettingsView / PlatformsView / ProductsView / WorkshopView | ✅ |

### 缺失

| 项 | 说明 |
|----|------|
| **views/TasksView.vue** | 第 6 个视图，路由已注册但组件不存在 → 当前访问 /tasks 会 404 |
| **composables/useAchievements.ts** | 成就系统（8 个成就 + 解锁弹窗 + localStorage 持久化） |
| **composables/useShortcut.ts** | ⌘K 搜索 / ⌘/ AI / ⌘S 保存快捷键（部分可能已在 GlobalSearch/GlobalAi 内联） |
| **composables/useArticleDraft.ts** | 文章草稿自动保存（WorkshopView 可能已内联 debounce save） |
| **components/OnboardingWizard.vue** | 新手引导（首次登录引导） |
| **旧文件清理** | frontend/src/js/（7 个 .js）/ frontend/src/app.js / frontend/src/styles.css（5262 行） |
| **测试验证** | 本地启动 + 全流程 CRUD + 路由 + AI + 部署 |

### TasksView 需求（基于 render.js L1355-1649 + events.js L1287-1360, L1728-1800, L2224-2271, L2734-2800）

**3 个 Tab**：
1. **发布日历** — 月历视图，按 published_at（已发布）或 created_at（其他）显示任务；点击任务跳看板
2. **看板视图** — 4 列（todo/published/revise/skipped），卡片支持 HTML5 拖拽改状态
3. **发布页面** — 创建发布任务表单 + 批量分配

**顶部统计栏**（3 Tab 共享）：
- 4 个统计卡片：发布任务总数 / 已发布 / 待发布 / 平台覆盖
- 搜索框（按文章标题/平台名/账号/标签过滤）
- 产品 + 平台筛选下拉（影响看板统计）

**看板卡片功能**：
- 显示：标题、平台名/分类/账号、登录备注、最佳发布时间（todo 状态）、风险提示
- 操作：URL 输入框、打开平台、复制菜单（标题/正文/整包/分享）、分享卡片、状态切换（已发布/需修改/跳过）、删除
- 拖拽：卡片拖到另一列即更新状态，published 时自动注入 published_at

**发布表单字段**：
- 产品选择 → 文章选择（按产品过滤）→ 平台选择
- 发布链接（选平台后自动填充平台 URL）
- 状态（默认 todo）
- 备注
- 批量分配：多选文章 + 多选平台 → 调 /api/tasks/assign

## Proposed Changes

### Step 1: 创建 TasksView.vue（核心）

**文件**：`frontend/src/views/TasksView.vue`

**结构**：
```
<template>
  <div class="tasks-view">
    <!-- 顶部统计栏 + 搜索 + 筛选 -->
    <section class="tasks-header">
      <el-row :gutter="12"> 4 个 el-col 统计卡片 </el-row>
      <el-input v-model="searchQuery" placeholder="搜索任务..." />
      <el-select v-model="filterProduct"> 全部产品 </el-select>
      <el-select v-model="filterPlatform"> 全部平台 </el-select>
    </section>

    <!-- 按产品/平台统计（看板 Tab 专属） -->
    <section v-if="activeTab === 'board'" class="board-stats">
      <div>按产品统计：mini 卡片网格</div>
      <div>按平台统计：mini 卡片网格</div>
    </section>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="发布日历" name="calendar">
        <!-- 自定义月历：header（上月/下月）+ 7列网格 -->
      </el-tab-pane>
      <el-tab-pane label="看板视图" name="board">
        <!-- 4 列拖拽看板 -->
      </el-tab-pane>
      <el-tab-pane label="发布页面" name="publish">
        <!-- el-form 发布表单 + 批量分配 -->
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
```

**script setup 关键逻辑**：
- `activeTab` 双向绑定路由 `route.params.tab`（calendar/board/publish），watch route 同步 tab
- `filteredTasks` computed：按 searchQuery + filterProduct + filterPlatform 过滤
- `taskStats` computed：total/published/todo/revise/skipped + 平台覆盖
- `calendarTasks` computed：按日分组（key = `${year}-${month}-${day}`）
- 4 个看板列 computed：按 status 分组
- `taskCopyText(task, kind)`：复用原逻辑（title/body/all/share）
- `moveTaskToStatus(id, newStatus)`：PATCH + published_at 注入
- `saveTask()`：POST 新任务
- `assignTasks()`：POST /api/tasks/assign
- `deleteTask(id)`：ElMessageBox.confirm + DELETE
- 拖拽：`@dragstart`/`@dragover.prevent`/`@drop` 原生 HTML5 DnD（与原 setupTaskBoardDnD 逻辑一致）
- 月历导航：`prevMonth()`/`nextMonth()` 修改 `calendarDate` ref
- 分享卡片：用 ElMessageBox.alert 简化（原 showShareCard 太重，Element Plus 无原生 share card）
- 最佳发布时间：`getPlatformBestPublishTime(task.platform_name)` 从 utils/ai-prompts 导入

**样式**：`<style scoped>` 实现看板列、日历网格、任务卡片；复用 global.css 的 CSS 变量。

**关键复用**：
- `useDataStore()` → tasks, products, platforms, articles
- `useToast()` → toast/success/warning/error/confirm
- `geoApi('/api/tasks', ...)` → CRUD
- `copyToClipboard` / `formatLocalNow` from utils/helpers
- `getPlatformBestPublishTime` from utils/ai-prompts

### Step 2: 创建缺失的 composables（Phase 8）

#### 2a. `composables/useAchievements.ts`
- 8 个成就定义（first_product / first_article / first_publish / five_published / ten_published / three_products / coverage_50 / coverage_100）
- `unlocked` Set + localStorage 持久化（key: `geo_achievements`）
- `checkAchievements(dataStore)`：遍历成就，新解锁的弹 ElMessage 通知
- 在 App.vue 的 `bootstrapApp` 后调用一次 + 数据变化时 watch 调用

#### 2b. `composables/useShortcut.ts`
- 注册全局 keydown：⌘K/Ctrl+K → 打开 GlobalSearch；⌘/ → 打开 GlobalAi
- 通过事件总线或 emit 触发（GlobalSearch/GlobalAi 已有内部触发逻辑，这里只补全局快捷键监听）
- 在 App.vue onMounted 调用 `useShortcut().init()`

#### 2c. `composables/useArticleDraft.ts`
- 检查 WorkshopView.vue 是否已内联 debounce 自动保存
- 若未实现，抽取为 composable：`useArticleDraft(articleId, body)` → debounced watch + localStorage 缓存
- 若已内联，跳过此文件（避免过度抽象）

### Step 3: 补齐 App.vue 集成

**文件**：`frontend/src/App.vue`

- 导入并调用 `useAchievements` + `useShortcut`
- `bootstrapApp` 成功后 `checkAchievements()`
- watch `data.tasks` 变化时再次 `checkAchievements()`

### Step 4: 创建 OnboardingWizard.vue（可选，优先级低）

**文件**：`frontend/src/components/OnboardingWizard.vue`

- 首次登录（localStorage `geo_onboarded` 未设置）显示引导
- 用 ElTour 或简易 ElDialog 实现 3-4 步引导
- 若时间紧张可跳过，标记为后续优化

### Step 5: 旧文件清理（Phase 9）

**删除**（用 DeleteFile 批量）：
- `frontend/src/js/render.js`
- `frontend/src/js/events.js`
- `frontend/src/js/state.js`
- `frontend/src/js/enhancements.js`
- `frontend/src/js/api-client.js`
- `frontend/src/js/ai-prompts.js`
- `frontend/src/js/utils.js`
- `frontend/src/app.js`
- `frontend/src/styles.css`

**验证**：删除后 `npm run build` 无报错（确认无残留引用）。

### Step 6: 本地测试（必须全过）

**启动**：
```bash
bash run.sh restart
# 验证前端 5175 + 后端 8085 正常
```

**类型检查 + 构建**：
```bash
cd frontend && npm run build
# vue-tsc --noEmit + vite build 无错误
```

**功能测试清单**（浏览器手动验证）：
1. 登录 user001@geo.local / test1234
2. 总览：stats + 覆盖率显示
3. 产品档案：新建/编辑/3 Tab 切换/GEO 问题/深度编辑/删除
4. 内容工坊：新建文章/Markdown 编辑/AI 生成/状态流转
5. 发布平台：CRUD/状态切换
6. **发布记录**（重点）：
   - 日历：月份切换/任务显示/点击跳看板
   - 看板：4 列显示/拖拽改状态/URL 输入/复制菜单/删除
   - 发布表单：产品→文章→平台联动/保存/批量分配
7. AI 设置：预设切换/保存 Key
8. 路由：刷新 `#/products/{id}/deep` / `#/tasks/board` 能恢复
9. 全局：⌘K 搜索 / ⌘/ AI / 暗色模式 / 导出备份

### Step 7: 部署测试

```bash
bash .local/deploy.sh
# 部署到 geo.fulianli.top
# HTTPS 访问验证 + API 健康检查 + 登录 + 基础 CRUD
```

## Assumptions & Decisions

1. **TasksView 单文件实现**：不拆分为 TaskCalendar/TaskBoard/TaskForm 子组件。原代码 3 个视图共享 filteredTasks/stats，拆分会增加 props/emit 复杂度。单文件约 600-800 行，可接受。

2. **日历用自定义网格而非 el-calendar**：el-calendar 样式重、定制难，原设计是简洁的 7 列月历，自定义实现更贴近原样且可控。

3. **拖拽用原生 HTML5 DnD**：不引入 vuedraggable 等库，保持依赖最小化。原 setupTaskBoardDnD 逻辑已验证可用，直接移植。

4. **分享卡片简化**：原 showShareCard 是复杂 modal + 质量评分，Vue 版用 ElMessageBox.alert 简化为核心复制功能，避免过度设计。

5. **成就系统在 App.vue 集中调用**：不每个视图单独调，统一在数据加载后 + tasks 变化时检查。

6. **OnboardingWizard 优先级低**：若主体功能测试通过且时间允许再做，否则标记 TODO。

7. **旧文件删除前先 build 验证**：确保无残留 `import` 引用旧 JS。

8. **stores/ai.ts 和 utils/csv.ts 不单独创建**：ai_settings 已在 data store，CSV 函数已在 helpers.ts，无需为"目录结构对齐"而拆分。

## Verification Steps

| 步骤 | 验证方法 | 通过标准 |
|------|----------|----------|
| 1. 类型检查 | `cd frontend && npm run type-check` | 0 errors |
| 2. 构建 | `npm run build` | dist/ 生成无错 |
| 3. 启动 | `bash run.sh restart` | 前端 5175 + 后端 8085 可访问 |
| 4. 登录 | 浏览器访问 http://localhost:5175 | user001 登录成功 |
| 5. 路由 | 直接访问 #/tasks/board | TasksView 正常渲染 |
| 6. 日历 | 切换月份 | 任务显示在正确日期 |
| 7. 看板拖拽 | 拖卡片到另一列 | 状态更新 + toast 提示 |
| 8. 发布表单 | 选产品→文章→平台→保存 | 任务出现在看板 todo 列 |
| 9. 批量分配 | 多选文章+平台→分配 | 任务批量创建 |
| 10. 旧文件清理 | 删除后重新 build | 0 errors |
| 11. 部署 | `bash .local/deploy.sh` | HTTPS 访问正常 |

## 执行顺序

1. 创建 TasksView.vue（Step 1）
2. 类型检查 + 本地启动验证 TasksView（Step 6 部分）
3. 创建 useAchievements + useShortcut（Step 2a, 2b）
4. 检查 WorkshopView 是否已有草稿自动保存（Step 2c 决策）
5. 更新 App.vue 集成（Step 3）
6. 可选：OnboardingWizard（Step 4）
7. 删除旧文件（Step 5）
8. 完整本地测试（Step 6）
9. 部署测试（Step 7）
