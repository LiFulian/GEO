# GEO Studio

GEO（生成引擎优化）内容运营工具，管理产品档案、GEO 问题库、文章内容库、发布平台矩阵及任务分配。支持 AI 辅助生成文章内容与图片，多用户注册登录，自定义 AI 模型。

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
- **多用户**：注册登录，数据隔离，每人可配置独立 AI Key 和自定义模型

## 启动

```bash
bash run.sh start    # 启动前端 + 后端
bash run.sh stop     # 停止
bash run.sh restart  # 重启
bash run.sh status   # 查看状态
```

打开：http://localhost:5175

预注册账号：user001 ~ user005，密码 test1234

PocketBase 管理面板：http://127.0.0.1:8085/_/

## 数据模型

| 集合 | 说明 |
|------|------|
| products | 产品档案 |
| platforms | 发布平台矩阵 |
| articles | 文章内容库 |
| geo_questions | GEO 问题库 |
| publish_tasks | 发布任务 |
| ai_settings | AI 模型设置 |
| user_models | 用户自定义模型 |
| users | 用户账号 |

## 升级 PocketBase

### 检查当前版本

```bash
./pocketbase/pocketbase --version
```

### 升级步骤

```bash
# 1. 停止服务
bash run.sh stop

# 2. 下载最新版 PocketBase（替换二进制文件）
# 去 https://github.com/pocketbase/pocketbase/releases/latest 获取最新版本号
VER="0.39.4"  # 替换为实际最新版本
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

> **注意**：
> - PocketBase 升级后首次启动会自动执行 `pb_migrations/` 中未运行的迁移
> - `pb_data/` 目录是数据库，升级不会影响数据
> - 如果迁移出错，可回滚：还原旧版二进制文件 + 数据备份即可
> - `run.sh` 中的 `local ver="0.39.4"` 是首次下载时的默认版本，二进制升级后无需修改

### 多项目 PocketBase 端口隔离

本机有多个 PocketBase 项目时，`run.sh` 仅操作本项目（端口 8085），不会影响其他端口的 PocketBase 实例。

## AI 使用方式

### 手动 Prompt 模式

1. 在系统里创建产品档案
2. 进入「内容生成」，选择产品、篇数、平台、内容类型
3. 点击「生成 Prompt」，复制到 Codex / Trae / 豆包 / DeepSeek
4. 把 AI 返回的 JSON 粘回系统，「导入文章库」

### API 直连模式

配置 OpenAI-compatible 文本 + 图片模型（智谱 GLM 默认配置），系统直接调用 API 生成文章和配图。API Key 保存在本地 PocketBase 数据库。

也支持添加自定义模型（「内容生成 → AI 设置 → 我的自定义模型」）。

### GEO 问题库

先整理用户会问 AI 的问题（例如「有没有适合小团队用的客户跟进小程序？」），再围绕问题生成内容。内容生成 Prompt 自动带入产品的 active 问题。

## 平台发布

人工发布流程：在发布看板复制标题/正文 → 点击打开平台 → 人工发布 → 回系统标记已发布并粘贴链接。

## 数据备份

PocketBase 数据在 `pocketbase/pb_data/` 目录，直接备份该目录即可。
