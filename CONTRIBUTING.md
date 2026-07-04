# 贡献指南

感谢你对 GEO Studio 的关注！本文档帮助你快速参与贡献。

## 开发环境准备

### 前置要求

- Node.js 18+（推荐 20 LTS）
- Bash（macOS/Linux/WSL）或 Windows CMD
- 代码编辑器：VS Code / WebStorm / Vim 等任意

### 启动开发环境

```bash
# 克隆你 fork 的仓库
git clone https://github.com/your-username/geo-studio.git
cd geo-studio

# 一键启动（自动下载 PocketBase + 安装依赖 + 启动服务）
bash run.sh start   # macOS/Linux/WSL
# 或
start.bat            # Windows
```

打开 http://localhost:5175 即可。

### 项目结构

```
geo-studio/
├── frontend/                # 前端
│   ├── src/
│   │   ├── index.html       # 单页应用（所有视图模板）
│   │   ├── app.js           # 入口
│   │   ├── styles.css       # 全局样式
│   │   └── js/
│   │       ├── state.js         # 全局状态 + 默认值
│   │       ├── api-client.js    # API 客户端（三层封装）
│   │       ├── render.js        # 视图渲染
│   │       ├── events.js        # 事件绑定
│   │       ├── ai-prompts.js    # AI Prompt 模板
│   │       ├── enhancements.js  # 主题/快捷键/搜索
│   │       └── utils.js         # 工具函数
│   ├── vite.config.js
│   └── package.json
├── pocketbase/              # 后端
│   └── pb_migrations/       # 数据库迁移（12 个集合）
├── Dockerfile
├── docker-compose.yml
├── run.sh                   # 一键启动（macOS/Linux）
├── start.bat                # 一键启动（Windows）
└── README.md
```

## 代码风格

### 通用规则

- **缩进**：2 空格（已在 `.editorconfig` 中统一）
- **引号**：单引号 `'`
- **分号**：末尾不加分号（保持与现有代码一致）
- **换行符**：LF
- **编码**：UTF-8

### JavaScript 风格

```javascript
// ✅ 推荐
const foo = 'bar'
function doSomething(arg) {
  if (!arg) return null
  return arg.map(item => item.id)
}

// ❌ 避免
const foo = "bar";           // 双引号 + 分号
function doSomething(arg) {
    if (!arg) {                // 4 空格缩进
        return null;
    }
    return arg.map((item) => {  // 不必要的箭头函数括号
        return item.id;
    });
}
```

### HTML/CSS 风格

- HTML 属性用双引号 `class="foo"`
- CSS 类名用 kebab-case（`my-class-name`）
- CSS 嵌套不要超过 3 层

## 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**：

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(workshop): 新增短视频脚本生成` |
| `fix` | 修复 bug | `fix(render): 修复产品列表分页错误` |
| `docs` | 文档 | `docs(readme): 更新部署说明` |
| `refactor` | 重构 | `refactor(api-client): 简化请求拦截` |
| `chore` | 杂项 | `chore: 升级依赖版本` |
| `test` | 测试 | `test: 添加文章导入测试` |
| `style` | 格式 | `style: 统一缩进` |

**范围**（可选）：`products`, `platforms`, `workshop`, `tasks`, `geo`, `ai`, `auth`, `ui` 等

**示例**：
```
feat(geo): AI 智能优化问题措辞与内容角度

- 新增 aiOptimizeGeoQuestion 函数
- 卡片新增 AI 优化按钮
- 复用 callAI 接口，温度 0.6

Closes #42
```

## 开发流程

### 1. 选择 Issue

- 在 GitHub Issues 中选择你想做的任务
- 评论认领：「我来做这个」
- 重大改动建议先开 Issue 讨论

### 2. 创建分支

```bash
git checkout -b feat/your-feature
# 或
git checkout -b fix/issue-42
```

### 3. 编码

- 遵循上述代码风格
- 优先复用 `utils.js` 中的工具函数（`$`, `$$`, `escapeHtml`, `api`, `toast` 等）
- 新功能尽量独立成模块
- 避免单个文件过大（> 500 行考虑拆分）

### 4. 自测

```bash
# 语法检查
cd frontend/src && node --check js/*.js

# 启动 dev 服务器手动验证
bash run.sh restart
```

### 5. 提交

```bash
git add .
git commit -m "feat(scope): 简短描述"
```

### 6. 推送 & PR

```bash
git push origin feat/your-feature
```

到 GitHub 提交 Pull Request，描述：
- 做了什么改动
- 为什么改（关联 Issue）
- 如何测试

## 数据模型变更

如果需要新增字段或集合：

1. 在 `pocketbase/pb_migrations/` 创建迁移文件，命名 `1NNNNNNNNNN_description.js`
2. 迁移文件模板：

```javascript
migrate(
  (app) => {
    // up
    const collection = app.findCollectionByNameOrId('products')
    collection.fields.add(
      new Field({ name: 'new_field', type: 'text', required: false })
    )
    app.save(collection)
  },
  (app) => {
    // down
    const collection = app.findCollectionByNameOrId('products')
    collection.fields.removeByName('new_field')
    app.save(collection)
  }
)
```

3. 重启服务时自动执行迁移

## AI Prompt 变更

`frontend/src/js/ai-prompts.js` 是 Prompt 模板库。修改时：

- 保持函数纯净：输入产品/平台/问题，输出字符串
- 不要在 Prompt 函数里调用 API
- 测试时用 `console.log(buildXxxPrompt(...))` 查看 Prompt
- 注意 JSON 输出格式与 `extractJsonArray` / `extractJsonObject` 兼容

## 报告 Bug

提交 Issue 时请包含：

1. **复现步骤**：具体操作流程
2. **预期行为**：应该是什么
3. **实际行为**：实际发生了什么
4. **环境**：浏览器、操作系统、是否 Docker 部署
5. **截图**：如有

## 提议新功能

欢迎在 Issue 中提议新功能！请说明：

1. **场景**：解决什么问题
2. **方案**：希望怎么实现
3. **替代方案**：考虑过的其他方式

## 行为准则

- 尊重所有贡献者
- 假设善意
- 关注项目目标（GEO 内容运营）
- 不接受任何形式的歧视或骚扰

## License

贡献的代码将遵循 [MIT License](./LICENSE)。
