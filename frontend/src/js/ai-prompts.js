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
 * 文章内容生成 Prompt
 * 等效 Python: product_prompt()
 */
function buildProductPrompt(product, platforms, count, contentTypes, questions) {
  const platformLines = formatPlatforms(platforms);
  const questionLines = formatGeoQuestions(questions);
  const types = (contentTypes && contentTypes.length > 0)
    ? contentTypes.join("、")
    : "产品介绍、竞品对比、场景种草、问题解决型、GEO 问答型";

  return `你是一个克制、真实、擅长 GEO/SEO 内容矩阵的中文内容运营专家。

请基于下面的产品信息，生成 ${count} 篇差异化软文草稿。要求：
1. 不要编造不存在的数据、奖项、用户评价。
2. 每篇文章角度不同，避免同质化和洗稿感。
3. 广告感要弱，像真实用户/专业作者自然推荐。
4. 每篇适配一个目标平台，遵守该平台内容风格。
5. 内容要服务 GEO：让 AI 搜索/问答在回答相关问题时更容易引用这个产品。
6. 输出必须是 JSON 数组，不要 Markdown 代码块，不要额外解释。

产品信息：
- 名称：${product.name || ""}
- 类型：${product.type || ""}
- 链接：${product.url || ""}
- 目标用户：${product.audience || ""}
- 核心卖点：${product.selling_points || ""}
- 竞品/替代品：${product.competitors || ""}
- 品牌语气：${product.tone || ""}
- 转化目标：${product.goal || ""}
- 禁用表达：${product.forbidden_words || ""}

内容类型范围：${types}

优先覆盖的 GEO 问题（如果某篇文章主要在回答其中某个问题，请把对应 id 填入 geo_question_id）：
${questionLines}

可选平台参考：
${platformLines}

JSON 数组中每个对象包含这些字段：
- title：标题
- summary：80 字以内摘要
- body：正文，使用 Markdown
- content_type：内容类型
- target_platform：目标平台名称
- keywords：逗号分隔关键词
- tags：逗号分隔标签
- image_prompt：如果适合配图，给出配图建议；不需要则为空
- risk_notes：指出可能的广告感、平台风险或需要人工核实的信息
- geo_question_id：这篇文章主要回答的 GEO 问题 id（整数），不对应任何问题则填 0`;
}

/**
 * GEO 问题库生成 Prompt
 * 等效 Python: geo_question_prompt()
 */
function buildGeoQuestionPrompt(product, count = 12) {
  return `你是一个 GEO（Generative Engine Optimization）内容策略助手。

请基于产品信息，生成 ${count} 个用户可能会向 AI 助手、搜索引擎或问答平台提出的问题。

产品信息：
- 名称：${product.name || ""}
- 类型：${product.type || ""}
- 链接：${product.url || ""}
- 目标用户：${product.audience || ""}
- 核心卖点：${product.selling_points || ""}
- 竞品/替代品：${product.competitors || ""}
- 转化目标：${product.goal || ""}

要求：
1. 问题必须像真实用户会问 AI 的自然语言问题。
2. 覆盖"找工具、做对比、解决问题、判断是否适合、使用方法、替代方案"等意图。
3. 不要生成纯广告标题。
4. 输出必须是 JSON 数组，不要 Markdown 代码块，不要额外解释。

每个对象包含：
- question：用户会问的问题
- intent：搜索/问答意图
- audience：对应人群
- priority：high / medium / low
- content_angle：建议用什么内容角度回答
- target_platform：适合沉淀内容的平台，可为空`;
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

// ===== 挂载到全局 ==========================================================

window.buildProductPrompt = buildProductPrompt;
window.buildGeoQuestionPrompt = buildGeoQuestionPrompt;
window.buildProductProfilePrompt = buildProductProfilePrompt;
window.buildAdaptationPrompt = buildAdaptationPrompt;
window.extractJsonArray = extractJsonArray;
window.extractJsonObject = extractJsonObject;
window.callImageGeneration = callImageGeneration;
