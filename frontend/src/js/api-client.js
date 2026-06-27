/* GEO Studio — API Client Layer
 *
 * 规范的三层 API 客户端：
 *   1. 配置（从 window.__GEO_CONFIG__ 或默认值读取）
 *   2. 认证（PocketBase 管理员 Token 管理）
 *   3. 请求（路径翻译 + 错误处理 + 响应格式化）
 */

// ===== 第一层：配置 =======================================================

const CONFIG = {
  pbUrl: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || "http://127.0.0.1:8085",
  pbEmail: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbEmail) || "admin@geo.local",
  pbPassword: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbPassword) || "admin123456",
};

// ===== 第二层：认证 =======================================================

let _token = null;
let _tokenExpiry = 0;

async function apiAuth() {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await fetch(`${CONFIG.pbUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: CONFIG.pbEmail, password: CONFIG.pbPassword }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError("认证失败：" + (body.message || `HTTP ${res.status}`), 401);
  }

  const data = await res.json();
  _token = data.token;
  _tokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 天
  return _token;
}

// ===== 第三层：错误类型 ====================================================

class ApiError extends Error {
  constructor(message, status = 500, code = "API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

class NotFoundError extends ApiError {
  constructor(resource, id) {
    super(`${resource} (id=${id}) 不存在`, 404, "NOT_FOUND");
  }
}

class ValidationError extends ApiError {
  constructor(message) {
    super(message, 422, "VALIDATION_ERROR");
  }
}

// ===== 第三层：HTTP 请求 ===================================================

/**
 * 通用 API 请求（带认证、错误处理、自动重试 5xx）
 */
async function apiRequest(path, { method = "GET", body = null, headers = {} } = {}) {
  const token = await apiAuth();

  const fetchOptions = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
      ...headers,
    },
  };

  if (body && method !== "GET") {
    fetchOptions.body = JSON.stringify(body);
  }

  const url = `${CONFIG.pbUrl}${path}`;

  let res;
  try {
    res = await fetch(url, fetchOptions);
  } catch (err) {
    if (err.message === "Failed to fetch") {
      throw new ApiError("无法连接到后台服务，请确认 PocketBase 已启动", 0, "CONNECTION_ERROR");
    }
    throw err;
  }

  // 5xx 自动重试（最多 2 次）
  if (res.status >= 500 && method === "GET") {
    for (let attempt = 0; attempt < 2; attempt++) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      res = await fetch(url, { headers: { Authorization: token } });
      if (res.ok) break;
    }
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = (data && data.message) || `请求失败 (HTTP ${res.status})`;
    if (res.status === 404) throw new NotFoundError(path, "");
    if (res.status === 400) throw new ValidationError(msg);
    throw new ApiError(msg, res.status);
  }

  return data;
}

// ===== 路径翻译（旧 API → PocketBase） =====================================

const COLLECTION_MAP = {
  products: "products",
  geo_questions: "geo_questions",
  platforms: "platforms",
  articles: "articles",
  tasks: "publish_tasks",
  ai_settings: "ai_settings",
};

/**
 * 将旧版 REST 路径转换为 PocketBase 格式
 *
 * /api/products          → GET  /api/collections/products/records
 * /api/products/1        → GET  /api/collections/products/records/1
 * POST /api/products     → POST /api/collections/products/records
 * PUT /api/products/1    → PATCH /api/collections/products/records/1
 * DELETE /api/products/1 → DELETE /api/collections/products/records/1
 * /api/bootstrap         → 聚合查询
 * /api/coverage          → 计算覆盖矩阵
 */
function translatePath(path, method) {
  const parts = path.replace(/^\/api\//, "").split("/");
  const resource = parts[0];

  // 数字 ID：单条记录操作
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    const collection = COLLECTION_MAP[resource];
    if (!collection) return { type: "action", path };
    return { type: "record", collection, id: parts[1] };
  }

  // 资源列表
  if (COLLECTION_MAP[resource]) {
    return { type: "list", collection: COLLECTION_MAP[resource] };
  }

  // 特殊端点
  return { type: "action", path };
}

// ===== PocketBase 响应格式转换 ============================================

/**
 * 将 PocketBase record 转为旧系统格式
 */
function pbRecordToApp(record) {
  const { collectionId, collectionName, created, updated, expand, ...rest } = record;
  return {
    ...rest,
    created_at: created || rest.created_at || "",
    updated_at: updated || rest.updated_at || "",
  };
}

/**
 * 去除不需要传给 PocketBase 的字段
 */
function cleanPayload(payload) {
  const { id, created_at, updated_at, ...rest } = payload;
  return rest;
}

// ===== AI 端点处理（前端直连） ============================================

/**
 * 调用 OpenAI-compatible API（用于 AI 生成和图片生成）
 */
async function callAI(settings, messages) {
  const baseUrl = settings.text_base_url || settings.base_url || "https://open.bigmodel.cn/api/paas/v4";
  const model = settings.text_model || settings.model || "glm-4-flash";
  const apiKey = settings.text_api_key || settings.api_key || "";
  const temperature = parseFloat(settings.temperature || 0.7);

  if (!apiKey) throw new ValidationError("请先配置 AI API Key");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(`AI 调用失败：${err.error?.message || `HTTP ${res.status}`}`, res.status);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * 调用图片生成 API
 */
async function callImageGen(settings, prompt) {
  const baseUrl = settings.image_base_url || settings.text_base_url || settings.base_url || "https://open.bigmodel.cn/api/paas/v4";
  const model = settings.image_model || "cogview-3-flash";
  const apiKey = settings.image_api_key || settings.text_api_key || settings.api_key || "";

  if (!apiKey) throw new ValidationError("请先配置图片生成 API Key");
  if (!prompt) throw new ValidationError("请先填写图片提示词");

  const res = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, prompt, n: 1 }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(`图片生成失败：${err.error?.message || `HTTP ${res.status}`}`, res.status);
  }

  return await res.json();
}

// ===== 公开 API（与旧系统兼容） ===========================================

/**
 * 主 API 函数，签名与原 api() 完全兼容
 *
 * GET  /api/products         → 返回数组
 * POST /api/products         → 返回单条
 * PUT  /api/products/1       → 返回单条
 * DELETE /api/products/1     → 返回 {ok:true}
 * /api/bootstrap             → 聚合查询
 * /api/coverage              → 覆盖计算
 * /api/backup                → 导出
 * /api/ai/*                  → AI 相关
 */
async function geoApi(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const translated = translatePath(path, method);

  // ---- 特殊端点 ----
  if (translated.type === "action") {
    switch (path) {
      case "/api/bootstrap": return apiBootstrap();
      case "/api/coverage": return apiCoverage();
      case "/api/backup": return apiBackupExport();
      // AI 端点交给原来的事件处理（或前端直连）
      default: throw new ApiError(`未适配的端点：${path}`, 501);
    }
  }

  // ---- 列表操作 ----
  if (translated.type === "list") {
    const coll = translated.collection;

    if (method === "GET") {
      // 构建查询参数
      let queryPath = `/api/collections/${coll}/records?perPage=500`;
      if (coll === "publish_tasks") queryPath += "&expand=article_id,platform_id";
      if (coll !== "publish_tasks" && coll !== "ai_settings") queryPath += "&sort=-updated";

      const data = await apiRequest(queryPath);
      return (data.items || []).map(pbRecordToApp);
    }

    if (method === "POST") {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : (options.body || {});
      const data = await apiRequest(`/api/collections/${coll}/records`, {
        method: "POST",
        body: cleanPayload(body),
      });
      return pbRecordToApp(data);
    }
  }

  // ---- 单条记录操作 ----
  if (translated.type === "record") {
    const { collection, id } = translated;

    if (method === "GET") {
      let queryPath = `/api/collections/${collection}/records/${id}`;
      if (collection === "publish_tasks") queryPath += "?expand=article_id,platform_id";
      const data = await apiRequest(queryPath);
      return pbRecordToApp(data);
    }

    if (method === "PUT" || method === "PATCH") {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : (options.body || {});
      const data = await apiRequest(`/api/collections/${collection}/records/${id}`, {
        method: "PATCH",
        body: cleanPayload(body),
      });
      return pbRecordToApp(data);
    }

    if (method === "DELETE") {
      await apiRequest(`/api/collections/${collection}/records/${id}`, { method: "DELETE" });
      return { ok: true };
    }
  }

  throw new ApiError(`不支持的请求：${method} ${path}`, 400);
}

// ===== Bootstrap（聚合查询） ==============================================

async function apiBootstrap() {
  const token = await apiAuth();
  const headers = { Authorization: token };
  const base = `${CONFIG.pbUrl}/api/collections`;

  const [productsRes, geoRes, platformsRes, articlesRes, tasksRes, aiRes] = await Promise.all([
    fetch(`${base}/products/records?perPage=500&sort=-updated`, { headers }),
    fetch(`${base}/geo_questions/records?perPage=500&sort=-updated`, { headers }),
    fetch(`${base}/platforms/records?perPage=500&sort=status,category,name`, { headers }),
    fetch(`${base}/articles/records?perPage=500&sort=-updated`, { headers }),
    fetch(`${base}/publish_tasks/records?perPage=500&expand=article_id,platform_id&sort=-updated`, { headers }),
    fetch(`${base}/ai_settings/records`, { headers }),
  ]);

  const products = ((await productsRes.json()).items || []).map(pbRecordToApp);
  const platforms = ((await platformsRes.json()).items || []).map(pbRecordToApp);
  const articles = ((await articlesRes.json()).items || []).map(pbRecordToApp);

  // geo_questions：关联 product name
  const geoQuestions = ((await geoRes.json()).items || []).map(r => {
    const q = pbRecordToApp(r);
    const product = products.find(p => String(p.id) === String(q.product_id));
    q.product_name = product ? product.name : "";
    return q;
  });

  // publish_tasks：展开关联信息
  const tasks = ((await tasksRes.json()).items || []).map(r => {
    const t = pbRecordToApp(r);
    // PocketBase expand 把关联数据放在 expand 下
    if (r.expand) {
      if (r.expand.article_id) {
        const a = r.expand.article_id;
        t.article_title = a.title || "";
        t.article_summary = a.summary || "";
        t.article_body = a.body || "";
        t.article_keywords = a.keywords || "";
        t.article_tags = a.tags || "";
        t.article_image_prompt = a.image_prompt || "";
        t.article_risk_notes = a.risk_notes || "";
      }
      if (r.expand.platform_id) {
        const p = r.expand.platform_id;
        t.platform_name = p.name || "";
        t.platform_url = p.url || "";
        t.platform_category = p.category || "";
        t.platform_account_name = p.account_name || "";
        t.platform_login_notes = p.login_notes || "";
      }
    }
    return t;
  });

  // ai_settings
  const aiItems = ((await aiRes.json()).items || []).map(pbRecordToApp);
  const aiSettings = aiItems.length > 0 ? aiItems[0] : null;

  // coverage
  const coverage = apiCoverageInternal(products, geoQuestions, articles, tasks);

  return { products, geo_questions: geoQuestions, platforms, articles, tasks, ai_settings: aiSettings, coverage };
}

// ===== Coverage ============================================================

async function apiCoverage() {
  const bootstrap = await apiBootstrap();
  return bootstrap.coverage;
}

function apiCoverageInternal(products, geoQuestions, articles, tasks) {
  const byQuestion = geoQuestions.map(q => {
    const qid = String(q.id);
    const articleCount = articles.filter(a => String(a.geo_question_id) === qid).length;
    const publishedCount = tasks.filter(t =>
      t.status === "published" &&
      articles.some(a => String(a.id) === String(t.article_id) && String(a.geo_question_id) === qid)
    ).length;
    return { geo_question_id: q.id, articles: articleCount, published: publishedCount };
  });

  const byProduct = products.map(p => {
    const qs = geoQuestions.filter(q => String(q.product_id) === String(p.id));
    const totalQ = qs.length;
    const qidSet = new Set(qs.map(q => String(q.id)));
    let coveredQ = 0, publishedQ = 0;
    for (const qid of qidSet) {
      const cov = byQuestion.find(bq => String(bq.geo_question_id) === qid);
      if (cov && cov.articles > 0) coveredQ++;
      if (cov && cov.published > 0) publishedQ++;
    }
    const rate = totalQ ? Math.round((coveredQ / totalQ) * 1000) / 1000 : 0;
    const gaps = qs
      .filter(q =>
        q.status === "active" &&
        !byQuestion.some(bq => String(bq.geo_question_id) === String(q.id) && bq.articles > 0)
      )
      .map(q => ({ id: q.id, question: q.question, priority: q.priority }));

    return { product_id: p.id, product_name: p.name, total_q: totalQ, covered_q: coveredQ, published_q: publishedQ, rate, gaps };
  });

  const totalQ = byProduct.reduce((s, p) => s + p.total_q, 0);
  const coveredQ = byProduct.reduce((s, p) => s + p.covered_q, 0);
  const highGaps = byProduct.reduce((s, p) => s + p.gaps.filter(g => g.priority === "high").length, 0);

  return {
    by_question: byQuestion,
    by_product: byProduct,
    summary: {
      total_q: totalQ,
      covered_q: coveredQ,
      rate: totalQ ? Math.round((coveredQ / totalQ) * 1000) / 1000 : 0,
      high_priority_gaps: highGaps,
    },
  };
}

// ===== Backup ==============================================================

async function apiBackupExport() {
  const data = await apiBootstrap();
  delete data.coverage;
  return data;
}

// ===== 挂载到全局 ==========================================================

window.geoApi = geoApi;
window.callAI = callAI;
window.callImageGen = callImageGen;
window.ApiError = ApiError;
window.NotFoundError = NotFoundError;
window.ValidationError = ValidationError;
