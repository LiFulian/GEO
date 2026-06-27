/* GEO Studio - Application state and data management */

const state = {
  products: [],
  geo_questions: [],
  platforms: [],
  articles: [],
  tasks: [],
  ai_settings: {},
  coverage: { by_question: [], by_product: [], summary: { total_q: 0, covered_q: 0, rate: 0, high_priority_gaps: 0 } },
  selectedArticleId: null,
  selectedPlatformId: null,
  taskView: "board",
  taskCalendarDate: new Date(),
};

const contentTypes = [
  "产品介绍",
  "竞品对比",
  "使用体验",
  "生活场景种草",
  "问题解决型",
  "GEO 问答型",
  "技术教程",
  "小红书笔记",
];

const aiPresets = [
  { name: "智谱 GLM + CogView", text_base_url: "https://open.bigmodel.cn/api/paas/v4", text_model: "glm-4-flash", image_base_url: "https://open.bigmodel.cn/api/paas/v4", image_model: "cogview-3-flash" },
  { name: "OpenAI Compatible", text_base_url: "https://api.openai.com/v1", text_model: "gpt-4.1-mini", image_base_url: "https://api.openai.com/v1", image_model: "gpt-image-1" },
  { name: "DeepSeek 文本", text_base_url: "https://api.deepseek.com/v1", text_model: "deepseek-chat", image_base_url: "", image_model: "" },
  { name: "豆包 Ark 文本", text_base_url: "https://ark.cn-beijing.volces.com/api/v3", text_model: "请填写你的 endpoint id", image_base_url: "", image_model: "" },
  { name: "通义千问兼容", text_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1", text_model: "qwen-plus", image_base_url: "", image_model: "" },
  { name: "本地 Ollama 网关", text_base_url: "http://127.0.0.1:11434/v1", text_model: "qwen2.5:7b", image_base_url: "", image_model: "" },
];

async function load() {
  Object.assign(state, await api("/api/bootstrap"));
  render();
}
