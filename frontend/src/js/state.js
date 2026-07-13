/* GEO Studio v2 - State */

const state = {
  products: [],
  product_images: [],
  geo_questions: [],
  platforms: [],
  articles: [],
  tasks: [],
  ai_settings: {},
  user_models: [],
  geo_rank_checks: [],
  coverage: { by_question: [], by_product: [], summary: { total_q: 0, covered_q: 0, rate: 0, high_priority_gaps: 0 } },
  // 注意：产品的选中状态保存在 render.js 顶层 `selectedProductId`（历史遗留），
  // 这里不再重复声明 `state.selectedProductId` 以免误用。
  selectedArticleId: null,
  selectedPlatformId: null,
  taskCalendarDate: new Date(),
};

const aiPresets = [
  { name: "智谱 GLM + CogView", text_base_url: "https://open.bigmodel.cn/api/paas/v4", text_model: "glm-4-flash", image_base_url: "https://open.bigmodel.cn/api/paas/v4", image_model: "cogview-3-flash", provider: "智谱AI" },
  { name: "OpenAI Compatible", text_base_url: "https://api.openai.com/v1", text_model: "gpt-4.1-mini", image_base_url: "https://api.openai.com/v1", image_model: "gpt-image-1", provider: "OpenAI" },
  { name: "DeepSeek 文本", text_base_url: "https://api.deepseek.com/v1", text_model: "deepseek-chat", image_base_url: "", image_model: "", provider: "DeepSeek" },
  { name: "豆包 Ark 文本", text_base_url: "https://ark.cn-beijing.volces.com/api/v3", text_model: "请填写你的 endpoint id", image_base_url: "", image_model: "", provider: "字节跳动" },
  { name: "通义千问兼容", text_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1", text_model: "qwen-plus", image_base_url: "", image_model: "", provider: "阿里云" },
  { name: "本地 Ollama 网关", text_base_url: "http://127.0.0.1:11434/v1", text_model: "qwen2.5:7b", image_base_url: "", image_model: "", provider: "本地部署" },
];

// 默认 AI 设置：使用智谱 GLM 预设
// 若 .env 中配置了 VITE_DEFAULT_AI_KEY，则首次加载即启用 API 直连模式
// 通过 window.__GEO_ENV__.VITE_DEFAULT_AI_KEY 注入（由 vite.config.js 的 transformIndexHtml 插件写入）
const _envDefaultKey = (typeof window !== "undefined" && window.__GEO_ENV__ && window.__GEO_ENV__.VITE_DEFAULT_AI_KEY) || "";
const DEFAULT_AI_SETTINGS = {
  mode: _envDefaultKey ? "api" : "manual",
  text_base_url: "https://open.bigmodel.cn/api/paas/v4",
  text_model: "glm-4-flash",
  image_base_url: "https://open.bigmodel.cn/api/paas/v4",
  image_model: "cogview-3-flash",
  temperature: 0.7,
  preset_index: 0,
};

// 默认平台种子数据：新用户首次加载时自动播种
const DEFAULT_PLATFORMS = [
  // 综合资讯
  { name: "微信公众号", category: "综合资讯", url: "https://mp.weixin.qq.com", content_style: "深度长文，标题吸睛，开头留人", recommended_words: "800-2000", title_style: "悬念/数字/痛点", tags_rule: "无需标签", allows_external_links: "limited", soft_article_fit: "high", frequency: "每周2-3篇", status: "enabled", notes: "需公众号后台发布，支持图文/视频" },
  { name: "今日头条", category: "综合资讯", url: "https://www.toutiao.com", content_style: "信息量大，标题党友好", recommended_words: "1000-2500", title_style: "数字/疑问/对比", tags_rule: "3-5个话题标签", allows_external_links: "limited", soft_article_fit: "high", frequency: "每日1篇", status: "enabled", notes: "头条号后台发布，推荐算法分发" },
  { name: "百家号", category: "综合资讯", url: "https://baijiahao.baidu.com", content_style: "权威严谨，SEO友好", recommended_words: "1000-2000", title_style: "关键词前置", tags_rule: "3-5个标签", allows_external_links: "limited", soft_article_fit: "medium", frequency: "每周2-3篇", status: "enabled", notes: "百度系流量，搜索收录好" },
  { name: "企鹅号", category: "综合资讯", url: "https://om.qq.com", content_style: "腾讯系分发，内容多元", recommended_words: "800-2000", title_style: "直接/信息型", tags_rule: "3-5个标签", allows_external_links: "limited", soft_article_fit: "medium", frequency: "每周2篇", status: "watch", notes: "腾讯内容开放平台" },
  { name: "网易号", category: "综合资讯", url: "https://mp.163.com", content_style: "新闻资讯向", recommended_words: "800-1500", title_style: "新闻式标题", tags_rule: "3个标签", allows_external_links: "limited", soft_article_fit: "medium", frequency: "每周1-2篇", status: "watch", notes: "网易号后台发布" },
  // 社区社交
  { name: "知乎", category: "社区社交", url: "https://www.zhihu.com", content_style: "专业深度，回答式，GEO/SEO 收录强", recommended_words: "1500-4000", title_style: "问题式/干货型", tags_rule: "5个话题", allows_external_links: "limited", soft_article_fit: "high", frequency: "每周2-3篇", status: "enabled", notes: "知乎专栏/回答，AI 引用率高" },
  { name: "小红书", category: "社区社交", url: "https://www.xiaohongshu.com", content_style: "种草口语化，emoji 多，图文并茂", recommended_words: "300-800", title_style: "情绪/场景/数字", tags_rule: "5-10个话题标签", allows_external_links: "forbidden", soft_article_fit: "high", frequency: "每周3-5篇", status: "enabled", notes: "需 App 发布，图片必备" },
  { name: "微博", category: "社区社交", url: "https://weibo.com", content_style: "短平快，话题性强", recommended_words: "140-500", title_style: "话题/热点", tags_rule: "#话题# 格式", allows_external_links: "allowed", soft_article_fit: "medium", frequency: "每日1-2条", status: "enabled", notes: "微博开放平台发布" },
  { name: "豆瓣", category: "社区社交", url: "https://www.douban.com", content_style: "文艺深度，长评友好", recommended_words: "800-2000", title_style: "感悟式", tags_rule: "无需标签", allows_external_links: "limited", soft_article_fit: "low", frequency: "每周1篇", status: "watch", notes: "豆瓣日记/小组" },
  // 视频平台
  { name: "抖音", category: "视频平台", url: "https://www.douyin.com", content_style: "短视频脚本，前3秒抓人", recommended_words: "脚本200-500字 / 视频1-3分钟", title_style: "悬念/冲突", tags_rule: "#话题 标签", allows_external_links: "forbidden", soft_article_fit: "high", frequency: "每周3-5条", status: "enabled", notes: "抖音创作者中心发布" },
  { name: "快手", category: "视频平台", url: "https://www.kuaishou.com", content_style: "接地气，老铁文化", recommended_words: "脚本200-400字 / 视频1-2分钟", title_style: "生活化", tags_rule: "#话题 标签", allows_external_links: "forbidden", soft_article_fit: "medium", frequency: "每周3-5条", status: "watch", notes: "快手创作者后台" },
  { name: "B站", category: "视频平台", url: "https://www.bilibili.com", content_style: "中长视频，知识/趣味并重", recommended_words: "脚本800-2000字 / 视频5-15分钟", title_style: "UP主风格", tags_rule: "5-10个标签", allows_external_links: "allowed", soft_article_fit: "high", frequency: "每周1-2条", status: "enabled", notes: "B站创作中心上传" },
  { name: "视频号", category: "视频平台", url: "https://channels.weixin.qq.com", content_style: "社交分发，内容偏生活/知识", recommended_words: "脚本200-600字 / 视频1-5分钟", title_style: "温情/干货", tags_rule: "#话题 标签", allows_external_links: "limited", soft_article_fit: "medium", frequency: "每周2-3条", status: "watch", notes: "微信视频号助手" },
  // 技术社区
  { name: "掘金", category: "技术社区", url: "https://juejin.cn", content_style: "技术干货，代码示例多", recommended_words: "1500-5000", title_style: "技术关键词+痛点", tags_rule: "1-3个标签", allows_external_links: "allowed", soft_article_fit: "high", frequency: "每周1-2篇", status: "enabled", notes: "技术产品向内容友好" },
  { name: "CSDN", category: "技术社区", url: "https://www.csdn.net", content_style: "技术教程，SEO 收录强", recommended_words: "1000-3000", title_style: "教程式标题", tags_rule: "3-5个标签", allows_external_links: "allowed", soft_article_fit: "high", frequency: "每周1-2篇", status: "enabled", notes: "百度收录好，适合 SEO" },
  { name: "博客园", category: "技术社区", url: "https://www.cnblogs.com", content_style: "技术博客，深度文章", recommended_words: "1000-3000", title_style: "技术型", tags_rule: "分类标签", allows_external_links: "allowed", soft_article_fit: "medium", frequency: "每周1篇", status: "watch", notes: "老牌技术社区" },
  { name: "思否", category: "技术社区", url: "https://segmentfault.com", content_style: "技术问答+专栏", recommended_words: "800-2000", title_style: "问题/教程式", tags_rule: "1-3个标签", allows_external_links: "allowed", soft_article_fit: "medium", frequency: "每周1篇", status: "watch", notes: "SegmentFault" },
  // 海外
  { name: "Medium", category: "海外平台", url: "https://medium.com", content_style: "英文长文，故事化", recommended_words: "1500-3000", title_style: "英文标题", tags_rule: "5个标签", allows_external_links: "allowed", soft_article_fit: "high", frequency: "每周1篇", status: "watch", notes: "海外受众" },
  { name: "WordPress", category: "海外平台", url: "https://wordpress.com", content_style: "独立站博客，完全自主", recommended_words: "1000-2500", title_style: "SEO 关键词", tags_rule: "分类+标签", allows_external_links: "allowed", soft_article_fit: "high", frequency: "每周1-2篇", status: "watch", notes: "自建站，SEO 友好" },
];

async function load() {
  // 保存成功后总会触发 load()；在这里清除"未保存改动"脏标记（见 events.js 的离开保护）
  if (typeof window.__geoClearDirty === "function") window.__geoClearDirty();
  Object.assign(state, await api("/api/bootstrap"));
  // 首次加载若平台为空，自动播种默认平台
  if (state.platforms.length === 0 && isLoggedIn()) {
    const seeded = await seedDefaultPlatforms();
    if (seeded) {
      // 直接更新state.platforms，避免再次调用apiBootstrap
      state.platforms = seeded;
    }
  }
  // 首次加载若无 AI 设置，自动创建默认配置（智谱 GLM 预设，待用户填 Key）
  if (isLoggedIn() && (!state.ai_settings || !state.ai_settings.id)) {
    await seedDefaultAiSettings();
  }
  // 清除搜索索引缓存
  if (typeof clearSearchIndexCache === 'function') {
    clearSearchIndexCache();
  }
  render();
}

// 首次加载时为用户创建默认 AI 设置
// 若 .env 中配置了 VITE_DEFAULT_AI_KEY，则同时写入 key 并启用 API 直连
async function seedDefaultAiSettings() {
  try {
    const payload = { ...DEFAULT_AI_SETTINGS };
    if (_envDefaultKey) {
      payload.text_api_key = _envDefaultKey;
      payload.image_api_key = _envDefaultKey;
      payload.mode = "api";
    }
    const created = await geoApi("/api/ai_settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (created) state.ai_settings = created;
  } catch (e) {
    console.warn("播种默认 AI 设置失败：", e.message);
  }
}

// 为当前用户批量创建默认平台
async function seedDefaultPlatforms() {
  try {
    const createdPlatforms = await Promise.all(DEFAULT_PLATFORMS.map(p =>
      api("/api/platforms", { method: "POST", body: JSON.stringify(p) })
    ));
    return createdPlatforms;
  } catch (e) {
    console.warn("播种默认平台失败：", e.message);
    return null;
  }
}
