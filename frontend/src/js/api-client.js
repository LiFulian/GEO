/* GEO Studio — API Client Layer
 *
 * 三层 API 客户端：
 *   1. 配置（从 window.__GEO_CONFIG__ 或默认值读取）
 *   2. 认证（用户 Token 管理，支持注册/登录/登出）
 *   3. 请求（路径翻译 + user_id 注入 + 错误处理）
 */

// ===== 第一层：配置 =======================================================

const CONFIG = {
  // 默认空字符串 → 同源调用 /api/...（dev 走 vite proxy，prod 走 PocketBase 同源）
  // 仅当后端与前端不同源时，由 vite 插件注入的 window.__GEO_CONFIG__.pbUrl 覆盖
  pbUrl: (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || "",
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

// 已知的「动作端点」——单参 collection map 无法区分，必须在路由翻译前优先识别。
// 否则 /api/tasks/assign 会被误判为「publish_tasks 列表 POST」（assign 不是合法 id），
// 导致「批量分配发布任务」功能完全失效。
const ACTION_PATHS = new Set(["/api/bootstrap", "/api/coverage", "/api/backup", "/api/tasks/assign"]);

function translatePath(path, method) {
  if (ACTION_PATHS.has(path)) return { type: "action", path };

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

// 全量分页拉取某个集合的所有记录（避免 perPage=500 静默截断重度用户的数据）
async function fetchAllRecords(coll, { expand = "", sort = "" } = {}) {
  const all = [];
  let page = 1;
  const perPage = 500;
  while (true) {
    const params = new URLSearchParams();
    params.set("perPage", String(perPage));
    params.set("page", String(page));
    if (expand) params.set("expand", expand);
    if (sort) params.set("sort", sort);
    const data = await apiRequest(`/api/collections/${coll}/records?${params.toString()}`);
    const items = data.items || [];
    for (const it of items) all.push(it);
    const totalPages = data.totalPages || Math.ceil((data.totalItems || 0) / perPage) || 1;
    if (page >= totalPages || items.length === 0) break;
    page++;
  }
  return all;
}

// 把 publish_tasks 的 expand（article_id / platform_id）展平到任务对象上
function flattenTaskExpand(t, expand) {
  if (!expand) return t;
  if (expand.article_id) {
    const a = expand.article_id;
    t.article_title = a.title || "";
    t.article_summary = a.summary || "";
    t.article_body = a.body || "";
    t.article_keywords = a.keywords || "";
    t.article_tags = a.tags || "";
    t.article_image_prompt = a.image_prompt || "";
    t.article_risk_notes = a.risk_notes || "";
    t.product_id = a.product_id || "";
  }
  if (expand.platform_id) {
    const p = expand.platform_id;
    t.platform_name = p.name || "";
    t.platform_url = p.url || "";
    t.platform_category = p.category || "";
    t.platform_account_name = p.account_name || "";
    t.platform_login_notes = p.login_notes || "";
  }
  return t;
}

// ===== AI 端点处理（前端直连，经同源代理规避 CORS） =============================================

// 全局 loading 引用计数：所有 AI HTTP 都走 aiFetch，统一在这里显隐全局 loader。
// 用计数而非布尔，是为了让批量检测（N 次连续 callAI）期间 loader 持续显示、
// 不会在每次调用间隙闪烁；最后一个请求结束时才隐藏。
let _aiLoaderDepth = 0;
function _aiLoaderStart() {
  _aiLoaderDepth++;
  if (typeof showGlobalLoader === "function") showGlobalLoader();
}
function _aiLoaderEnd() {
  _aiLoaderDepth = Math.max(0, _aiLoaderDepth - 1);
  if (_aiLoaderDepth === 0 && typeof hideGlobalLoader === "function") hideGlobalLoader();
}

// 统一的 AI HTTP 请求：优先走 PocketBase 同源代理 /api/ai/proxy（规避浏览器跨域），
// 代理不可用（404/未部署 hook）或网络异常时回退到浏览器直连（兼容智谱等允许跨域的厂商）。
// headers / bodyObj 为发往上游 AI 厂商的请求头与请求体。
async function aiFetch(targetUrl, headers, bodyObj) {
  _aiLoaderStart();
  try {
    const proxyUrl = `${CONFIG.pbUrl}/api/ai/proxy`;
    try {
      const token = await apiAuth();
      const proxyRes = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ url: targetUrl, method: "POST", headers, body: bodyObj }),
      });
      if (proxyRes.status !== 404) {
        const data = await proxyRes.json().catch(() => null);
        if (!proxyRes.ok) {
          const msg = (data && data.error && data.error.message) || `HTTP ${proxyRes.status}`;
          throw new ApiError(`AI 调用失败：${msg}`, proxyRes.status);
        }
        return data;
      }
      // 404 → 代理未挂载，落到下方直连
    } catch (err) {
      if (err instanceof ApiError) throw err; // 代理已返回的错误，原样抛出
      // 其它异常（网络/CORS）→ 回退直连
    }

    // 直连（兜底）
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyObj),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(`AI 调用失败：${err.error?.message || `HTTP ${res.status}`}`, res.status);
    }
    return await res.json();
  } finally {
    _aiLoaderEnd();
  }
}

async function callAI(settings, messages) {
  const baseUrl = settings.text_base_url || settings.base_url || "https://open.bigmodel.cn/api/paas/v4";
  const model = settings.text_model || settings.model || "glm-4-flash";
  const apiKey = settings.text_api_key || settings.api_key || "";

  if (!apiKey) throw new ValidationError("请先配置 AI API Key");

  const temperature = parseFloat(settings.temperature || 0.7);

  const data = await aiFetch(`${baseUrl}/chat/completions`, {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }, { model, messages, temperature });

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
      // 这些集合不按 -updated_at 排序：publish_tasks 在 bootstrap 内单独排序+expand；
      // ai_settings / user_models / product_images 历史迁移未含时间字段，跳过避免 400。
      const skipSort = coll === "publish_tasks" || coll === "ai_settings" || coll === "user_models" || coll === "product_images";
      const sort = skipSort ? "" : "-updated_at";
      const expand = coll === "publish_tasks" ? "article_id,platform_id" : "";
      const items = await fetchAllRecords(coll, { expand, sort });
      return items.map(pbRecordToApp);
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
      const rec = pbRecordToApp(data);
      return collection === "publish_tasks" ? flattenTaskExpand(rec, data.expand) : rec;
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
  const [productsRaw, geoRaw, platformsRaw, articlesRaw, tasksRaw, aiRaw, modelsRaw, imagesRaw, checksRaw] = await Promise.all([
    fetchAllRecords("products", { sort: "-updated_at" }),
    fetchAllRecords("geo_questions", { sort: "-updated_at" }),
    fetchAllRecords("platforms", { sort: "status,category,name" }),
    fetchAllRecords("articles", { sort: "-updated_at" }),
    fetchAllRecords("publish_tasks", { expand: "article_id,platform_id", sort: "-updated_at" }),
    fetchAllRecords("ai_settings"),
    fetchAllRecords("user_models"),
    fetchAllRecords("product_images"),
    // geo_rank_checks 是新集合；若用户的 PB 尚未跑迁移（集合不存在），降级为空数组而非整体崩溃
    fetchAllRecords("geo_rank_checks", { sort: "-created_at" }).catch(() => []),
  ]);

  const products = productsRaw.map(pbRecordToApp);
  const platforms = platformsRaw.map(pbRecordToApp);
  const articles = articlesRaw.map(pbRecordToApp);

  const geoQuestions = geoRaw.map(r => {
    const q = pbRecordToApp(r);
    const product = products.find(p => String(p.id) === String(q.product_id));
    q.product_name = product ? product.name : "";
    return q;
  });

  const tasks = tasksRaw.map(r => flattenTaskExpand(pbRecordToApp(r), r.expand));

  const aiItems = aiRaw.map(pbRecordToApp);
  const aiSettings = aiItems.length > 0 ? aiItems[0] : null;

  const userModels = modelsRaw.map(pbRecordToApp);
  const productImages = imagesRaw.map(pbRecordToApp);
  const geoRankChecks = checksRaw.map(pbRecordToApp);

  const coverage = apiCoverageInternal(products, geoQuestions, articles, tasks);

  return { products, geo_questions: geoQuestions, platforms, articles, tasks, ai_settings: aiSettings, user_models: userModels, product_images: productImages, geo_rank_checks: geoRankChecks, coverage };
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
  const currentTasks = await fetchAllRecords("publish_tasks");
  const created = [];
  const skipped = [];
  const now = new Date().toISOString();
  for (const aid of article_ids) {
    for (const pid of platform_ids) {
      const exists = currentTasks.find(t => t.article_id === String(aid) && t.platform_id === String(pid));
      if (exists) { skipped.push(exists.id); continue; }
      const data = await apiRequest("/api/collections/publish_tasks/records", {
        method: "POST",
        body: {
          article_id: String(aid), platform_id: String(pid), status: "todo",
          user_id: getCurrentUserId(), created_at: now, updated_at: now,
        },
      });
      created.push(data.id);
    }
  }
  return { created, skipped };
}

// ===== 挂载到全局 ==========================================================

window.geoApi = geoApi;
window.callAI = callAI;
window.aiFetch = aiFetch;
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
