/* GEO Studio — API Client Layer
 *
 * 三层 API 客户端：
 *   1. 配置（从 window.__GEO_CONFIG__ 或默认值读取）
 *   2. 认证（用户 Token 管理，支持注册/登录/登出）
 *   3. 请求（路径翻译 + user_id 注入 + 错误处理）
 */

// ===== 第一层：配置 =======================================================

const CONFIG = {
  pbUrl: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || "http://127.0.0.1:8085",
};

// ===== 用户认证 ==========================================================

let _userToken = null;
let _userRecord = null;
let _userEmail = null;
// 注意：不再存储密码，token过期后要求重新登录

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem("geo_auth");
    if (raw) {
      const data = JSON.parse(raw);
      _userToken = data.token || null;
      _userRecord = data.record || null;
      _userEmail = data.email || null;
      // 不再加载密码
    }
  } catch { /* ignore */ }
}
loadAuthFromStorage();

function saveAuthToStorage() {
  if (_userToken && _userRecord) {
    localStorage.setItem("geo_auth", JSON.stringify({
      token: _userToken,
      record: _userRecord,
      email: _userEmail,
      // 不再保存密码
    }));
  } else {
    localStorage.removeItem("geo_auth");
  }
}

function isLoggedIn() {
  return !!_userToken && !!_userRecord;
}

function getCurrentUserId() {
  return _userRecord ? _userRecord.id : null;
}

function getCurrentUserEmail() {
  return _userRecord ? _userRecord.email : null;
}

function getCurrentUserName() {
  return _userRecord ? (_userRecord.name || _userRecord.email) : null;
}

async function userLogin(email, password) {
  const res = await fetch(`${CONFIG.pbUrl}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.message || "登录失败", res.status);
  _userToken = data.token;
  _userRecord = data.record;
  _userEmail = email;
  // 不再存储密码
  saveAuthToStorage();
  return data.record;
}

async function userRegister(email, password, name) {
  const res = await fetch(`${CONFIG.pbUrl}/api/collections/users/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      name: name || email.split("@")[0],
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.data ? Object.values(data.data).flat().join("; ") : (data.message || "注册失败");
    throw new ApiError(msg, res.status);
  }
  // 注册成功后自动登录获取 token
  return await userLogin(email, password);
}

function userLogout() {
  _userToken = null;
  _userRecord = null;
  _userEmail = null;
  localStorage.removeItem("geo_auth");
}

// JWT 解码（不验证签名，仅读取 payload）
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// 检查 token 是否已过期
function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

// 使用 PocketBase auth-refresh 端点刷新 token（不需要密码）
async function refreshTokenIfNeeded() {
  if (!_userToken) return;
  
  // 如果token已过期，直接返回（会在apiAuth中处理401）
  if (isTokenExpired(_userToken)) return;
  
  // 检查是否需要刷新（24小时内过期则刷新）
  const payload = decodeJwtPayload(_userToken);
  if (!payload || !payload.exp) return;
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - now;
  
  // 如果24小时内过期，尝试刷新
  if (expiresIn < 86400) {
    try {
      const res = await fetch(`${CONFIG.pbUrl}/api/collections/users/auth-refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": _userToken,
        },
      });
      if (res.ok) {
        const data = await res.json();
        _userToken = data.token;
        _userRecord = data.record;
        saveAuthToStorage();
        console.log("Token 已自动刷新");
      }
    } catch (e) {
      console.warn("Token 自动刷新失败：", e.message);
    }
  }
}

async function apiAuth() {
  if (_userToken) {
    // 检查token是否已过期
    if (isTokenExpired(_userToken)) {
      // token已过期，清除认证状态
      userLogout();
      throw new ApiError("登录已过期，请重新登录", 401, "TOKEN_EXPIRED");
    }
    // 尝试刷新即将过期的 token
    await refreshTokenIfNeeded();
    return _userToken;
  }
  throw new ApiError("请先登录", 401, "NOT_AUTHENTICATED");
}

// ===== 第二层：错误类型 ===================================================

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

// ===== 第三层：HTTP 请求 ==================================================

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

  // 5xx 自动重试
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
    if (res.status === 401) {
      userLogout();
      throw new ApiError("登录已过期，请重新登录", 401, "UNAUTHORIZED");
    }
    if (res.status === 404) throw new NotFoundError(path, "");
    if (res.status === 400) throw new ValidationError(msg);
    throw new ApiError(msg, res.status);
  }

  return data;
}

// ===== 路径翻译 ===========================================================

const COLLECTION_MAP = {
  products: "products",
  geo_questions: "geo_questions",
  platforms: "platforms",
  contents: "articles",
  articles: "articles",
  tasks: "publish_tasks",
  ai_settings: "ai_settings",
  user_models: "user_models",
  product_images: "product_images",
};

function translatePath(path, method) {
  const parts = path.replace(/^\/api\//, "").split("/");
  const resource = parts[0];

    if (parts.length === 2 && /^[a-z0-9]+$/i.test(parts[1]) && parts[1].length >= 10) {
    const collection = COLLECTION_MAP[resource];
    if (!collection) return { type: "action", path };
    return { type: "record", collection, id: parts[1] };
  }

  if (COLLECTION_MAP[resource]) {
    return { type: "list", collection: COLLECTION_MAP[resource] };
  }

  return { type: "action", path };
}

// ===== 响应格式转换 =======================================================

function pbRecordToApp(record) {
  const { collectionId, collectionName, created, updated, expand, ...rest } = record;
  return {
    ...rest,
    created_at: created || rest.created_at || "",
    updated_at: updated || rest.updated_at || "",
  };
}

function cleanPayload(payload) {
  const { id, ...rest } = payload;
  return rest;
}

// ===== AI 端点处理（前端直连） =============================================

async function callAI(settings, messages) {
  const baseUrl = settings.text_base_url || settings.base_url || "https://open.bigmodel.cn/api/paas/v4";
  const model = settings.text_model || settings.model || "glm-4-flash";
  const apiKey = settings.text_api_key || settings.api_key || "";

  if (!apiKey) throw new ValidationError("请先配置 AI API Key");

  const temperature = parseFloat(settings.temperature || 0.7);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(`AI 调用失败：${err.error?.message || `HTTP ${res.status}`}`, res.status);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ===== 公开 API ===========================================================

async function geoApi(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const translated = translatePath(path, method);

  // 特殊端点
  if (translated.type === "action") {
    switch (path) {
      case "/api/bootstrap": return apiBootstrap();
      case "/api/coverage": return apiCoverage();
      case "/api/backup": return apiBackupExport();
      case "/api/tasks/assign": return apiAssignTasks(JSON.parse(options.body || "{}"));
      default: throw new ApiError(`未适配的端点：${path}`, 501);
    }
  }

  // 列表操作
  if (translated.type === "list") {
    const coll = translated.collection;

    if (method === "GET") {
      let queryPath = `/api/collections/${coll}/records?perPage=500`;
      if (coll === "publish_tasks") queryPath += "&expand=article_id,platform_id";
      if (coll !== "publish_tasks" && coll !== "ai_settings" && coll !== "user_models") queryPath += "&sort=-updated_at";

      const data = await apiRequest(queryPath);
      return (data.items || []).map(pbRecordToApp);
    }

    if (method === "POST") {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : (options.body || {});
      // 自动注入 user_id 和时间戳（updated_at/created_at 是 text 字段，需手动维护）
      body.user_id = getCurrentUserId();
      const now = new Date().toISOString();
      if (!body.created_at) body.created_at = now;
      if (!body.updated_at) body.updated_at = now;
      const data = await apiRequest(`/api/collections/${coll}/records`, {
        method: "POST",
        body: cleanPayload(body),
      });
      return pbRecordToApp(data);
    }
  }

  // 单条记录操作
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
      body.updated_at = new Date().toISOString();
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

// ===== Bootstrap ==========================================================

async function apiBootstrap() {
  const token = await apiAuth();
  const headers = { Authorization: token };
  const base = `${CONFIG.pbUrl}/api/collections`;

  const [productsRes, geoRes, platformsRes, articlesRes, tasksRes, aiRes, modelsRes, imagesRes] = await Promise.all([
    fetch(`${base}/products/records?perPage=500&sort=-updated_at`, { headers }),
    fetch(`${base}/geo_questions/records?perPage=500&sort=-updated_at`, { headers }),
    fetch(`${base}/platforms/records?perPage=500&sort=status,category,name`, { headers }),
    fetch(`${base}/articles/records?perPage=500&sort=-updated_at`, { headers }),
    fetch(`${base}/publish_tasks/records?perPage=500&expand=article_id,platform_id&sort=-updated_at`, { headers }),
    fetch(`${base}/ai_settings/records`, { headers }),
    fetch(`${base}/user_models/records?perPage=500`, { headers }),
    fetch(`${base}/product_images/records?perPage=500`, { headers }),
  ]);

  const products = ((await productsRes.json()).items || []).map(pbRecordToApp);
  const platforms = ((await platformsRes.json()).items || []).map(pbRecordToApp);
  const articles = ((await articlesRes.json()).items || []).map(pbRecordToApp);

  const geoQuestions = ((await geoRes.json()).items || []).map(r => {
    const q = pbRecordToApp(r);
    const product = products.find(p => String(p.id) === String(q.product_id));
    q.product_name = product ? product.name : "";
    return q;
  });

  const tasks = ((await tasksRes.json()).items || []).map(r => {
    const t = pbRecordToApp(r);
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
        t.product_id = a.product_id || "";
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

  const aiItems = ((await aiRes.json()).items || []).map(pbRecordToApp);
  const aiSettings = aiItems.length > 0 ? aiItems[0] : null;

  const userModels = ((await modelsRes.json()).items || []).map(pbRecordToApp);

  const productImages = ((await imagesRes.json()).items || []).map(pbRecordToApp);

  const coverage = apiCoverageInternal(products, geoQuestions, articles, tasks);

  return { products, geo_questions: geoQuestions, platforms, articles, tasks, ai_settings: aiSettings, user_models: userModels, product_images: productImages, coverage };
}

// ===== Coverage & Backup ==================================================

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

async function apiBackupExport() {
  const data = await apiBootstrap();
  delete data.coverage;
  return data;
}

// ===== Assign Tasks =======================================================

async function apiAssignTasks({ article_ids, platform_ids }) {
  const currentTasks = (await apiRequest(`/api/collections/publish_tasks/records?perPage=500`)).items || [];
  const created = [];
  const skipped = [];
  for (const aid of article_ids) {
    for (const pid of platform_ids) {
      const exists = currentTasks.find(t => t.article_id === String(aid) && t.platform_id === String(pid));
      if (exists) { skipped.push(exists.id); continue; }
      const data = await apiRequest("/api/collections/publish_tasks/records", {
        method: "POST",
        body: { article_id: String(aid), platform_id: String(pid), status: "todo", user_id: getCurrentUserId() },
      });
      created.push(data.id);
    }
  }
  return { created, skipped };
}

// ===== 挂载到全局 ==========================================================

window.geoApi = geoApi;
window.callAI = callAI;
window.ApiError = ApiError;
window.NotFoundError = NotFoundError;
window.ValidationError = ValidationError;
window.userLogin = userLogin;
window.userRegister = userRegister;
window.userLogout = userLogout;
window.isLoggedIn = isLoggedIn;
window.getCurrentUserId = getCurrentUserId;
window.getCurrentUserEmail = getCurrentUserEmail;
window.getCurrentUserName = getCurrentUserName;
