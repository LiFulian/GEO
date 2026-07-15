# GEO Studio 开源化 MVP 完善方案

## Context（为什么做这件事）

GEO Studio 当前是一个功能完整的本地工具，但**以开源项目的标准看还停留在"个人作品"水平**：进仓库看不到 README、没有 CI、没有 issue/PR 模板、测试文件被 `.gitignore` 误排除、AGENTS.md 承担 README 角色且自带死链和缩进错误。本次改造目标：把项目提升到"准生产级开源仓库"门槛——GitHub 进来第一眼能看懂、能贡献、能跑 CI、有基本治理文档，但**不引入 Docker 验证、不重写 i18n 架构、不上 ESLint/Vitest**（这些留给后续）。

约束：用户偏好"简洁可维护"，故所有新增文件保持短小（每个 < 100 行），不堆砌配置。

## 范围与不做的事

**做**：
- 补齐顶层开源治理文件（README / CHANGELOG / SECURITY / CODE_OF_CONDUCT）
- 建立 `.github/` 社区基础设施（issue 模板、PR 模板、Dependabot、CI）
- 修复 AGENTS.md 已知 bug（缩进数、死链、错位承担 README 角色）
- 解禁 smoke test（修复 .gitignore）+ 让 CI 能跑

**不做**（留待后续）：
- 双语 README / i18n 架构（用户决定"顶部英文概要"已满足）
- ESLint / Prettier（避免一次性引入过多新依赖）
- Vitest 单元测试（保留现有 4 个 .cjs smoke test）
- Docker 镜像发布、Dockerfile 改动
- Storybook / GitHub Pages 文档站
- 改包管理器 / 升级 Vite / 重构 frontend 代码

## 文件级变更清单

### 1. 新增顶层文档（5 个文件）

| 文件 | 大小 | 作用 |
|------|------|------|
| [README.md](README.md) | ~120 行 | GitHub 首屏；顶部 2 句英文概要，正文中文；含功能列表、快速开始、架构图、贡献、许可 |
| [CHANGELOG.md](CHANGELOG.md) | ~30 行 | Keep a Changelog 格式；首个 v0.1.0 条目汇总当前能力 |
| [SECURITY.md](SECURITY.md) | ~50 行 | 漏洞报告邮箱、响应 SLA、支持版本、安全使用建议（API Key 风险） |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | ~30 行 | Contributor Covenant v2.1 中文简版（不直接搬英文版以保持本土化） |
| [.nvmrc](.nvmrc) | 1 行 | 固定 Node 版本为 20（与 CI 一致） |

### 2. 新增 .github/ 目录（6 个文件）

| 文件 | 作用 |
|------|------|
| [.github/ISSUE_TEMPLATE/bug_report.md](.github/ISSUE_TEMPLATE/bug_report.md) | Bug 报告模板：复现步骤/预期/实际/截图/环境 |
| [.github/ISSUE_TEMPLATE/feature_request.md](.github/ISSUE_TEMPLATE/feature_request.md) | 需求模板：动机/方案/替代方案 |
| [.github/ISSUE_TEMPLATE/config.yml](.github/ISSUE_TEMPLATE/config.yml) | 禁用空 issue、引导去 Discussions |
| [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) | PR 模板：变更说明/测试/截图/关联 issue |
| [.github/dependabot.yml](.github/dependabot.yml) | 周更 npm + github-actions + docker |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | 见下方"CI 设计" |

### 3. 修复现有文件（4 处改动）

- [AGENTS.md](AGENTS.md)
  - 第 247 行「4 空格缩进」→ 改为「2 空格缩进」（与 [.editorconfig](.editorconfig) 和 [CONTRIBUTING.md](CONTRIBUTING.md) 一致）
  - 死链 `#docker-部署` 改为真实锚点 `### Docker 部署`（或直接用相对路径 `#docker-部署` → `### docker-部署`，根据 GitHub 自动 slug 规则调整）
  - 顶部加一行指引："人类读者请看 [README.md](README.md)，本文件面向 AI 助手"
  - 「默认凭证」章节保留（与 README 表格内容互补，但 README 给人类看）

- [.gitignore](.gitignore) 第 32 行的 `test_*.cjs` 排除规则**删除**，让 4 个 smoke test 进版本控制

- [frontend/package.json](frontend/package.json)
  - 补 `engines.node: ">=18"`（与 AGENTS.md 一致）
  - 补 `repository.url` / `bugs.url` / `homepage` 字段
  - 补 `scripts.test: "node test_fixes_smoke.cjs"`（最小入口）
  - 补 `keywords: ["geo", "ai-optimization", "pocketbase", "vite"]`

- [CONTRIBUTING.md](CONTRIBUTING.md)
  - 顶部加一行指向 README 的"先读 README"指引

### 4. CI 设计（[.github/workflows/ci.yml](.github/workflows/ci.yml)）

不使用 Docker，按用户约束走原生方式：

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Install frontend deps
        run: bash run.sh install    # 新增子命令，仅装依赖不启服务
      - name: Start services
        run: bash run.sh start
      - name: Wait for services ready
        run: |
          for i in {1..30}; do
            curl -sf http://127.0.0.1:8085/api/health && curl -sf http://127.0.0.1:5175 && break
            sleep 2
          done
      - name: Run smoke tests
        run: |
          for t in test_*.cjs; do node "$t" || exit 1; done
      - name: Build frontend
        run: cd frontend && npm run build
      - name: Stop services
        if: always()
        run: bash run.sh stop
```

为此需给 [run.sh](run.sh) 加一个 `install` 子命令（约 5 行）：检查 `pocketbase/pocketbase` 存在性、检查 `frontend/node_modules` 存在性，缺失则按 [run.sh:108-141](run.sh) 既有下载/安装逻辑执行。

## 关键决策与权衡

1. **AGENTS.md 保留为 AI 专用，不删**——它是当前 AI 助手的入口，删了会破坏记忆连续性。改为顶部加人类读者指引。
2. **README 顶部英文概要 = 2 句**——不替代完整英文版（避免翻译成本），但用英文让 GitHub 国际化浏览者一眼能判断项目用途。
3. **CI 用 GitHub-hosted ubuntu**——零成本、零维护，与用户"原始方式"约束吻合（不依赖自托管 runner）。
4. **smoke test 进版本控制**——这是当前最容易补的"测试可观测性"短板；不进 git 的话 CI 永远跑不到。
5. **不引入 ESLint/Prettier**——`.editorconfig` 已能保证基本格式一致；用户偏好"简洁"，Linter 配置易膨胀失控。

## 验证清单（端到端）

按用户约束"不用 Docker 验证"，全程走 `run.sh`：

1. **本地启动**：在干净环境跑 `bash run.sh install && bash run.sh start && bash run.sh status`，确认两个服务都起来。
2. **管理员连通性**：用 [AGENTS.md](AGENTS.md) 里的 curl 命令登录 `_superusers`，确认能拿到 token 并列出集合。
3. **前端访问**：浏览器（或 curl）访问 `http://localhost:5175`，确认首页可加载、`/api/health` 200。
4. **smoke test 全部通过**：
   - `node test_article_draft.cjs`
   - `node test_fixes_smoke.cjs`
   - `node test_pdetail_save.cjs`
   - `node test_ux_fixes.cjs`
   - 每个返回 exit code 0。
5. **CI 模拟**：在本地按 CI 步骤手动跑一遍（`bash run.sh install && start && node test_*.cjs && cd frontend && npm run build`），确认无遗漏依赖。
6. **GitHub 渲染检查**（提交后由用户在网页端确认）：
   - README 徽章正常显示
   - issue 模板下拉出现 3 个选项
   - Dependabot 周更生效

## 执行顺序（一次性提交，文件依赖关系）

1. 写 4 个 .github/ 模板 + dependabot.yml + ci.yml
2. 改 [run.sh](run.sh) 加 install 子命令
3. 写 5 个顶层文档（README / CHANGELOG / SECURITY / CoC / .nvmrc）
4. 改 3 个现有文件（AGENTS.md / .gitignore / frontend/package.json / CONTRIBUTING.md）
5. 跑验证清单 1-5
6. 一次 commit（commit message：`docs: open-source MVP - add README/CHANGELOG/SECURITY/CoC, .github templates and CI`）

## 风险与回退

- **CI 跑通概率**：smoke test 之前在本地能跑，但 GitHub runner 的 Linux 环境与 macOS 行为可能差异。回退：先 push 一版不带 CI 触发的 commit（仅 `[skip ci]` 标记），再开 CI。
- **AGENTS.md 改动影响 AI 记忆**：本次只改 bug 与顶部指引，不动技术约束章节，向后兼容。
- **run.sh 加 install 子命令**：如果未来用户在 Windows 用 start.bat，需对齐补 install 逻辑；本次先不动。
