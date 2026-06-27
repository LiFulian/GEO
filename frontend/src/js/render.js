/* GEO Studio - Render functions for all views */

function render() {
  renderStats();
  renderCoverage();
  renderProducts();
  renderGeoQuestions();
  renderGenerator();
  renderArticles();
  renderPlatforms();
  renderTasks();
  renderAiSettings();
}

function showView(viewId) {
  $$(".nav").forEach(x => x.classList.toggle("active", x.dataset.view === viewId));
  $$(".view").forEach(x => x.classList.toggle("active", x.id === viewId));
  const nav = $(`.nav[data-view="${viewId}"]`);
  if (nav) $("#viewTitle").textContent = nav.dataset.title || nav.textContent;
  // Close mobile sidebar after navigation
  $(".sidebar")?.classList.remove("open");
  $("#sidebarOverlay")?.classList.remove("show");
  // Restore article draft when entering articles view with empty editor
  if (viewId === "articles") {
    setTimeout(loadArticleDraft, 50);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- Dashboard ---

function renderStats() {
  const published = state.tasks.filter(t => t.status === "published").length;
  $("#statProducts").textContent = state.products.length;
  $("#statQuestions").textContent = state.geo_questions.length;
  $("#statArticles").textContent = state.articles.length;
  $("#statTasks").textContent = state.tasks.length;
  // Update the "发布任务" label to show published count
  const statTaskEl = $("#statTasks").parentElement;
  statTaskEl.querySelector("small").textContent = `发布任务 · ${published} 已发布`;

  // Onboarding guide for new users
  const onboardingEl = $("#onboardingCard");
  if (onboardingEl) {
    if (!state.products.length) {
      onboardingEl.style.display = "grid";
      onboardingEl.innerHTML = `
        <h3>🚀 开始使用 GEO Studio</h3>
        <div class="onboarding-steps">
          <div class="onboarding-step">
            <span class="step-num">1</span>
            <strong>创建产品档案</strong>
            <p>填写产品名称、卖点、受众、禁用词等基本信息。</p>
          </div>
          <div class="onboarding-step">
            <span class="step-num">2</span>
            <strong>挖掘 GEO 问题</strong>
            <p>手动添加或让 AI 批量生成用户可能搜索的问题。</p>
          </div>
          <div class="onboarding-step">
            <span class="step-num">3</span>
            <strong>生成内容草稿</strong>
            <p>选择目标平台与内容类型，一键生成多篇文章。</p>
          </div>
          <div class="onboarding-step">
            <span class="step-num">4</span>
            <strong>分配发布任务</strong>
            <p>把文章分发到各平台，记录发布状态与链接。</p>
          </div>
        </div>
      `;
    } else {
      onboardingEl.style.display = "none";
      onboardingEl.innerHTML = "";
    }
  }

  // 高优先级问题（排除已在缺口列表中显示的未覆盖问题，避免重复）
  const gapIds = new Set((state.coverage?.by_product || [])
    .flatMap(p => p.gaps.filter(g => g.priority === "high").map(g => g.id)));
  $("#topQuestions").innerHTML = state.geo_questions
    .filter(q => q.priority === "high" && !gapIds.has(q.id))
    .slice(0, 6)
    .map(q => {
      const parts = [escapeHtml(q.product_name), escapeHtml(q.intent), escapeHtml(q.priority)].filter(Boolean);
      return `
      <div class="list-row question-link" data-id="${q.id}">
        <strong>${escapeHtml(q.question)}</strong>
        ${parts.length ? `<div class="muted">${parts.join(" · ")}</div>` : ""}
      </div>`;
    }).join("") || emptyStateWithAction("还没有高优先级问题", "Q", `<button class="ghost" data-action="jump" data-target="geo">去 GEO 问题库</button>`);
  $$(".question-link").forEach(row => row.addEventListener("click", () => {
    showView("geo");
    selectGeoQuestion(Number(row.dataset.id));
  }));

  $("#recentArticles").innerHTML = state.articles.slice(0, 6).map(article => {
    const parts = [escapeHtml(article.target_platform), escapeHtml(article.content_type)].filter(Boolean);
    return `
    <div class="list-row article-link" data-id="${article.id}">
      <strong>${escapeHtml(article.title)}</strong>
      ${parts.length ? `<div class="muted">${parts.join(" · ")}</div>` : ""}
    </div>`;
  }).join("") || emptyStateWithAction("还没有文章", "📝", `<button class="ghost" data-action="jump" data-target="generator">去内容生成</button>`);
  $$(".article-link").forEach(row => row.addEventListener("click", () => {
    showView("articles");
    selectArticle(Number(row.dataset.id));
  }));

  $("#todoTasks").innerHTML = state.tasks.filter(t => t.status === "todo").slice(0, 6).map(task => `
    <div class="list-row task-link" data-id="${task.id}">
      <strong>${escapeHtml(task.article_title)}</strong>
      <div class="muted">${escapeHtml(task.platform_name)}</div>
    </div>
  `).join("") || emptyStateWithAction("暂无待发布任务", "📋", `<button class="ghost" data-action="jump" data-target="tasks">去发布记录</button>`);
  $$(".task-link").forEach(row => row.addEventListener("click", () => {
    showView("tasks");
  }));
}

// --- GEO Coverage ---

function renderCoverage() {
  const cov = state.coverage || { by_product: [], summary: {} };
  const s = cov.summary || {};
  const ratePct = Math.round((s.rate || 0) * 100);
  $("#coverageSummary").textContent = s.total_q
    ? `已覆盖 ${s.covered_q} / ${s.total_q} 个问题（${ratePct}%）· 高优先级缺口 ${s.high_priority_gaps} 个`
    : "暂无 GEO 问题";

  // 按产品显示覆盖率进度条
  $("#coverageByProduct").innerHTML = cov.by_product.map(p => {
    const pct = p.total_q ? Math.round((p.covered_q / p.total_q) * 100) : 0;
    const tone = pct >= 80 ? "good" : pct >= 40 ? "mid" : "low";
    return `
      <div class="coverage-row">
        <div class="coverage-meta">
          <strong>${escapeHtml(p.product_name)}</strong>
          <span class="muted">${p.covered_q}/${p.total_q} 覆盖 · ${p.published_q} 已发布 · ${p.gaps.length} 缺口</span>
        </div>
        <div class="progress"><div class="progress-bar ${tone}" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join("") || emptyStateWithAction("还没有产品", "📦", `<button class="ghost" data-action="jump" data-target="products">去产品档案</button>`);

  // 高优先级缺口列表（取所有产品 gaps 中 priority=high 的前 6 条）
  const gaps = cov.by_product.flatMap(p => p.gaps.map(g => ({ ...g, product_name: p.product_name })))
    .filter(g => g.priority === "high")
    .slice(0, 6);
  $("#coverageGaps").innerHTML = gaps.length
    ? `<h3 style="margin-top:14px">高优先级内容缺口（建议优先创作）</h3>` +
      gaps.map(g => `
        <div class="list-row gap-link" data-id="${g.id}">
          <strong>${escapeHtml(g.question)}</strong>
          <div class="muted">${escapeHtml(g.product_name)} · ${escapeHtml(g.priority)}</div>
        </div>
      `).join("")
    : "";
  $$(".gap-link").forEach(row => row.addEventListener("click", () => {
    const qId = Number(row.dataset.id);
    showView("geo");
    selectGeoQuestion(qId);
    // 高亮对应的问题卡片
    setTimeout(() => {
      const card = $(`.geo-question-card .edit-geo-question[data-id="${qId}"]`)?.closest(".geo-question-card");
      if (card) {
        card.classList.add("highlight");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => card.classList.remove("highlight"), 3000);
      }
    }, 100);
  }));
}

// --- Products ---

function renderProducts() {
  $("#productList").innerHTML = state.products.map(product => {
    const qCount = state.geo_questions.filter(q => q.product_id === product.id).length;
    const aCount = state.articles.filter(a => a.product_id === product.id).length;
    const cov = (state.coverage?.by_product || []).find(p => p.product_id === product.id);
    const covered = cov?.covered_q || 0;
    const total = cov?.total_q || 0;
    const meta = [escapeHtml(product.type), escapeHtml(product.url)].filter(Boolean).join(" · ");
    return `
    <article class="card product-card" data-id="${product.id}">
      <h3>${escapeHtml(product.name)}</h3>
      ${meta ? `<p class="muted">${meta}</p>` : ""}
      <p>${escapeHtml((product.selling_points || "").slice(0, 150))}</p>
      <div class="tagline">
        <span class="tag">${total ? `${covered}/${total} 覆盖` : "0 问题"}</span>
        <span class="tag">${aCount} 篇文章</span>
        ${product.tone ? `<span class="tag">${escapeHtml(product.tone)}</span>` : ""}
        ${product.goal ? `<span class="tag">${escapeHtml(product.goal)}</span>` : ""}
      </div>
      <div class="button-row mini-actions">
        <button class="ghost edit-product" data-id="${product.id}">编辑</button>
        <button class="ghost use-product" data-id="${product.id}">去生成</button>
        <button class="ghost delete-product" data-id="${product.id}">删除</button>
      </div>
    </article>`;
  }).join("") || emptyStateWithAction("还没有产品档案", "📦", `<button class="ghost" data-action="jump" data-target="products">新增产品</button>`);
}

function selectProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  const form = $("#productForm");
  form.elements.id.value = product.id;
  form.elements.name.value = product.name || "";
  form.elements.type.value = product.type || "";
  form.elements.url.value = product.url || "";
  form.elements.audience.value = product.audience || "";
  form.elements.selling_points.value = product.selling_points || "";
  form.elements.competitors.value = product.competitors || "";
  form.elements.tone.value = product.tone || "";
  form.elements.goal.value = product.goal || "";
  form.elements.forbidden_words.value = product.forbidden_words || "";
  $("#productFormTitle").textContent = "编辑产品";
  $("#saveProductBtn").textContent = "更新产品";
}

function resetProductForm() {
  $("#productForm").reset();
  $("#productId").value = "";
  $("#productFormTitle").textContent = "新增产品";
  $("#saveProductBtn").textContent = "保存产品";
  $("#productForm").elements.tone.value = "真实、专业、克制";
}

function applyProductSuggestion(rawItem) {
  const item = normalizeProductSuggestion(rawItem);
  const form = $("#productForm");
  for (const [key, value] of Object.entries(item)) {
    if (form.elements[key] && value !== undefined) {
      form.elements[key].value = value;
    }
  }
  $("#productFormTitle").textContent = $("#productId").value ? "编辑产品" : "新增产品";
}

// --- Generator ---

function renderGenerator() {
  // 保留产品选择
  const genProductEl = $("#genProduct");
  const curGenProduct = genProductEl.value;
  genProductEl.innerHTML = state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  if (curGenProduct && Array.from(genProductEl.options).some(o => o.value === curGenProduct)) {
    genProductEl.value = curGenProduct;
  }
  $("#contentTypes").innerHTML = contentTypes.map((type, index) => `
    <label><input type="checkbox" value="${escapeHtml(type)}" ${index < 5 ? "checked" : ""}>${escapeHtml(type)}</label>
  `).join("");
  const enabled = state.platforms.filter(p => p.status === "enabled").slice(0, 40);
  // 按分类分组渲染平台
  const groups = {};
  enabled.forEach(p => {
    const cat = p.category || "其他";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  $("#genPlatforms").innerHTML = Object.entries(groups).map(([cat, platforms]) => `
    <div class="platform-group">
      <div class="platform-group-title">${escapeHtml(cat)}</div>
      ${platforms.map(p => `<label title="${escapeHtml(p.notes)}"><input type="checkbox" value="${p.id}">${escapeHtml(p.name)}</label>`).join("")}
    </div>
  `).join("");
  const adaptArticleEl = $("#adaptArticle");
  const curAdaptArticle = adaptArticleEl.value;
  adaptArticleEl.innerHTML = state.articles.map(article => `<option value="${article.id}">${escapeHtml(article.title)}</option>`).join("");
  if (curAdaptArticle) adaptArticleEl.value = curAdaptArticle;
  const adaptPlatformEl = $("#adaptPlatform");
  const curAdaptPlatform = adaptPlatformEl.value;
  adaptPlatformEl.innerHTML = state.platforms
    .filter(platform => platform.status !== "paused")
    .map(platform => `<option value="${platform.id}">${escapeHtml(platform.name)}${platform.account_name ? ` / ${escapeHtml(platform.account_name)}` : ""}</option>`)
    .join("");
  if (curAdaptPlatform) adaptPlatformEl.value = curAdaptPlatform;
}

// --- GEO Questions ---

function renderGeoQuestions() {
  const productOptions = state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  // 保留 geoProduct 选中值
  const gpEl = $("#geoProduct");
  const curGeoProduct = gpEl.value;
  gpEl.innerHTML = productOptions;
  // 恢复选中值；若当前值无效（首次加载或对应产品已删除），回退到第一个产品
  if (curGeoProduct && Array.from(gpEl.options).some(o => o.value === curGeoProduct)) {
    gpEl.value = curGeoProduct;
  } else if (state.products.length) {
    gpEl.value = state.products[0].id;
  }
  // geoPromptProduct 默认选第一个产品（AI 生成问题库区域）
  const gppEl = $("#geoPromptProduct");
  const curGpp = gppEl.value;
  gppEl.innerHTML = productOptions;
  if (curGpp && Array.from(gppEl.options).some(o => o.value === curGpp)) {
    gppEl.value = curGpp;
  } else if (state.products.length) {
    gppEl.value = state.products[0].id;
  }
  const filterOpts = `<option value="">全部产品</option>` + productOptions;
  const geoFilterEl = $("#geoFilterProduct");
  if (geoFilterEl) {
    const currentVal = geoFilterEl.value;
    geoFilterEl.innerHTML = filterOpts;
    geoFilterEl.value = currentVal;
  }

  // Filter by product and search
  const filterProduct = ($("#geoFilterProduct")?.value || "").trim();
  const query = ($("#geoSearch")?.value || "").trim().toLowerCase();
  const list = state.geo_questions.filter(item => {
    if (filterProduct && String(item.product_id) !== filterProduct) return false;
    const text = `${item.question} ${item.intent} ${item.audience} ${item.content_angle} ${item.target_platform} ${item.product_name}`.toLowerCase();
    return !query || text.includes(query);
  });
  $("#geoQuestionList").innerHTML = list.map(item => {
    const cov = (state.coverage?.by_question || []).find(c => c.geo_question_id === item.id);
    const articles = cov?.articles || 0;
    const published = cov?.published || 0;
    const coverTag = articles > 0
      ? `<span class="tag covered">已覆盖 ${articles} 篇${published ? ` · 已发布 ${published}` : ""}</span>`
      : `<span class="tag uncovered">未覆盖</span>`;
    const metaParts = [escapeHtml(item.product_name), escapeHtml(item.intent), escapeHtml(item.audience)].filter(Boolean);
    return `
    <article class="card geo-question-card ${item.status}">
      <div class="panel-heading">
        <h3>${escapeHtml(item.question)}</h3>
        <span class="status ${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>
      </div>
      ${metaParts.length ? `<p class="muted">${metaParts.join(" · ")}</p>` : ""}
      ${item.content_angle ? `<p>${escapeHtml(item.content_angle)}</p>` : ""}
      <div class="tagline">
        <span class="tag">${escapeHtml(item.status)}</span>
        ${item.target_platform ? `<span class="tag">${escapeHtml(item.target_platform)}</span>` : ""}
        ${coverTag}
      </div>
      <div class="button-row mini-actions">
        <button class="ghost edit-geo-question" data-id="${item.id}">编辑</button>
        <button class="ghost cover-geo-question" data-id="${item.id}">标记为已覆盖</button>
        <button class="ghost delete-geo-question" data-id="${item.id}">删除</button>
      </div>
    </article>
  `;
  }).join("") || (state.geo_questions.length ? `<div class="search-empty">没有找到匹配的问题</div>` : emptyStateWithAction("还没有 GEO 问题", "Q", `<button class="ghost" data-action="jump" data-target="geo">新增 GEO 问题</button>`));
}

function selectGeoQuestion(id) {
  const item = state.geo_questions.find(q => q.id === id);
  if (!item) return;
  $("#geoQuestionId").value = item.id;
  $("#geoProduct").value = item.product_id || "";
  $("#geoQuestionText").value = item.question || "";
  $("#geoIntent").value = item.intent || "";
  $("#geoAudience").value = item.audience || "";
  $("#geoPriority").value = item.priority || "medium";
  $("#geoStatus").value = item.status || "active";
  $("#geoAngle").value = item.content_angle || "";
  $("#geoPlatform").value = item.target_platform || "";
  $("#geoQuestionFormTitle").textContent = "编辑 GEO 问题";
}

function resetGeoQuestionForm() {
  $("#geoQuestionForm").reset();
  $("#geoQuestionId").value = "";
  $("#geoProduct").selectedIndex = 0; // 重置下拉框到第一个选项
  $("#geoPriority").value = "medium";
  $("#geoStatus").value = "active";
  $("#geoQuestionFormTitle").textContent = "新增 GEO 问题";
}

// --- AI Settings ---

function renderAiSettings() {
  const ai = state.ai_settings || {};
  $("#aiPreset").innerHTML = `<option value="">选择后自动填充</option>` + aiPresets.map((preset, index) => `
    <option value="${index}">${escapeHtml(preset.name)}</option>
  `).join("");
  $("#aiMode").value = ai.mode || "manual";
  $("#textBaseUrl").value = ai.text_base_url || ai.base_url || "https://open.bigmodel.cn/api/paas/v4";
  $("#textModel").value = ai.text_model || ai.model || "glm-4-flash";
  $("#imageBaseUrl").value = ai.image_base_url || "https://open.bigmodel.cn/api/paas/v4";
  $("#imageModel").value = ai.image_model || "cogview-3-flash";
  $("#aiTemperature").value = ai.temperature || 0.7;
  $("#textKeyStatus").textContent = ai.has_text_api_key ? "已保存文本模型 Key，留空不会覆盖" : "未保存文本模型 Key";
  $("#imageKeyStatus").textContent = ai.has_image_api_key ? "已保存图片模型 Key，留空不会覆盖" : "未保存图片模型 Key";
}

// --- Articles ---

function renderArticles() {
  // Render product selector in article editor（保留当前选中值）
  const productOpts = state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  const apEl = $("#articleProduct");
  const curProduct = apEl.value;
  apEl.innerHTML = `<option value="0">未关联</option>` + productOpts;
  // 恢复选中值：如果有已选文章，用其 product_id；否则保留当前值
  if (state.selectedArticleId) {
    const article = state.articles.find(a => a.id === state.selectedArticleId);
    if (article) apEl.value = article.product_id || 0;
  } else {
    apEl.value = curProduct || "0";
  }

  // Render GEO question selector（按当前所选产品过滤，保留当前选中值）
  const agEl = $("#articleGeoQuestion");
  if (agEl) {
    const curQ = agEl.value;
    const productId = Number(apEl.value || 0);
    const qs = state.geo_questions.filter(q => !productId || q.product_id === productId);
    agEl.innerHTML = `<option value="0">未关联（不影响覆盖率统计）</option>` +
      qs.map(q => `<option value="${q.id}">${escapeHtml(q.question)}</option>`).join("");
    if (state.selectedArticleId) {
      const article = state.articles.find(a => a.id === state.selectedArticleId);
      if (article) agEl.value = article.geo_question_id || 0;
    } else if (curQ) {
      agEl.value = curQ;
    }
  }

  // Render filter dropdowns
  const filterProductOpts = `<option value="">全部产品</option>` + productOpts;
  const afpEl = $("#articleFilterProduct");
  if (afpEl) {
    const cur = afpEl.value;
    afpEl.innerHTML = filterProductOpts;
    afpEl.value = cur;
  }

  const query = ($("#articleSearch")?.value || "").trim().toLowerCase();
  const filterProduct = ($("#articleFilterProduct")?.value || "").trim();
  const filterStatus = ($("#articleFilterStatus")?.value || "").trim();
  const filtered = state.articles.filter(article => {
    if (filterProduct && String(article.product_id) !== filterProduct) return false;
    if (filterStatus && article.status !== filterStatus) return false;
    const text = `${article.title} ${article.content_type} ${article.target_platform} ${article.tags} ${article.summary || ""} ${article.body || ""}`.toLowerCase();
    return !query || text.includes(query);
  });

  $("#articleList").innerHTML = filtered.map(article => {
    const geoQ = state.geo_questions.find(q => q.id === article.geo_question_id);
    const parts = [escapeHtml(article.target_platform), escapeHtml(article.content_type), geoQ ? escapeHtml(geoQ.question) : ""].filter(Boolean);
    return `
    <article class="article-row ${article.id === state.selectedArticleId ? "active" : ""}" data-id="${article.id}">
      <h3>${escapeHtml(article.title)}</h3>
      ${parts.length ? `<p class="muted">${parts.join(" · ")}</p>` : ""}
      <div class="tagline">
        <span class="tag">${escapeHtml(article.status)}</span>
        ${(article.tags || "").split(",").filter(Boolean).slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag.trim())}</span>`).join("")}
      </div>
    </article>`;
  }).join("") || (state.articles.length ? `<div class="search-empty">没有找到匹配的文章</div>` : emptyStateWithAction("文章库为空", "📝", `<button class="ghost" data-action="jump" data-target="generator">去生成文章</button>`));

  $("#taskArticlePicker").innerHTML = state.articles.map(article => `
    <label><input type="checkbox" value="${article.id}">${escapeHtml(article.title)}</label>
  `).join("");
}

function setArticleEditorMode(editing) {
  const editor = $("#articleEditor");
  if (editor) editor.classList.toggle("editing", editing);
  const titleEl = $("#articleEditorTitle");
  if (titleEl) titleEl.textContent = editing ? "编辑文章" : "新建文章";
}

function selectArticle(id) {
  const article = state.articles.find(a => a.id === id);
  if (!article) return;
  state.selectedArticleId = id;
  state.selectedArticleProductId = article.product_id;
  setArticleEditorMode(true);
  $("#articleId").value = article.id;
  $("#articleProduct").value = article.product_id || 0;
  $("#articleGeoQuestion").value = article.geo_question_id || 0;
  $("#articleTitle").value = article.title || "";
  $("#articleSummary").value = article.summary || "";
  $("#articleBody").value = article.body || "";
  $("#articleType").value = article.content_type || "";
  $("#articlePlatform").value = article.target_platform || "";
  $("#articleKeywords").value = article.keywords || "";
  $("#articleTags").value = article.tags || "";
  $("#articleImage").value = article.image_prompt || "";
  $("#articleRisk").value = article.risk_notes || "";
  $("#articleStatus").value = article.status || "draft";
  renderArticles();
  renderPreview();
  updateWordCount();
}

function updateWordCount() {
  const body = ($("#articleBody")?.value || "").trim();
  const title = ($("#articleTitle")?.value || "").trim();
  const full = title + " " + body;
  // Count Chinese characters + English words
  const chineseChars = (full.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = full.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(w => w.length > 0).length;
  const totalWords = chineseChars + englishWords;
  const wc = $("#wordCount");
  const cc = $("#charCount");
  if (wc) wc.textContent = `${totalWords} 字`;
  if (cc) cc.textContent = `${full.length} 字符`;
}

function renderPreview() {
  const body = $("#articleBody").value || "";
  const preview = $("#previewBody");
  if (!preview) return;
  preview.innerHTML = markdownToHtml(body);
  updateWordCount();
}

// --- Platforms ---

function renderPlatforms() {
  const query = ($("#platformSearch")?.value || "").trim().toLowerCase();
  const list = state.platforms.filter(p => {
    const text = `${p.name} ${p.category} ${p.content_style} ${p.notes} ${p.account_name} ${p.login_notes}`.toLowerCase();
    return !query || text.includes(query);
  });
  $("#platformGrid").innerHTML = list.map(platform => {
    const metaParts = [escapeHtml(platform.category), escapeHtml(platform.recommended_words)].filter(Boolean);
    return `
    <article class="platform-card ${platform.id === state.selectedPlatformId ? "active" : ""}">
      <div class="panel-heading">
        <h3>${escapeHtml(platform.name)}</h3>
        <span class="status ${escapeHtml(platform.status)}">${escapeHtml(platform.status)}</span>
      </div>
      ${metaParts.length ? `<p class="muted">${metaParts.join(" · ")}</p>` : ""}
      ${platform.account_name ? `<p class="muted">账号：${escapeHtml(platform.account_name)}</p>` : ""}
      <p>${escapeHtml(platform.content_style)}</p>
      <div class="tagline">
        <span class="tag">外链：${escapeHtml(platform.allows_external_links || "-")}</span>
        <span class="tag">软文：${escapeHtml(platform.soft_article_fit || "-")}</span>
      </div>
      <div class="button-row">
        <button class="ghost open-platform" data-url="${escapeHtml(platform.url)}">打开</button>
        <button class="ghost edit-platform" data-id="${platform.id}">编辑</button>
        <button class="ghost toggle-platform" data-id="${platform.id}" data-status="${platform.status === "enabled" ? "watch" : "enabled"}">${platform.status === "enabled" ? "观察" : "启用"}</button>
        <button class="ghost delete-platform" data-id="${platform.id}">删除</button>
      </div>
    </article>
  `}).join("") || (state.platforms.length ? `<div class="search-empty">没有找到匹配的平台</div>` : emptyStateWithAction("没有平台", "🔍", `<button class="ghost" data-action="jump" data-target="platforms">新增平台</button>`));

  const enabled = state.platforms.filter(p => p.status === "enabled");
  $("#taskPlatformPicker").innerHTML = enabled.map(platform => `
    <label><input type="checkbox" value="${platform.id}">${escapeHtml(platform.name)}${platform.account_name ? ` / ${escapeHtml(platform.account_name)}` : ""}</label>
  `).join("");
}

function selectPlatform(id) {
  const platform = state.platforms.find(item => item.id === id);
  if (!platform) return;
  state.selectedPlatformId = id;
  $("#platformId").value = platform.id;
  $("#platformName").value = platform.name || "";
  $("#platformCategory").value = platform.category || "";
  $("#platformUrl").value = platform.url || "";
  $("#platformAccountName").value = platform.account_name || "";
  $("#platformLoginNotes").value = platform.login_notes || "";
  $("#platformContentStyle").value = platform.content_style || "";
  $("#platformWords").value = platform.recommended_words || "";
  $("#platformFrequency").value = platform.frequency || "";
  $("#platformTitleStyle").value = platform.title_style || "";
  $("#platformTagsRule").value = platform.tags_rule || "";
  $("#platformLinks").value = platform.allows_external_links || "limited";
  $("#platformFit").value = platform.soft_article_fit || "medium";
  $("#platformStatus").value = platform.status || "enabled";
  $("#platformNotes").value = platform.notes || "";
  $("#platformFormTitle").textContent = "编辑平台账号";
  renderPlatforms();
}

function resetPlatformForm() {
  state.selectedPlatformId = null;
  $("#platformForm").reset();
  $("#platformId").value = "";
  $("#platformFormTitle").textContent = "平台账号";
  $("#platformLinks").value = "limited";
  $("#platformFit").value = "medium";
  $("#platformStatus").value = "enabled";
  renderPlatforms();
}

// --- Tasks ---

function renderTasks() {
  $("#taskBoardViewBtn")?.classList.toggle("active", state.taskView === "board");
  $("#taskCalendarViewBtn")?.classList.toggle("active", state.taskView === "calendar");
  if (state.taskView === "calendar") {
    $("#taskBoard").style.display = "none";
    $("#taskCalendar").style.display = "grid";
    renderTaskCalendar();
  } else {
    $("#taskBoard").style.display = "grid";
    $("#taskCalendar").style.display = "none";
    renderTaskBoard();
  }
}

function getFilteredTasks() {
  const query = ($("#taskSearch")?.value || "").trim().toLowerCase();
  return state.tasks.filter(task => {
    const text = `${task.article_title} ${task.platform_name} ${task.platform_account_name} ${task.article_tags}`.toLowerCase();
    return !query || text.includes(query);
  });
}

function renderTaskBoard() {
  const groups = ["todo", "published", "revise", "skipped"];
  const labels = { todo: "待发布", published: "已发布", revise: "需修改", skipped: "已跳过" };
  const tasks = getFilteredTasks();
  const hasResults = tasks.length > 0;
  $("#taskBoard").innerHTML = groups.map(status => {
    const groupTasks = tasks.filter(task => task.status === status);
    return `
    <div class="task-column">
      <h3>${labels[status]}</h3>
      ${groupTasks.map(task => taskRow(task)).join("") || `<p class="muted">${hasResults ? "空" : "没有匹配的任务"}</p>`}
    </div>`;
  }).join("");
}

function renderTaskCalendar() {
  const tasks = getFilteredTasks();
  const year = state.taskCalendarDate.getFullYear();
  const month = state.taskCalendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  const tasksByDay = {};
  tasks.forEach(task => {
    const dateStr = task.status === "published" ? task.published_at : task.created_at;
    if (!dateStr) return;
    const d = new Date(dateStr.replace(/-/g, "/"));
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(task);
  });

  const header = `
    <div class="calendar-header">
      <button class="ghost" data-calendar="prev">‹ 上月</button>
      <h3>${year}年 ${month + 1}月</h3>
      <button class="ghost" data-calendar="next">下月 ›</button>
    </div>
  `;
  const grid = [`<div class="calendar-grid">${weekdays.map(d => `<div class="calendar-weekday">${d}</div>`).join("")}`];
  for (let i = 0; i < startPadding; i++) {
    grid.push(`<div class="calendar-day empty"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && today.getDate() === day;
    const key = `${year}-${month}-${day}`;
    const dayTasks = tasksByDay[key] || [];
    grid.push(`
      <div class="calendar-day ${isToday ? "today" : ""}">
        <div class="calendar-day-number">${day}${isToday ? " · 今天" : ""}</div>
        ${dayTasks.slice(0, 4).map(task => `
          <div class="calendar-task ${task.status}" data-id="${task.id}" title="${escapeHtml(task.platform_name)}" role="button" tabindex="0">
            ${escapeHtml(task.article_title)}
          </div>
        `).join("")}
        ${dayTasks.length > 4 ? `<div class="calendar-task" style="background:transparent;border-color:transparent;color:var(--text-muted)">+${dayTasks.length - 4}</div>` : ""}
      </div>
    `);
  }
  grid.push("</div>");
  $("#taskCalendar").innerHTML = header + grid.join("");
}

function taskRow(task) {
  const metaParts = [escapeHtml(task.platform_name), escapeHtml(task.platform_category), task.platform_account_name ? `账号：${escapeHtml(task.platform_account_name)}` : ""].filter(Boolean);
  return `
    <article class="task-row">
      <h3>${escapeHtml(task.article_title)}</h3>
      ${metaParts.length ? `<p class="muted">${metaParts.join(" · ")}</p>` : ""}
      ${task.platform_login_notes ? `<p class="hint compact-hint">${escapeHtml(task.platform_login_notes)}</p>` : ""}
      ${task.article_risk_notes ? `<p class="muted">风险：${escapeHtml(task.article_risk_notes)}</p>` : ""}
      <div class="task-compact">
        <input id="publishedUrl-${task.id}" placeholder="粘贴已发布链接，然后点「已发布」" value="${escapeHtml(task.published_url || "")}" />
        <button class="ghost task-open" data-url="${escapeHtml(task.platform_url)}">打开</button>
        <div class="copy-group">
          <button class="ghost task-copy-toggle">复制 ▾</button>
          <div class="copy-menu">
            <button class="ghost task-copy" data-id="${task.id}" data-kind="title">复制标题</button>
            <button class="ghost task-copy" data-id="${task.id}" data-kind="body">复制正文</button>
            <button class="ghost task-copy" data-id="${task.id}" data-kind="all">复制整包</button>
          </div>
        </div>
        <button class="solid task-status" data-id="${task.id}" data-status="published">已发布</button>
        <button class="ghost task-status" data-id="${task.id}" data-status="revise">需修改</button>
        <button class="ghost task-status" data-id="${task.id}" data-status="skipped">跳过</button>
        <button class="ghost danger task-delete" data-id="${task.id}">删除</button>
      </div>
    </article>
  `;
}

function taskCopyText(task, kind) {
  if (kind === "title") return task.article_title || "";
  if (kind === "body") return task.article_body || "";
  if (kind === "tags") return task.article_tags || "";
  return [
    `标题：${task.article_title || ""}`,
    "",
    task.article_summary ? `摘要：${task.article_summary}` : "",
    "",
    task.article_body || "",
    "",
    task.article_tags ? `标签：${task.article_tags}` : "",
    task.article_keywords ? `关键词：${task.article_keywords}` : "",
    task.article_image_prompt ? `配图建议：${task.article_image_prompt}` : "",
  ].filter(Boolean).join("\n");
}

// --- Image Result ---

function renderGeneratedImage(result, baseUrl = "") {
  const data = result?.data?.[0] || result?.images?.[0] || result;
  const url = data?.url || data?.image_url || data?.b64_json;
  if (!url) {
    $("#imageResult").innerHTML = `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
    return;
  }
  let src;
  const raw = String(url);
  if (raw.startsWith("http") || raw.startsWith("data:")) {
    src = raw;
  } else if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 100) {
    // 纯 base64 字符串
    src = `data:image/png;base64,${raw}`;
  } else if (baseUrl) {
    // 相对路径：拼接 image base_url 兜底
    src = baseUrl.replace(/\/+$/, "") + "/" + raw.replace(/^\/+/, "");
  } else {
    src = raw;
  }
  $("#imageResult").innerHTML = `
    <figure>
      <img src="${escapeHtml(src)}" alt="AI 生成配图" />
      <figcaption>
        <button class="ghost" id="copyImageUrlBtn" type="button">复制图片地址</button>
        <a class="ghost link-button" href="${escapeHtml(src)}" target="_blank" rel="noreferrer">打开图片</a>
      </figcaption>
    </figure>
  `;
  $("#copyImageUrlBtn").addEventListener("click", async () => {
    await copyToClipboard(src);
    toast("图片地址已复制", "success");
  });
}

// --- Article Draft Auto-save ---

const ARTICLE_DRAFT_KEY = "geo_article_draft";

function getArticleDraft() {
  try {
    const raw = localStorage.getItem(ARTICLE_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setArticleDraftStatus(text, type = "") {
  const el = $("#articleDraftStatus");
  if (!el) return;
  el.textContent = text;
  el.className = `draft-status show ${type}`;
  if (!text) el.classList.remove("show");
}

function collectArticleForm() {
  return {
    id: $("#articleId")?.value || "",
    product_id: $("#articleProduct")?.value || "0",
    geo_question_id: $("#articleGeoQuestion")?.value || "0",
    title: $("#articleTitle")?.value || "",
    summary: $("#articleSummary")?.value || "",
    body: $("#articleBody")?.value || "",
    content_type: $("#articleType")?.value || "",
    target_platform: $("#articlePlatform")?.value || "",
    keywords: $("#articleKeywords")?.value || "",
    tags: $("#articleTags")?.value || "",
    image_prompt: $("#articleImage")?.value || "",
    risk_notes: $("#articleRisk")?.value || "",
    status: $("#articleStatus")?.value || "draft",
    saved_at: Date.now(),
  };
}

function saveArticleDraft() {
  const draft = collectArticleForm();
  const hasContent = draft.title.trim() || draft.body.trim() || draft.summary.trim();
  if (!hasContent) return;
  localStorage.setItem(ARTICLE_DRAFT_KEY, JSON.stringify(draft));
  setArticleDraftStatus("已自动保存", "saved");
  setTimeout(() => setArticleDraftStatus("", ""), 2000);
}

function loadArticleDraft() {
  const draft = getArticleDraft();
  if (!draft) return false;
  // Only restore if editor is empty and no article selected
  const hasContent = $("#articleTitle")?.value.trim() || $("#articleBody")?.value.trim();
  if (hasContent || state.selectedArticleId) return false;
  $("#articleId").value = draft.id || "";
  $("#articleProduct").value = draft.product_id || "0";
  $("#articleGeoQuestion").value = draft.geo_question_id || "0";
  $("#articleTitle").value = draft.title || "";
  $("#articleSummary").value = draft.summary || "";
  $("#articleBody").value = draft.body || "";
  $("#articleType").value = draft.content_type || "";
  $("#articlePlatform").value = draft.target_platform || "";
  $("#articleKeywords").value = draft.keywords || "";
  $("#articleTags").value = draft.tags || "";
  $("#articleImage").value = draft.image_prompt || "";
  $("#articleRisk").value = draft.risk_notes || "";
  $("#articleStatus").value = draft.status || "draft";
  setArticleEditorMode(Boolean(draft.id));
  renderPreview();
  updateWordCount();
  setArticleDraftStatus(`已恢复 ${new Date(draft.saved_at).toLocaleString()} 的草稿`, "unsaved");
  return true;
}

function clearArticleDraft() {
  localStorage.removeItem(ARTICLE_DRAFT_KEY);
  setArticleDraftStatus("", "");
}

function validateArticle(payload) {
  const errors = [];
  const title = (payload.title || "").trim();
  const body = (payload.body || "").trim();
  const productId = Number(payload.product_id || 0);
  const targetPlatform = (payload.target_platform || "").trim();

  if (!title) errors.push("文章标题不能为空");
  if (title.length > 500) errors.push("文章标题不能超过 500 字");
  if (body.length < 50) errors.push("正文内容过少，建议至少 50 字");
  if (!productId) errors.push("请选择关联产品");
  if (!targetPlatform) errors.push("请选择目标发布平台");

  const product = state.products.find(p => p.id === productId);
  if (product && product.forbidden_words) {
    const forbidden = product.forbidden_words.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    const found = forbidden.filter(word => title.includes(word) || body.includes(word));
    if (found.length) errors.push(`包含产品禁用词：${found.join(", ")}`);
  }

  return errors;
}
