# GEO Studio

本地 GEO（生成引擎优化）内容运营工具，管理产品档案、GEO 问题库、文章内容库、发布平台矩阵及任务分配。支持 AI 辅助生成文章内容与图片。

## 核心工作流

```text
产品档案 → GEO 问题库 → 内容生成 → 文章审核 → 人工发布 → 发布记录
```

## 架构

```
浏览器 (http://localhost:5175)    ← Vite dev server
        │
        ▼ /api/*
PocketBase (http://127.0.0.1:8085) ← 后端 API + 数据库
```

- **前端**：Vite + 原生 JS/CSS（端口 5175）
- **后端**：PocketBase（端口 8085），内置 SQLite
- **无登录**：本地单用户，API Key 存 PocketBase

## 启动

### 1. 启动后端（PocketBase）

```bash
./pocketbase/pocketbase serve --http=127.0.0.1:8085 --dir=./pocketbase/pb_data
```

首次运行需要创建超级管理员：

```bash
./pocketbase/pocketbase superuser upsert "admin@geo.local" "admin123456" --dir=./pocketbase/pb_data
```

PocketBase 管理面板：http://127.0.0.1:8085/_/

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

打开：http://localhost:5175

## 数据模型

| 集合 | 说明 |
|------|------|
| products | 产品档案 |
| platforms | 发布平台矩阵 |
| articles | 文章内容库 |
| geo_questions | GEO 问题库 |
| publish_tasks | 发布任务 |
| ai_settings | AI 模型设置 |

## AI 使用方式

### 手动 Prompt 模式

1. 在系统里创建产品档案
2. 进入「内容生成」，选择产品、篇数、平台、内容类型
3. 点击「生成 Prompt」，复制到 Codex / Trae / 豆包 / DeepSeek
4. 把 AI 返回的 JSON 粘回系统，「导入文章库」

### API 直连模式

配置 OpenAI-compatible 文本 + 图片模型（智谱 GLM 默认配置），系统直接调用 API 生成文章和配图。API Key 保存在本地 PocketBase 数据库。

### GEO 问题库

先整理用户会问 AI 的问题（例如「有没有适合小团队用的客户跟进小程序？」），再围绕问题生成内容。内容生成 Prompt 自动带入产品的 active 问题。

## 平台发布

人工发布流程：在发布看板复制标题/正文 → 点击打开平台 → 人工发布 → 回系统标记已发布并粘贴链接。

## 数据备份

PocketBase 数据在 `pocketbase/pb_data/` 目录，直接备份该目录即可。

## 旧版

旧版 Python 单体应用代码已归档到 `legacy/` 目录。
