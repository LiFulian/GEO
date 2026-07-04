/* GEO Studio — AI Prompt Templates
 *
 * 所有 AI Prompt 生成逻辑，从旧 Python lib/ai.py 移植。
 * 纯粹生成 prompt 文本，不发起任何 API 调用。
 */

// ===== 辅助函数 =============================================================

/**
 * 串接平台列表为文本
 */
function formatPlatforms(platforms, maxCount = 20) {
  if (!platforms || platforms.length === 0) return "暂无平台信息";
  return platforms.slice(0, maxCount)
    .map(p => `- ${p.name}：${p.content_style || ""}；标题风格：${p.title_style || ""}；字数：${p.recommended_words || ""}；备注：${p.notes || ""}`)
    .join("\n");
}

/**
 * 串接 GEO 问题列表为文本
 */
function formatGeoQuestions(questions, maxCount = 20) {
  if (!questions || questions.length === 0) return "- 暂无明确 GEO 问题，请先根据产品信息推断用户会问 AI 的问题。";
  return questions.slice(0, maxCount)
    .map(q => `- [id=${q.id}] ${q.question}；搜索意图：${q.intent || ""}；内容角度：${q.content_angle || ""}；优先级：${q.priority || ""}`)
    .join("\n");
}

// ===== Prompt 模板 =========================================================

/**
 * 文章内容生成 Prompt（增强版：GEO 强化 + SEO 优化 + 多样性保证）
 * 等效 Python: product_prompt()
 */
function buildProductPrompt(product, platforms, count, contentTypes, questions) {
  const platformLines = formatPlatforms(platforms);
  const questionLines = formatGeoQuestions(questions);
  const types = (contentTypes && contentTypes.length > 0)
    ? contentTypes.join("、")
    : "产品介绍、竞品对比、场景种草、问题解决型、GEO 问答型";

  return `你是一个克制、真实、擅长 GEO/SEO 内容矩阵的中文内容运营专家，熟悉生成式引擎优化（让 AI 助手更容易引用你的内容）和搜索引擎 SEO。

请基于下面的产品信息，生成 ${count} 篇差异化软文草稿。

## 内容要求

1. **真实可信**：不要编造不存在的数据、奖项、用户评价、客户案例
2. **角度差异化**：每篇文章角度不同，避免同质化和洗稿感
3. **自然推荐**：广告感要弱，像真实用户/专业作者自然推荐
4. **平台适配**：每篇适配一个目标平台，遵守该平台内容风格与字数要求
5. **GEO 强化**：内容要让 AI 搜索/问答在回答相关问题时更容易引用这个产品：
   - 开头 100 字内直接回答用户可能问的问题
   - 使用清晰的标题结构（H2/H3）便于 AI 解析
   - 包含具体数据、案例、对比表格
   - 在结论处明确总结产品优势
6. **SEO 优化**：
   - 标题包含核心关键词（但不要堆砌）
   - 摘要自然包含 2-3 个相关关键词
   - 正文使用 H2/H3 分段，每段聚焦一个要点
   - 包含 FAQ 小节（如果适合）
   - 关键信息用**加粗**或列表突出
7. **输出格式**：JSON 数组，不要 Markdown 代码块，不要额外解释

## 产品信息

- 名称：${product.name || ""}
- 类型：${product.type || ""}
- 链接：${product.url || ""}
- 目标用户：${product.audience || ""}
- 核心卖点：${product.selling_points || ""}
- 竞品/替代品：${product.competitors || ""}
- 品牌语气：${product.tone || ""}
- 转化目标：${product.goal || ""}
- 禁用表达：${product.forbidden_words || ""}

## 内容类型范围

${types}

## 优先覆盖的 GEO 问题

如果某篇文章主要在回答其中某个问题，请把对应 id 填入 geo_question_id：
${questionLines}

## 可选平台参考

${platformLines}

## JSON 输出字段

每个对象包含：
- title：标题（包含核心关键词，15-30 字）
- summary：80 字以内摘要（含 2-3 个关键词）
- body：正文 Markdown（H2/H3 分段，800-2000 字）
- content_type：内容类型
- target_platform：目标平台名称
- keywords：逗号分隔关键词（5-8 个）
- tags：逗号分隔标签（3-5 个）
- image_prompt：配图建议（不需要则为空）
- risk_notes：广告感/平台风险/需人工核实的信息
- geo_question_id：主要回答的 GEO 问题 id（整数，无则填 0）
- faq：可选，FAQ 数组 [{q: "问题", a: "简短回答"}]，2-4 条`;
}

/**
 * GEO 问题库生成 Prompt（增强版：分类生成 + 意图多样化 + 关键词建议）
 * 等效 Python: geo_question_prompt()
 */
function buildGeoQuestionPrompt(product, count = 12) {
  // 按比例分配各类问题，保证多样性
  const discoveryCount = Math.max(2, Math.ceil(count * 0.3));   // 发现类
  const comparisonCount = Math.max(2, Math.ceil(count * 0.25));  // 对比类
  const howtoCount = Math.max(2, Math.ceil(count * 0.25));       // 操作类
  const evaluationCount = count - discoveryCount - comparisonCount - howtoCount; // 评估类

  return `你是一个 GEO（Generative Engine Optimization）内容策略助手，擅长挖掘用户在 AI 助手中真实会问的问题。

请基于产品信息，生成 ${count} 个高质量 GEO 问题。

产品信息：
- 名称：${product.name || ""}
- 类型：${product.type || ""}
- 链接：${product.url || ""}
- 目标用户：${product.audience || ""}
- 核心卖点：${product.selling_points || ""}
- 竞品/替代品：${product.competitors || ""}
- 转化目标：${product.goal || ""}

问题分类与配比（共 ${count} 个）：
- 发现类 ${discoveryCount} 个：用户寻找解决方案时的问题，如"有没有适合 XX 的工具"、"XX 用什么好"
- 对比类 ${comparisonCount} 个：用户做选择时的问题，如"XX 和 YY 哪个好"、"XX 怎么选"
- 操作类 ${howtoCount} 个：使用中遇到的具体问题，如"XX 怎么用"、"XX 如何配置"
- 评估类 ${evaluationCount} 个：判断是否合适的问题，如"XX 适合 XX 吗"、"XX 值得用吗"

要求：
1. 问题必须像真实用户会问 AI 助手（如智谱清言、ChatGPT、文心一言）的自然语言，不要广告标题
2. 每个问题的意图、人群、优先级都要明确
3. content_angle 要给出具体的内容创作角度建议（80 字以内），说明如何在回答中自然带出产品
4. 优先级判断：覆盖核心卖点、决策路径关键节点的问题为 high；具体操作类为 medium；边缘场景为 low
5. keywords 字段给出该问题相关的搜索关键词（3-5 个，逗号分隔），用于 SEO 优化
6. 输出必须是 JSON 数组，不要 Markdown 代码块，不要额外解释

每个对象包含：
- question：用户会问的问题（自然语言）
- intent：搜索/问答意图（discovery/comparison/howto/evaluation）
- audience：对应人群
- priority：high / medium / low
- content_angle：内容创作角度建议（80 字以内）
- target_platform：适合沉淀内容的平台，可为空
- keywords：相关搜索关键词（3-5 个，逗号分隔）`;
}

/**
 * 产品档案梳理 Prompt
 * 等效 Python: product_profile_prompt()
 */
function buildProductProfilePrompt(rawText, currentProduct) {
  let currentLines = "";
  if (currentProduct) {
    currentLines = `
当前表单已有信息：
- 名称：${currentProduct.name || ""}
- 类型：${currentProduct.type || ""}
- 链接：${currentProduct.url || ""}
- 目标用户：${currentProduct.audience || ""}
- 核心卖点：${currentProduct.selling_points || ""}
- 竞品/替代品：${currentProduct.competitors || ""}
- 品牌语气：${currentProduct.tone || ""}
- 转化目标：${currentProduct.goal || ""}
- 禁用表达：${currentProduct.forbidden_words || ""}`;
  }

  return `你是一个擅长 GEO（Generative Engine Optimization）的产品信息整理助手。

请根据用户输入的零散产品描述，整理并优化成适合后续 GEO 内容生成的产品档案。

用户输入：
${rawText}
${currentLines}
要求：
1. 只基于输入中能合理推断的信息，不要编造没有依据的用户量、融资、排名、奖项、客户案例。
2. 表达要清楚、克制、具体，避免营销空话。
3. 核心卖点要写成后续内容生成可直接引用的素材。
4. 目标用户要尽量具体到场景和角色。
5. 禁用表达里列出应该避免的夸张或高风险说法。
6. 输出必须是 JSON 对象，不要 Markdown 代码块，不要额外解释。

JSON 字段必须包含：
- name：产品名称，不确定则留空
- type：产品类型，如网站、小程序、SaaS、App、服务
- url：产品链接，不确定则留空
- audience：目标用户和使用场景
- selling_points：核心卖点，使用换行或分号分隔
- competitors：竞品/替代方案，不确定则留空
- tone：品牌语气，默认真实、专业、克制
- goal：转化目标，如访问官网、体验小程序、留资、下载
- forbidden_words：禁用表达和风险提示`;
}

/**
 * 平台适配 Prompt
 * 等效 Python: adaptation_prompt()
 */
function buildAdaptationPrompt(article, platform, product) {
  let productLines = "";
  if (product) {
    productLines = `
产品背景：
- 名称：${product.name || ""}
- 类型：${product.type || ""}
- 链接：${product.url || ""}
- 目标用户：${product.audience || ""}
- 核心卖点：${product.selling_points || ""}
- 禁用表达：${product.forbidden_words || ""}`;
  }

  return `你是一个克制、真实、熟悉中文内容平台规则的运营编辑。

请把下面这篇文章改写成适合「${platform.name || ""}」发布的版本。

平台规则：
- 分类：${platform.category || ""}
- 适合内容：${platform.content_style || ""}
- 推荐字数：${platform.recommended_words || ""}
- 标题风格：${platform.title_style || ""}
- 标签规则：${platform.tags_rule || ""}
- 外链限制：${platform.allows_external_links || ""}
- 软文适配：${platform.soft_article_fit || ""}
- 备注：${platform.notes || ""}
${productLines}
原文章：
- 标题：${article.title || ""}
- 摘要：${article.summary || ""}
- 类型：${article.content_type || ""}
- 关键词：${article.keywords || ""}
- 标签：${article.tags || ""}
- 风险提示：${article.risk_notes || ""}

正文：
${article.body || ""}

要求：
1. 不要编造不存在的数据、案例、用户评价、证书、排名。
2. 保留原文核心信息，但必须适配目标平台的语气和结构。
3. 降低广告感，避免夸张承诺和绝对化表述。
4. 如果平台不适合外链，把链接表达改成自然的产品名或搜索提示。
5. 输出必须是 JSON 对象，不要 Markdown 代码块，不要额外解释。

JSON 字段：
- title
- summary
- body
- content_type
- target_platform
- keywords
- tags
- image_prompt
- risk_notes`;
}

// ===== JSON 解析工具 =======================================================

/**
 * 剥离 Markdown 代码块围栏
 */
function stripCodeFence(text) {
  let t = (text || "").trim();
  if (!t.startsWith("```")) return t;
  t = t.replace(/^```[a-zA-Z]*\s*/, "");
  t = t.replace(/```\s*$/, "");
  return t.trim();
}

/**
 * 提取 JSON 数组
 */
function extractJsonArray(text) {
  let t = stripCodeFence(text);
  let parsed;
  try {
    parsed = JSON.parse(t);
  } catch {
    const start = t.indexOf("[");
    const end = t.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) throw new Error("没有找到可解析的 JSON 数组");
    parsed = JSON.parse(t.slice(start, end + 1));
  }
  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === "object") {
      parsed = parsed.articles || parsed.data || [parsed];
    }
  }
  if (!Array.isArray(parsed)) throw new Error("AI 返回结果不是 JSON 数组");
  return parsed.filter(item => item && typeof item === "object");
}

/**
 * 提取 JSON 对象
 */
function extractJsonObject(text) {
  let t = stripCodeFence(text);
  let parsed;
  try {
    parsed = JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("没有找到可解析的 JSON 对象");
    parsed = JSON.parse(t.slice(start, end + 1));
  }
  if (Array.isArray(parsed)) {
    parsed = parsed[0] || {};
  }
  if (!parsed || typeof parsed !== "object") throw new Error("AI 返回结果不是 JSON 对象");
  return parsed;
}

// ===== 图片生成 ============================================================

/**
 * 调用图片生成，支持图生图（base64）和文生图
 */
async function callImageGeneration(prompt, articleId) {
  const aiSettings = (typeof state !== "undefined") ? state.ai_settings : null;
  if (!aiSettings) throw new Error("未找到 AI 设置");

  const baseUrl = aiSettings.image_base_url || aiSettings.text_base_url || aiSettings.base_url || "";
  const model = aiSettings.image_model || "";
  const apiKey = aiSettings.image_api_key || aiSettings.text_api_key || aiSettings.api_key || "";

  if (!baseUrl || !model) throw new Error("请先配置图片模型 Base URL 和模型名");
  if (!apiKey) throw new Error("请先配置图片 API Key");
  if (!prompt) throw new Error("请先填写图片提示词");

  // 构建 URL：如果 base_url 不以 /images/generations 结尾，追加
  let url = baseUrl.replace(/\/$/, "");
  if (!url.endsWith("/images/generations")) url += "/images/generations";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`图片生成失败：${err.error?.message || `HTTP ${res.status}`}`);
  }

  return await res.json();
}

// ===== 一鱼多吃：一篇文章改写为多平台版本 ==================================

/**
 * 一鱼多吃 Prompt：基于一篇已有文章，生成 N 个平台差异化版本
 * @param {Object} article 原文章
 * @param {Array} platforms 目标平台列表
 * @param {Object} product 产品信息
 */
function buildContentRepurposePrompt(article, platforms, product) {
  const platformList = platforms.map((p, i) =>
    `${i + 1}. ${p.name}（${p.category || ""}）：${p.content_style || ""}；字数 ${p.recommended_words || "不限"}；标题风格 ${p.title_style || "不限"}；外链 ${p.allows_external_links || "不限"}`
  ).join("\n");

  return `你是一个擅长多平台内容分发的中文内容运营专家。请把下面这篇原文章改写成 ${platforms.length} 个不同平台的差异化版本，每个版本都要符合该平台的内容风格和规则。

## 原文章
- 标题：${article.title || ""}
- 摘要：${article.summary || ""}
- 类型：${article.content_type || ""}
- 关键词：${article.keywords || ""}

正文：
${article.body || ""}

## 目标平台
${platformList}

## 产品背景
- 名称：${product?.name || ""}
- 卖点：${product?.selling_points || ""}
- 禁用表达：${product?.forbidden_words || ""}

## 要求
1. 每个版本保留原文核心信息，但标题、开头、结构、语气都要按平台特点改写
2. 不要简单替换关键词，要真正按平台用户阅读习惯重构
3. 不要编造不存在的数据、案例、用户评价
4. 如果平台禁止外链，把产品介绍改为自然搜索提示（如"在 XX 搜索 XX"）
5. 输出 JSON 数组，每个对象对应一个平台版本

## JSON 输出字段
- target_platform：平台名
- title：改写后的标题
- summary：80 字以内摘要
- body：改写后的正文 Markdown
- content_type：内容类型
- keywords：关键词
- tags：标签
- image_prompt：配图建议
- risk_notes：风险提示`;
}

// ===== 发布前检查清单 =====================================================

/**
 * 生成发布前检查清单 Prompt
 * @param {Object} article 文章
 * @param {Object} platform 平台
 */
function buildPublishChecklist(article, platform) {
  return `你是发布前审核助手。请为以下文章生成发布到「${platform.name || ""}」前的检查清单。

## 文章
- 标题：${article.title || ""}
- 摘要：${article.summary || ""}
- 关键词：${article.keywords || ""}
- 标签：${article.tags || ""}

正文（前 500 字）：
${(article.body || "").slice(0, 500)}

## 平台规则
- 名称：${platform.name || ""}
- 内容风格：${platform.content_style || ""}
- 推荐字数：${platform.recommended_words || "不限"}
- 标题风格：${platform.title_style || "不限"}
- 标签规则：${platform.tags_rule || "不限"}
- 外链限制：${platform.allows_external_links || "不限"}
- 软文适配：${platform.soft_article_fit || ""}

## 要求
输出 JSON 对象：
{
  "score": 0-100 的合规分数,
  "checks": [
    { "item": "检查项", "status": "pass|warn|fail", "suggestion": "改进建议（如通过则为空）" }
  ],
  "summary": "总体评估，30 字以内"
}

检查项至少包含：
1. 字数是否达标
2. 标题是否符合平台风格
3. 是否有违禁词/广告法风险
4. 外链是否合规
5. 标签是否齐全
6. 开头是否吸引人（前 100 字）
7. 是否有具体的 CTA（行动召唤）`;
}

// ===== SEO 优化建议 =======================================================

/**
 * SEO 优化建议 Prompt
 * @param {Object} article 文章
 * @param {Array} keywords 目标关键词
 */
function buildSeoOptimizePrompt(article, keywords) {
  return `你是 SEO 优化专家。请分析以下文章的 SEO 表现，并给出具体优化建议。

## 文章
- 标题：${article.title || ""}
- 摘要：${article.summary || ""}
- 当前关键词：${article.keywords || ""}
- 目标关键词：${(keywords || []).join("、") || "未指定"}

正文：
${article.body || ""}

## 要求
输出 JSON 对象：
{
  "score": 0-100 的 SEO 分数,
  "keyword_density": { "关键词": 出现次数 },
  "suggestions": [
    { "type": "title|summary|body|structure|keywords", "issue": "问题描述", "fix": "具体修改建议" }
  ],
  "optimized_title": "优化后的标题",
  "optimized_summary": "优化后的摘要",
  "extra_keywords": ["建议新增的关键词1", "关键词2"]
}

评估维度：
1. 标题是否包含核心关键词且在 15-30 字内
2. 摘要是否自然包含 2-3 个关键词
3. 关键词密度是否合理（2-5%）
4. 是否使用 H2/H3 分段
5. 是否有列表/加粗等便于爬虫解析的结构
6. 是否有内链/外链建议
7. 移动端可读性`;
}

// ===== 平台最佳发布时间 ===================================================

// 各平台最佳发布时间建议（基于公开数据）
const PLATFORM_BEST_TIME = {
  "微信公众号": { weekday: "周二-周四", time: "20:00-22:00", note: "晚间阅读高峰，周末效果较差" },
  "知乎": { weekday: "周二-周五", time: "11:00-13:00, 20:00-23:00", note: "午休和睡前阅读高峰" },
  "小红书": { weekday: "周三-周五", time: "12:00-13:00, 19:00-21:00", note: "午休和晚间活跃度最高" },
  "今日头条": { weekday: "周一-周五", time: "07:00-09:00, 12:00-13:00, 18:00-20:00", note: "通勤、午休、下班时段" },
  "百家号": { weekday: "周二-周四", time: "09:00-11:00, 14:00-16:00", note: "工作时间阅读较多" },
  "抖音": { weekday: "周二-周四", time: "12:00-13:00, 18:00-22:00", note: "午休和晚间是流量高峰" },
  "B站": { weekday: "周五-周日", time: "18:00-23:00", note: "周末晚间投稿效果最好" },
  "微博": { weekday: "周二-周四", time: "12:00-13:00, 21:00-23:00", note: "午休和睡前活跃" },
  "掘金": { weekday: "周二-周四", time: "09:00-11:00, 20:00-22:00", note: "工作日技术内容阅读高峰" },
  "CSDN": { weekday: "周一-周五", time: "09:00-11:00, 14:00-16:00", note: "工作时间阅读为主" },
};

/**
 * 根据平台名获取最佳发布时间建议
 * @param {string} platformName
 * @returns {Object|null}
 */
function getPlatformBestPublishTime(platformName) {
  if (!platformName) return null;
  // 模糊匹配
  for (const [key, value] of Object.entries(PLATFORM_BEST_TIME)) {
    if (platformName.includes(key) || key.includes(platformName)) return { platform: key, ...value };
  }
  return null;
}

// ===== 挂载到全局 ==========================================================

window.buildProductPrompt = buildProductPrompt;
window.buildGeoQuestionPrompt = buildGeoQuestionPrompt;
window.buildProductProfilePrompt = buildProductProfilePrompt;
window.buildAdaptationPrompt = buildAdaptationPrompt;
window.buildContentRepurposePrompt = buildContentRepurposePrompt;
window.buildPublishChecklist = buildPublishChecklist;
window.buildSeoOptimizePrompt = buildSeoOptimizePrompt;
window.getPlatformBestPublishTime = getPlatformBestPublishTime;
window.PLATFORM_BEST_TIME = PLATFORM_BEST_TIME;
window.extractJsonArray = extractJsonArray;
window.extractJsonObject = extractJsonObject;
window.callImageGeneration = callImageGeneration;
