# Changelog

本项目所有重要变更都会记录在此文件。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中
- 团队协作（共享产品档案）
- 内容效果分析（AI 助手引用监测）
- 国际化（i18n）
- 接入 Claude / Gemini 模型预设

## [0.1.0] - 2026-07-12

首个公开版本（MVP）。本次发布同时完成开源治理基线：README / CHANGELOG / SECURITY / Code of Conduct / .github 模板 / CI / Dependabot。

### Added
- 产品档案 CRUD + AI 梳理
- GEO 问题库：扁平化卡片 UI、状态/优先级管理、覆盖率统计
- AI 智能优化：问题措辞优化、意图/人群补全、内容创作角度生成
- AI 批量生成 GEO 问题（基于产品档案）
- 内容工坊：软文 / 短视频脚本 / 小红书笔记 / 创意文案 / 教程 / 竞品分析 / 新闻稿 / 社媒动态 / SEO 文章
- Markdown 编辑器：工具栏 + 实时预览 + 草稿自动保存
- AI 改写 / 扩写 / 平台适配改写
- 文章审核流：draft → review → approved → archived
- 发布平台矩阵：14+ 国内主流平台预置
- 发布任务管理：日历视图 + 看板视图（4 列拖拽）+ 批量分配
- 文章审核通过后自动创建发布任务
- 多模型 AI 集成：智谱 GLM + CogView、OpenAI、DeepSeek、字节豆包、阿里通义千问、本地 Ollama
- 双模式 AI：手动 Prompt 模式 / API 直连模式
- 自定义模型：添加任意 OpenAI-compatible 接口
- 多用户隔离（`user_id`）+ JWT 认证
- 暗色模式 + 全局搜索（⌘K）+ 成就系统 + 每日写作灵感 + 内容质量评分
- Hash 路由（URL 可分享、可刷新）
- 一键启动脚本（mac/Linux/Windows）
- CI（GitHub Actions）：冒烟测试 + 构建校验
- Dependabot：npm + GitHub Actions 周更
- Issue 模板（Bug / Feature）、PR 模板、Code of Conduct、Security Policy

### Security
- API Key 按 user_id 隔离存储（仅本人可读写）
- 强烈建议使用受限 Key（限额 / IP 白名单）

### Notes
- 当前 AI API Key 在本地 SQLite 中**明文存储**——属设计权衡，详见 [SECURITY.md](SECURITY.md)
- PocketBase 0.22+ admin 端点为 `/api/collections/_superusers/auth-with-password`
