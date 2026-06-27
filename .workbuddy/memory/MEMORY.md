# GEO Studio — 项目记忆

## 端口约定

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 (Frontend) | **5175** | Vite 开发服务器或静态资源托管 |
| 后端 (PocketBase) | **8085** | PocketBase 服务 |

## 项目简介

GEO Studio 是一个本地 GEO（生成引擎优化）内容运营工具，用于管理产品档案、GEO 问题库、文章内容库、发布平台矩阵及任务分配。支持 AI 辅助生成文章内容与图片。

## 架构

- 后端：PocketBase（端口 8085）
- 前端：独立的前端应用（端口 5175），通过 API 与后端通信
- 数据存储：SQLite（PocketBase 内置）
- AI 调用：前端直连 OpenAI-compatible API（不再依赖后端）
