/* GEO Studio - PocketBase API adapter
 *
 * 将旧 Python 后端的 REST API 调用适配为 PocketBase API。
 * 所有 api() 调用的路径保持一致，内部自动转换为 PocketBase 格式。
 */

// 通过 Vite 代理访问 PocketBase，避免跨域问题
const PB_URL = "";
const PB_ADMIN_EMAIL = "admin@geo.local";
const PB_ADMIN_PASSWORD = "admin123456";

let _pbToken = null;

// ---- 认证 ----

async function pbAuth() {
  if (_pbToken) return _pbToken;
  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error("PocketBase 认证失败");
  const data = await res.json();
  _pbToken = data.token;
  return _pbToken;
}

// ---- 路径转换 ----

const COLLECTION_MAP = {
  products: "products",
  geo_questions: "geo_questions",
  platforms: "platforms",
  articles: "articles",
  tasks: "publish_tasks",
  ai_settings: "ai_settings",
  backup: null, // 特殊处理
  coverage: null,
  bootstrap: null,
};

function translatePath(path) {
  // /api/products          → {type:"list",   collection:"products"}
  // /api/products/1        → {type:"record", collection:"products", id:"1"}
  // /api/ai/prompt         → {type:"action", action:"ai_prompt"}
  // /api/bootstrap         → {type:"action", action:"bootstrap"}
  // /api/tasks/assign      → {type:"action", action:"tasks_assign"}
  const parts = path.replace(/^\/api\//, "").split("/");
  const resource = parts[0];

  // Digital ID pattern
  if (parts.length === 2 && /^\d+$/.test(parts[1])) {
    return { type: "record", collection: resource, id: parts[1] };
  }

  // Action endpoints (ai/*, backup/*, tasks/assign, coverage, bootstrap)
  if (resource === "ai" || resource === "backup" || resource === "coverage" || resource === "bootstrap") {
    return { type: "action", action: path };
  }
  if (resource === "tasks" && parts[1] === "assign") {
    return { type: "action", action: path };
  }

  return { type: "list", collection: resource };
}

// ---- PocketBase Record 字段转换 ----

function pbToApp(record) {
  // PocketBase 返回的 record 有额外字段 (id, collectionId, collectionName, created, updated)
  // 旧系统期望 id 是数字，但 PocketBase id 是字符串。保留原 id 为 pb_id，数字 id 放在 _legacy_id
  const { collectionId, collectionName, created, updated, expand, ...rest } = record;
  const result = {
    ...rest,
    id: record._legacy_id || record.id,
    created_at: created || rest.created_at || "",
    updated_at: updated || rest.updated_at || "",
  };

  // 展开关联字段
  if (expand) {
    for (const [key, val] of Object.entries(expand)) {
      // 将关联对象展开为 {field}_name 等
      if (val && typeof val === "object") {
        result[`${key}_name`] = val.name || val.title || val.question || "";
      }
    }
  }

  return result;
}

function appToPb(data) {
  // 移除前端可能携带的 id 和 meta 字段
  const { id, created_at, updated_at, ...rest } = data;
  return rest;
}

// ---- 核心 API ----

async function pbApi(path, options = {}) {
  await pbAuth();
  const translated = translatePath(path);
  const headers = {
    "Content-Type": "application/json",
    Authorization: _pbToken,
    ...(options.headers || {}),
  };

  if (translated.type === "action") {
    // Bootstrap: 聚合多个 collection 的查询
    if (path === "/api/bootstrap") {
      return pbBootstrap();
    }
    // Coverage
    if (path === "/api/coverage") {
      return pbCoverage();
    }
    // Backup export
    if (path === "/api/backup") {
      return pbBackupExport();
    }
    // AI endpoints — 这些需要特殊处理，后续再接入
    return {};
  }

  const method = (options.method || "GET").toUpperCase();
  let url;
  let body = options.body;

  if (translated.type === "list") {
    url = `${PB_URL}/api/collections/${translated.collection}/records`;
    // 添加排序
    if (translated.collection === "products") {
      url += "?sort=-updated";
    } else if (translated.collection === "geo_questions") {
      url += "?sort=-updated";
    } else if (translated.collection === "articles") {
      url += "?sort=-updated";
    } else if (translated.collection === "publish_tasks") {
      url += "?expand=article_id,platform_id&sort=-updated";
    }

    if (method === "POST") {
      // Create
      const payload = body ? JSON.parse(body) : {};
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(appToPb(payload)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return pbToApp(data);
    }
  } else if (translated.type === "record") {
    url = `${PB_URL}/api/collections/${translated.collection}/records/${translated.id}`;

    if (method === "GET") {
      // 获取单条（带 expand）
      if (translated.collection === "publish_tasks") {
        url += "?expand=article_id,platform_id";
      }
    } else if (method === "PUT" || method === "PATCH") {
      const payload = body ? JSON.parse(body) : {};
      const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(appToPb(payload)) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return pbToApp(data);
    } else if (method === "DELETE") {
      const res = await fetch(url, { method: "DELETE", headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      return { ok: true };
    }
  }

  // GET (list or record)
  if (method === "GET") {
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

    // PocketBase 返回 {items: [...], ...} 或 {单个record}
    if (data.items) {
      return data.items.map(pbToApp);
    }
    return pbToApp(data);
  }

  return {};
}

// ---- Bootstrap (聚合查询) ----

async function pbBootstrap() {
  const token = await pbAuth();
  const headers = { Authorization: token };
  const base = `${PB_URL}/api/collections`;

  const [productsRes, geoRes, platformsRes, articlesRes, tasksRes, aiRes] = await Promise.all([
    fetch(`${base}/products/records?sort=-updated`, { headers }),
    fetch(`${base}/geo_questions/records?sort=-updated`, { headers }),
    fetch(`${base}/platforms/records?sort=status,category,name`, { headers }),
    fetch(`${base}/articles/records?sort=-updated`, { headers }),
    fetch(`${base}/publish_tasks/records?expand=article_id,platform_id&sort=-updated`, { headers }),
    fetch(`${base}/ai_settings/records`, { headers }),
  ]);

  const products = ((await productsRes.json()).items || []).map(pbToApp);
  const platforms = ((await platformsRes.json()).items || []).map(pbToApp);
  const articles = ((await articlesRes.json()).items || []).map(pbToApp);

  // geo_questions: 需要 join product name
  const geoQuestions = ((await geoRes.json()).items || []).map(r => {
    const app = pbToApp(r);
    const product = products.find(p => p.id === app.product_id);
    app.product_name = product ? product.name : "";
    return app;
  });

  // publish_tasks: 需要展开 article 和 platform 信息
  const tasks = ((await tasksRes.json()).items || []).map(r => {
    const t = pbToApp(r);
    // expand 可能展开了关联
    if (t.expand && t.expand.article_id) {
      t.article_title = t.expand.article_id.title;
      t.article_summary = t.expand.article_id.summary;
      t.article_body = t.expand.article_id.body;
      t.article_keywords = t.expand.article_id.keywords;
      t.article_tags = t.expand.article_id.tags;
      t.article_image_prompt = t.expand.article_id.image_prompt;
      t.article_risk_notes = t.expand.article_id.risk_notes;
    }
    if (t.expand && t.expand.platform_id) {
      t.platform_name = t.expand.platform_id.name;
      t.platform_url = t.expand.platform_id.url;
      t.platform_category = t.expand.platform_id.category;
      t.platform_account_name = t.expand.platform_id.account_name;
      t.platform_login_notes = t.expand.platform_id.login_notes;
    }
    delete t.expand;
    return t;
  });

  // ai_settings
  const aiSettingsItems = ((await aiRes.json()).items || []).map(pbToApp);
  const aiSettings = aiSettingsItems.length > 0 ? aiSettingsItems[0] : null;

  // coverage
  const coverage = await pbCoverageInternal(products, platforms, articles, geoQuestions, tasks);

  return { products, geo_questions: geoQuestions, platforms, articles, tasks, ai_settings: aiSettings, coverage };
}

async function pbCoverage() {
  // coverage 已在 bootstrap 中计算，这里返回空（实际由 bootstrap 一起返回）
  return {};
}

async function pbCoverageInternal(products, platforms, articles, geoQuestions, tasks) {
  // 按问题统计
  const byQuestion = geoQuestions.map(q => {
    const articleCount = articles.filter(a => a.geo_question_id === q.id || a.geo_question_id === String(q.id)).length;
    const publishedTasks = tasks.filter(t =>
      t.status === "published" && articles.some(a =>
        (a.id === t.article_id || a.id === String(t.article_id)) && (a.geo_question_id === q.id || a.geo_question_id === String(q.id))
      )
    );
    return { geo_question_id: q.id, articles: articleCount, published: publishedTasks.length };
  });

  // 按产品统计
  const byProduct = products.map(p => {
    const qs = geoQuestions.filter(q => q.product_id === p.id || q.product_id === String(p.id));
    const totalQ = qs.length;
    const qidSet = new Set(qs.map(q => String(q.id)));
    let coveredQ = 0, publishedQ = 0;
    for (const qid of qidSet) {
      const cov = byQuestion.find(bq => String(bq.geo_question_id) === qid);
      if (cov && cov.articles > 0) coveredQ++;
      if (cov && cov.published > 0) publishedQ++;
    }
    const rate = totalQ ? Math.round((coveredQ / totalQ) * 1000) / 1000 : 0;
    const gaps = qs.filter(q =>
      q.status === "active" && !byQuestion.some(bq =>
        String(bq.geo_question_id) === String(q.id) && bq.articles > 0
      )
    ).map(q => ({ id: q.id, question: q.question, priority: q.priority }));

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

async function pbBackupExport() {
  // 备份导出：聚合所有数据
  const data = await pbBootstrap();
  delete data.coverage;
  return data;
}

// ---- 挂载到全局 ----

window.pbApi = pbApi;
