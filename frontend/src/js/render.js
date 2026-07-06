/* GEO Studio - Render functions for all views */

// ===== 列值颜色映射（Tailwind 100 系列 17 色调色板） =====
// 同一列中相同值用同一颜色，不同值用不同颜色
const TAILWIND_100_PALETTE = [
  "bg-red-100", "bg-orange-100", "bg-amber-100", "bg-yellow-100",
  "bg-lime-100", "bg-green-100", "bg-emerald-100", "bg-teal-100",
  "bg-cyan-100", "bg-sky-100", "bg-blue-100", "bg-indigo-100",
  "bg-violet-100", "bg-purple-100", "bg-fuchsia-100", "bg-pink-100",
  "bg-rose-100"
];
const TAILWIND_700_TEXT = [
  "text-red-700", "text-orange-700", "text-amber-700", "text-yellow-700",
  "text-lime-700", "text-green-700", "text-emerald-700", "text-teal-700",
  "text-cyan-700", "text-sky-700", "text-blue-700", "text-indigo-700",
  "text-violet-700", "text-purple-700", "text-fuchsia-700", "text-pink-700",
  "text-rose-700"
];
// 列 -> 值 -> 颜色索引 的缓存（保证同列同色）
const _columnColorCache = {};
function getColumnColorClass(columnName, value) {
  if (!value) return "";
  if (!_columnColorCache[columnName]) _columnColorCache[columnName] = {};
  const cache = _columnColorCache[columnName];
  if (!(value in cache)) {
    // 简单 hash -> 索引
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    cache[value] = Math.abs(h) % TAILWIND_100_PALETTE.length;
  }
  const idx = cache[value];
  return `${TAILWIND_100_PALETTE[idx]} ${TAILWIND_700_TEXT[idx]}`;
}

function render() {
  if (!isLoggedIn()) { renderAuthView(); return; }
  renderStats();
  renderCoverage();
  renderProducts();
  renderGeoQuestions();
  renderArticles();
  renderPlatforms();
  renderTasks();
  renderWorkshop();
  renderSettings();
  if (typeof checkAchievements === "function") checkAchievements();
  if (typeof renderAchievements === "function") renderAchievements();
}

function showView(viewId) {
  $$(".nav").forEach(x => x.classList.toggle("active", x.dataset.view === viewId));
  $$(".view").forEach(x => x.classList.toggle("active", x.id === viewId));
  const nav = $(`.nav[data-view="${viewId}"]`);
  if (nav) $("#viewTitle").textContent = nav.dataset.title || nav.textContent;
  // Close mobile sidebar after navigation
  $(".sidebar")?.classList.remove("open");
  $("#sidebarOverlay")?.classList.remove("show");
  // Restore article draft when entering workshop view with empty editor
  if (viewId === "workshop") {
    setTimeout(loadArticleDraft, 50);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  // 自动选中第一项：若未选中且列表非空，且非路由恢复过程
  // selectXxx 内部会调用 syncRoute(view, id)，故此处跳过默认 syncRoute
  if (!_routingGuard && autoPickFirstItem(viewId)) return;
  syncRoute(viewId);
}

// 切换视图时若列表非空且未选中项，默认打开第一个详情
function autoPickFirstItem(viewId) {
  if (viewId === "products" && !selectedProductId && state.products.length) {
    selectProduct(state.products[0].id);
    return true;
  }
  if (viewId === "platforms" && !state.selectedPlatformId && state.platforms.length) {
    selectPlatform(state.platforms[0].id);
    return true;
  }
  if (viewId === "workshop" && !state.selectedArticleId && state.articles.length) {
    selectArticle(state.articles[0].id);
    return true;
  }
  return false;
}

// ===== Hash 路由 =====
// 格式：#view  /  #view/itemId  /  #view/itemId/subTab
let _routingGuard = false;

function syncRoute(view, itemId, subTab) {
  if (_routingGuard) return;
  const parts = [view];
  if (itemId) parts.push(itemId);
  if (subTab) parts.push(subTab);
  const hash = "#" + parts.join("/");
  if (location.hash !== hash) location.hash = hash;
}

function parseRoute() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return { view: "", itemId: "", subTab: "" };
  const [view, itemId, subTab] = raw.split("/");
  return { view, itemId: itemId || "", subTab: subTab || "" };
}

function handleRouteChange() {
  const { view, itemId, subTab } = parseRoute();
  if (!view) return;
  _routingGuard = true;
  try {
    showView(view);
    if (view === "products" && itemId) {
      if (state.products.find(p => p.id === itemId)) {
        selectProduct(itemId);
        // 扁平化后无 Tab，subTab=geo 时滚动到 GEO 区域
        if (subTab === "geo") {
          setTimeout(() => {
            const geoSection = document.querySelector(".pd-geo-section");
            if (geoSection) geoSection.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 200);
        }
      }
    } else if (view === "platforms" && itemId) {
      if (state.platforms.find(p => p.id === itemId)) selectPlatform(itemId);
    } else if (view === "workshop" && itemId) {
      // 选中对应文章
      if (state.articles.find(a => a.id === itemId)) selectArticle(itemId);
    }
  } finally {
    _routingGuard = false;
  }
}

function initRouter() {
  window.addEventListener("hashchange", handleRouteChange);
  // 首次加载若已有 hash，尝试恢复
  if (location.hash) {
    // 等数据加载后再恢复
    setTimeout(() => {
      if (state.products.length || state.platforms.length || state.articles.length) {
        handleRouteChange();
      }
    }, 100);
  }
}

// --- Dashboard ---

function renderStats() {
  const published = state.tasks.filter(t => t.status === "published").length;
  const drafts = state.articles.filter(a => a.status === "draft").length;
  const review = state.articles.filter(a => a.status === "review").length;
  const todoTasks = state.tasks.filter(t => t.status === "todo").length;
  const reviseTasks = state.tasks.filter(t => t.status === "revise").length;
  const highGaps = (state.coverage?.summary?.high_priority_gaps) || 0;

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

  // 北极星指标：GEO 引用率（有产品时显示）
  const citeHeaderEl = $("#citationHeader");
  if (citeHeaderEl) {
    if (state.products.length && state.geo_questions.length) {
      const cs = citationStatsOverall();
      citeHeaderEl.style.display = "";
      const level = cs.rate >= 60 ? "good" : cs.rate >= 30 ? "medium" : "low";
      citeHeaderEl.className = `panel citation-header ${cs.checked ? level : "none"}`;
      citeHeaderEl.innerHTML = cs.checked ? `
        <div class="citation-headline">
          <div class="citation-rate">${cs.rate}<span class="citation-pct">%</span></div>
          <div class="citation-desc">
            <strong>GEO 引用率</strong>
            <p class="muted small">${cs.cited}/${cs.checked} 个已检测问题中，AI 引用了你的产品 · 共 ${cs.total} 个问题</p>
          </div>
        </div>
        <div class="citation-actions">
          <button class="btn ghost sm" type="button" data-action="goto-products-detect">去检测更多</button>
        </div>
      ` : `
        <div class="citation-headline">
          <div class="citation-rate none">—<span class="citation-pct"></span></div>
          <div class="citation-desc">
            <strong>还没测量过 AI 是否引用你</strong>
            <p class="muted small">你写了 ${state.articles.length} 篇内容、覆盖 ${state.coverage?.summary?.covered_q || 0}/${state.coverage?.summary?.total_q || 0} 个问题——但 AI 到底引用了没？去产品页点「检测引用」闭环验证。</p>
          </div>
        </div>
        <div class="citation-actions">
          <button class="btn primary sm" type="button" data-action="goto-products-detect">开始检测</button>
        </div>
      `;
    } else {
      citeHeaderEl.style.display = "none";
      citeHeaderEl.innerHTML = "";
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
      <div class="list-row question-link" data-id="${q.id}" role="button" tabindex="0">
        <strong>${escapeHtml(q.question)}</strong>
        ${parts.length ? `<div class="muted">${parts.join(" · ")}</div>` : ""}
      </div>`;
    }).join("") || emptyStateWithAction("还没有高优先级问题", "Q", `<button class="ghost" data-action="jump" data-target="products" type="button">去产品档案</button>`);
  $$(".question-link").forEach(row => row.addEventListener("click", () => {
    const q = state.geo_questions.find(x => x.id === row.dataset.id);
    if (q) {
      showView("products");
      selectProduct(q.product_id);
      // 滚动到 GEO 问题区域
      setTimeout(() => {
        const geoSection = document.querySelector(".pd-geo-section");
        if (geoSection) geoSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }));

  $("#recentArticles").innerHTML = state.articles.slice(0, 6).map(article => {
    const parts = [escapeHtml(article.target_platform), escapeHtml(article.content_type)].filter(Boolean);
    const quality = typeof calcContentQuality === "function" ? calcContentQuality(article.body, article.title) : null;
    return `
    <div class="list-row article-link" data-id="${article.id}" role="button" tabindex="0">
      <div style="display:flex;align-items:center;gap:8px">
        <strong style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(article.title)}</strong>
        ${quality && quality.score > 0 ? `<span class="quality-score ${quality.level}" style="font-size:10px;padding:2px 6px">${quality.score}</span>` : ""}
      </div>
      ${parts.length ? `<div class="muted">${parts.join(" · ")}</div>` : ""}
    </div>`;
  }).join("") || emptyStateWithAction("还没有文章", "📝", `<button class="ghost" data-action="jump" data-target="workshop" type="button">去内容工坊</button>`);
  $$(".article-link").forEach(row => row.addEventListener("click", () => {
    showView("workshop");
    selectArticle(row.dataset.id);
  }));

  // 待办列表：整合待发布+需修改+草稿+高优先级缺口
  const todoItems = [];
  if (highGaps > 0) {
    todoItems.push({ icon: "🔥", text: `${highGaps} 个高优先级内容缺口待创作`, action: "coverage" });
  }
  if (drafts > 0) {
    todoItems.push({ icon: "📝", text: `${drafts} 篇草稿待完善`, action: "drafts" });
  }
  if (todoTasks > 0) {
    todoItems.push({ icon: "📋", text: `${todoTasks} 个任务待发布`, action: "tasks" });
  }
  if (reviseTasks > 0) {
    todoItems.push({ icon: "✏️", text: `${reviseTasks} 篇内容需修改`, action: "revise" });
  }
  if (review > 0) {
    todoItems.push({ icon: "👀", text: `${review} 篇内容待审核`, action: "review" });
  }

  const getTodoAction = (action) => {
    switch(action) {
      case "coverage": return "showView(\"products\")";
      case "drafts":
      case "review":
        return "showView(\"workshop\")";
      case "tasks":
      case "revise":
        return "showView(\"tasks\")";
      default: return "";
    }
  };

  $("#todoTasks").innerHTML = todoItems.length
    ? todoItems.slice(0, 6).map((item, i) => `
      <div class="list-row todo-action-item" data-action="${item.action}" style="cursor:pointer" role="button" tabindex="0">
        <span style="margin-right:8px">${item.icon}</span>
        <strong>${item.text}</strong>
      </div>`).join("")
    : state.products.length
      ? `<div class="empty-state"><div class="empty-state-icon">🎉</div><p class="empty-state-title">太棒了！暂无待办事项</p></div>`
      : emptyStateWithAction("暂无待发布任务", "📋", `<button class="ghost" data-action="jump" data-target="tasks" type="button">去发布记录</button>`);

  $$(".todo-action-item").forEach(row => row.addEventListener("click", () => {
    const action = row.dataset.action;
    switch(action) {
      case "coverage": showView("products"); break;
      case "drafts":
      case "review":
        showView("workshop"); break;
      case "tasks":
      case "revise":
        showView("tasks"); break;
    }
  }));

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
  }).join("") || emptyStateWithAction("还没有产品", "📦", `<button class="ghost" data-action="jump" data-target="products" type="button">去产品档案</button>`);

  // 高优先级缺口列表（取所有产品 gaps 中 priority=high 的前 6 条）
  const gaps = cov.by_product.flatMap(p => p.gaps.map(g => ({ ...g, product_name: p.product_name })))
    .filter(g => g.priority === "high")
    .slice(0, 6);
  $("#coverageGaps").innerHTML = gaps.length
    ? `<h3 style="margin-top:14px">高优先级内容缺口（建议优先创作）</h3>` +
      gaps.map(g => `
        <div class="list-row gap-link" data-id="${g.id}" role="button" tabindex="0">
          <strong>${escapeHtml(g.question)}</strong>
          <div class="muted">${escapeHtml(g.product_name)} · ${escapeHtml(g.priority)}</div>
        </div>
      `).join("")
    : "";
  $$(".gap-link").forEach(row => row.addEventListener("click", () => {
    const qId = row.dataset.id;
    const q = state.geo_questions.find(x => x.id === qId);
    if (!q) return;
    showView("products");
    selectProduct(q.product_id);
    // 高亮对应的问题卡片
    setTimeout(() => {
      const card = $(`.geo-question-card[data-id="${qId}"]`);
      if (card) {
        card.classList.add("highlight");
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => card.classList.remove("highlight"), 3000);
      }
    }, 300);
  }));
}

// --- Products ---

// 当前选中的产品ID
let selectedProductId = null;

function renderProducts() {
  const query = ($("#productSearch")?.value || "").trim().toLowerCase();
  const list = state.products.filter(p => {
    const text = `${p.name} ${p.type} ${p.url} ${p.audience} ${p.selling_points} ${p.tone} ${p.goal}`.toLowerCase();
    return !query || text.includes(query);
  });

  // 渲染左侧产品列表
  const listItemHtml = (product) => {
    const initial = (product.name || "?").trim().charAt(0).toUpperCase();
    const statusLabel = product.status === "active" ? "运营中" : (product.status === "draft" ? "草稿" : (product.status === "paused" ? "暂停" : "归档"));
    const isActive = selectedProductId === product.id;
    return `
    <div class="product-list-item ${isActive ? "active" : ""}" data-id="${product.id}" role="button" tabindex="0">
      <div class="product-list-avatar">${escapeHtml(initial)}</div>
      <div class="product-list-info">
        <div class="product-list-name">${escapeHtml(product.name)}</div>
        <div class="product-list-meta">${escapeHtml(product.type || "未分类")} · ${statusLabel}</div>
      </div>
    </div>`;
  };

  const listHtml = !list.length
    ? (state.products.length
      ? `<div class="search-empty">没有找到匹配的产品</div>`
      : `<div class="empty-state"><p class="empty-state-title">还没有产品档案</p></div>`)
    : list.map(listItemHtml).join("");

  const listEl = $("#productList");
  if (listEl) listEl.innerHTML = listHtml;

  // 更新计数
  const cnt = $("#productListCount");
  if (cnt) cnt.textContent = `${state.products.length} 个产品`;

  // 绑定点击事件
  if (listEl) {
    listEl.querySelectorAll(".product-list-item").forEach(el => {
      el.addEventListener("click", () => {
        selectProduct(el.dataset.id);
      });
    });
  }
}

function renderProductDetail(product) {
  if (!product) return;

  // 更新标题
  const nameEl = $("#productDetailName");
  if (nameEl) nameEl.textContent = product.name || "未命名产品";

  // 更新状态标签
  const statusEl = $("#productDetailStatus");
  if (statusEl) {
    const statusLabel = product.status === "active" ? "运营中" : (product.status === "draft" ? "草稿" : (product.status === "paused" ? "暂停" : "归档"));
    statusEl.textContent = statusLabel;
    statusEl.className = `product-status ${product.status || "active"}`;
  }

  // 更新查看模式的字段
  const setViewText = (id, value) => {
    const el = $(`#${id}`);
    if (el) el.textContent = value || "-";
  };
  setViewText("productViewType", product.type);
  setViewText("productViewUrl", product.url);
  setViewText("productViewAudience", product.audience);
  setViewText("productViewSellingPoints", product.selling_points);
  setViewText("productViewCompetitors", product.competitors);
  setViewText("productViewTone", product.tone);
  setViewText("productViewGoal", product.goal);
  setViewText("productViewForbiddenWords", product.forbidden_words);

  // 更新统计
  const qCount = state.geo_questions.filter(q => String(q.product_id) === String(product.id)).length;
  const aCount = state.articles.filter(a => String(a.product_id) === String(product.id)).length;
  const cov = (state.coverage?.by_product || []).find(p => String(p.product_id) === String(product.id));
  const covered = cov?.covered_q || 0;
  const total = cov?.total_q || 0;
  const coveragePct = total ? Math.round((covered / total) * 100) : 0;

  const setStat = (id, value) => {
    const el = $(`#${id}`);
    if (el) el.textContent = value;
  };
  setStat("productStatQuestions", qCount);
  setStat("productStatArticles", aCount);
  // 同步 GEO Tab 角标
  setStat("productGeoCount", qCount);
  setStat("productStatCoverage", `${coveragePct}%`);
  // GEO 引用率（已检测问题中被 AI 引用的比例）
  const cite = citationStatsForProduct(product.id);
  const citeEl = $("#productStatCitation");
  if (citeEl) {
    citeEl.textContent = cite.checked ? `${cite.rate}%` : "—";
    citeEl.title = cite.checked ? `${cite.cited}/${cite.checked} 个已检测问题中，AI 引用了本产品` : "尚未检测";
  }

  // 显示详情面板，隐藏空状态
  const emptyState = $("#productEmptyState");
  const detailPanel = $("#productDetailPanel");
  if (emptyState) emptyState.style.display = "none";
  if (detailPanel) detailPanel.style.display = "flex";

  // 默认显示查看模式
  showProductViewMode();
}

function showProductViewMode() {
  const viewMode = $("#productViewMode");
  const editMode = $("#productEditMode");
  if (viewMode) viewMode.style.display = "";
  if (editMode) editMode.style.display = "none";
}

function showProductEditMode(product) {
  if (!product) return;
  // 隐藏空状态，显示详情面板
  const emptyState = $("#productEmptyState");
  const detailPanel = $("#productDetailPanel");
  if (emptyState) emptyState.style.display = "none";
  if (detailPanel) detailPanel.style.display = "flex";
  // 切换到编辑模式
  const viewMode = $("#productViewMode");
  const editMode = $("#productEditMode");
  if (viewMode) viewMode.style.display = "none";
  if (editMode) editMode.style.display = "";
  // 标题显示
  const nameEl = $("#productDetailName");
  if (nameEl) nameEl.textContent = product.id ? product.name || "未命名产品" : "新建产品";
  const statusEl = $("#productDetailStatus");
  if (statusEl) statusEl.style.display = product.id ? "" : "none";

  // 填充表单
  const form = $("#productForm");
  if (form) {
    form.elements.id.value = product.id || "";
    form.elements.name.value = product.name || "";
    form.elements.type.value = product.type || "";
    form.elements.url.value = product.url || "";
    form.elements.audience.value = product.audience || "";
    form.elements.selling_points.value = product.selling_points || "";
    form.elements.competitors.value = product.competitors || "";
    form.elements.tone.value = product.tone || "";
    form.elements.goal.value = product.goal || "";
    form.elements.forbidden_words.value = product.forbidden_words || "";
  }
}

function selectProduct(id) {
  selectedProductId = id;
  const product = state.products.find(item => item.id === id);
  if (!product) return;

  // 同步隐藏字段 #pdId，供 GEO 问题相关逻辑使用
  const pdIdEl = $("#pdId");
  if (pdIdEl) pdIdEl.value = id;

  // 更新左侧列表的选中状态
  document.querySelectorAll(".product-list-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  // 渲染右侧详情
  renderProductDetail(product);
  // 同步渲染 GEO 问题列表（扁平化已并入档案页）
  renderGeoQuestions();
  // 滚动列表项到可见区域
  const activeItem = document.querySelector(`.product-list-item.active`);
  if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
  // 路由同步
  syncRoute("products", id);
}

// 扁平化后不再有 Tab 切换，保留空函数避免外部调用报错
function showProductTab(_tabName) {
  // no-op: GEO 问题已与档案同页
}

function resetProductForm() {
  selectedProductId = null;
  const emptyState = $("#productEmptyState");
  const detailPanel = $("#productDetailPanel");
  if (emptyState) emptyState.style.display = "";
  if (detailPanel) detailPanel.style.display = "none";
  // 清空表单
  const form = $("#productForm");
  if (form) form.reset();
}

function renderProductImages(productId) {
  const images = (state.product_images || []).filter(img => String(img.product_id) === String(productId));
  $("#pdImageGallery").innerHTML = images.map(img => {
    const pbUrl = (window.__GEO_CONFIG__ && window.__GEO_CONFIG__.pbUrl) || "";
    const imageUrl = `${pbUrl}/api/files/product_images/${img.id}/${img.image}`;
    return `
    <div class="product-image-card">
      <div class="product-image-preview" style="background-image:url('${escapeHtml(imageUrl)}')"></div>
      <p class="muted">${escapeHtml(img.description || "")}</p>
    </div>`;
  }).join("");
  if ($("#pdImagesEmpty")) {
    $("#pdImagesEmpty").style.display = images.length ? "none" : "";
  }
}

function applyProductSuggestion(rawItem) {
  const item = normalizeProductSuggestion(rawItem);
  const form = $("#productForm");
  for (const [key, value] of Object.entries(item)) {
    if (form.elements[key] && value !== undefined) {
      form.elements[key].value = value;
    }
  }
}

// --- GEO Questions ---

// ===== GEO 排名检测（citation）辅助 =====
// 取某 (产品,问题) 最近一次检测记录（created_at 最新）
function latestCheckFor(productId, questionId) {
  const checks = (state.geo_rank_checks || []).filter(c =>
    String(c.product_id) === String(productId) && String(c.geo_question_id) === String(questionId));
  if (!checks.length) return null;
  return checks.reduce((a, b) => ((a.created_at || "") >= (b.created_at || "") ? a : b));
}
// 某产品的引用率：在「已检测过的问题」里被引用的比例
function citationStatsForProduct(productId) {
  const qs = state.geo_questions.filter(q => String(q.product_id) === String(productId));
  let checked = 0, cited = 0;
  for (const q of qs) {
    const chk = latestCheckFor(productId, q.id);
    if (chk) { checked++; if (chk.cited) cited++; }
  }
  return { total: qs.length, checked, cited, rate: checked ? Math.round((cited / checked) * 100) : 0, unchecked: qs.length - checked };
}
// 全局引用率（按问题去重：任一产品被引用即算该问题「可被引用」）
function citationStatsOverall() {
  let checked = 0, cited = 0;
  for (const q of state.geo_questions) {
    let qChecked = false, qCited = false;
    for (const p of state.products) {
      const chk = latestCheckFor(p.id, q.id);
      if (chk) { qChecked = true; if (chk.cited) qCited = true; }
    }
    if (qChecked) { checked++; if (qCited) cited++; }
  }
  return { total: state.geo_questions.length, checked, cited, rate: checked ? Math.round((cited / checked) * 100) : 0 };
}

function renderGeoQuestions() {
  // 按当前选中产品过滤（GEO 问题已合并到产品详情的 GEO Tab）
  const currentProductId = selectedProductId || ($("#pdId")?.value) || "";
  if (!currentProductId) {
    $("#geoQuestionList").innerHTML = "";
    const cntEl = $("#productGeoCount");
    if (cntEl) cntEl.textContent = "0";
    return;
  }

  // 同步隐藏字段 geoProduct
  const gpEl = $("#geoProduct");
  if (gpEl) gpEl.value = currentProductId;

  const query = ($("#geoSearch")?.value || "").trim().toLowerCase();
  const list = state.geo_questions.filter(item => {
    if (String(item.product_id) !== currentProductId) return false;
    const text = `${item.question} ${item.intent} ${item.audience} ${item.content_angle} ${item.target_platform}`.toLowerCase();
    return !query || text.includes(query);
  });

  // 更新 Tab 角标
  const totalCount = state.geo_questions.filter(q => String(q.product_id) === currentProductId).length;
  const cntEl = $("#productGeoCount");
  if (cntEl) cntEl.textContent = String(totalCount);

  // 预建覆盖率查表，避免逐卡 O(n·m) find
  const covMap = new Map((state.coverage?.by_question || []).map(c => [String(c.geo_question_id), c]));
  $("#geoQuestionList").innerHTML = list.map(item => {
    const cov = covMap.get(String(item.id));
    const articles = cov?.articles || 0;
    const published = cov?.published || 0;
    const coverTag = articles > 0
      ? `<span class="tag covered">已覆盖 ${articles} 篇${published ? ` · 已发布 ${published}` : ""}</span>`
      : `<span class="tag uncovered">未覆盖</span>`;
    // GEO 排名检测徽章
    const chk = latestCheckFor(item.product_id, item.id);
    const rankTag = chk
      ? (chk.cited
          ? `<span class="tag rank-cited" title="${escapeHtml(chk.snippet || "AI 在回答中提到了本产品")}">✓ 已引用${chk.rank ? ` · 第${chk.rank}位` : ""}</span>`
          : `<span class="tag rank-miss">✗ 未引用</span>`)
      : `<span class="tag rank-none">未检测</span>`;
    const metaParts = [escapeHtml(item.intent), escapeHtml(item.audience)].filter(Boolean);
    return `
    <article class="card geo-question-card ${item.status}" data-id="${item.id}" role="button" tabindex="0">
      <div class="geo-card-header">
        <h3 class="geo-card-question">${escapeHtml(item.question)}</h3>
        <span class="status ${escapeHtml(item.priority)}">${escapeHtml(item.priority)}</span>
      </div>
      ${metaParts.length ? `<p class="muted small geo-card-meta">${metaParts.join(" · ")}</p>` : ""}
      ${item.content_angle ? `<p class="geo-card-angle">${escapeHtml(item.content_angle)}</p>` : ""}
      <div class="tagline">
        <span class="tag">${escapeHtml(item.status)}</span>
        ${item.target_platform ? `<span class="tag">${escapeHtml(item.target_platform)}</span>` : ""}
        ${coverTag}
        ${rankTag}
      </div>
      <div class="button-row mini-actions">
        <button class="ghost sm edit-geo-question" data-id="${item.id}" type="button">编辑</button>
        <button class="ghost sm ai-geo-question" data-id="${item.id}" title="AI 优化问题与内容角度" type="button">✨ AI 优化</button>
        <button class="ghost sm rank-check" data-id="${item.id}" data-product="${item.product_id}" title="让 AI 回答该问题并检测是否引用本产品" type="button">🔍 检测引用</button>
        <button class="ghost sm cover-geo-question" data-id="${item.id}" type="button">标记已覆盖</button>
        <button class="ghost sm danger delete-geo-question" data-id="${item.id}" type="button">删除</button>
      </div>
    </article>
  `;
  }).join("") || (totalCount ? `<div class="search-empty">没有找到匹配的问题</div>` : emptyStateWithAction("还没有 GEO 问题", "Q", `<button class="ghost" data-action="toggle-geo-form" type="button">新增第一个问题</button>`));

  // 卡片整体点击 = 编辑；但点按钮/操作行时不触发（让 document 委托处理按钮动作）
  $$(".geo-question-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, .mini-actions, .tagline")) return;
      selectGeoQuestion(card.dataset.id);
    });
  });
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
  $("#geoQuestionForm").style.display = "";
  $("#geoQuestionText")?.focus();
}

function resetGeoQuestionForm() {
  const currentProductId = selectedProductId || ($("#pdId")?.value) || "";
  $("#geoQuestionForm").reset();
  $("#geoQuestionId").value = "";
  $("#geoProduct").value = currentProductId; // 保持当前产品
  $("#geoPriority").value = "medium";
  $("#geoStatus").value = "active";
  $("#geoQuestionFormTitle").textContent = "新增 GEO 问题";
}

// --- Workshop ---

function renderWorkshop() {
  const wsProductEl = $("#workshopProduct");
  if (!wsProductEl) return;
  const curVal = wsProductEl.value;
  wsProductEl.innerHTML = `<option value="">请选择产品…</option>` + state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  if (curVal && Array.from(wsProductEl.options).some(o => o.value === curVal)) {
    wsProductEl.value = curVal;
  }

  // 填充导入文章的产品选择
  const importProductEl = $("#importArticleProduct");
  if (importProductEl) {
    const curImportVal = importProductEl.value;
    importProductEl.innerHTML = `<option value="">请选择产品…</option>` + state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    if (curImportVal && Array.from(importProductEl.options).some(o => o.value === curImportVal)) {
      importProductEl.value = curImportVal;
    }
  }

  // 填充导入文章的 GEO 问题选择
  const importGeoEl = $("#importArticleGeoQuestion");
  if (importGeoEl) {
    const curGeoVal = importGeoEl.value;
    const importProductId = importProductEl?.value || "";
    const qs = state.geo_questions.filter(q => !importProductId || String(q.product_id) === importProductId);
    importGeoEl.innerHTML = `<option value="">未关联</option>` +
      qs.map(q => `<option value="${q.id}">${escapeHtml(q.question)}</option>`).join("");
    if (curGeoVal && Array.from(importGeoEl.options).some(o => o.value === curGeoVal)) {
      importGeoEl.value = curGeoVal;
    }
  }

  const enabled = state.platforms.filter(p => p.status === "enabled").slice(0, 40);
  const groups = {};
  enabled.forEach(p => {
    const cat = p.category || "其他";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  });
  const wsPlatformsEl = $("#workshopPlatforms");
  if (wsPlatformsEl) {
    wsPlatformsEl.innerHTML = Object.entries(groups).map(([cat, platforms]) => `
      <div class="workshop-platform-group">
        <p class="workshop-platform-group-title">${escapeHtml(cat)}</p>
        <div class="workshop-platform-row">
          ${platforms.map(p => `<label title="${escapeHtml(p.notes || "")}"><input type="checkbox" value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</label>`).join("")}
        </div>
      </div>
    `).join("");
  }
}

// --- AI Settings ---

function renderAiSettings() {
  const ai = state.ai_settings || {};
  // 系统预设 + 用户自定义模型
  const presets = aiPresets.map((p, i) => ({ ...p, index: i, type: "system" }));
  const customs = (state.user_models || []).map(m => ({ ...m, type: "custom" }));
  const allOptions = [
    { label: "--- 系统预设 ---", value: "", disabled: true },
    ...presets.map(p => ({ label: p.name, value: String(p.index) })),
    { label: "--- 我的模型 ---", value: "", disabled: true },
    ...customs.map(m => ({ label: "⭐ " + m.name, value: "custom_" + m.id })),
  ];
  const curVal = $("#aiPreset").value;
  $("#aiPreset").innerHTML = allOptions.map(o =>
    `<option value="${escapeHtml(o.value)}"${o.disabled ? " disabled" : ""}>${escapeHtml(o.label)}</option>`
  ).join("");
  if (curVal && Array.from($("#aiPreset").options).some(o => o.value === curVal)) {
    $("#aiPreset").value = curVal;
  }
  $("#aiMode").value = ai.mode || "manual";
  $("#textBaseUrl").value = ai.text_base_url || ai.base_url || DEFAULT_AI_SETTINGS.text_base_url;
  $("#textModel").value = ai.text_model || ai.model || DEFAULT_AI_SETTINGS.text_model;
  $("#imageBaseUrl").value = ai.image_base_url || DEFAULT_AI_SETTINGS.image_base_url;
  $("#imageModel").value = ai.image_model || DEFAULT_AI_SETTINGS.image_model;
  $("#aiTemperature").value = ai.temperature || 0.7;
  $("#textKeyStatus").textContent = ai.has_text_api_key ? "✓ 文本模型 Key 已保存" : "未保存 Key";
  $("#imageKeyStatus").textContent = ai.has_image_api_key ? "✓ 图片模型 Key 已保存" : "未保存 Key";

  // 更新顶栏模型标签
  updateCurrentModelLabel();
}

// 更新顶栏当前模型显示
function updateCurrentModelLabel() {
  const el = $("#currentModelLabel");
  if (!el) return;
  const ai = state.ai_settings || {};
  const model = ai.text_model || ai.model;
  const mode = ai.mode || "manual";
  if (mode === "api" && model) {
    el.textContent = "🤖 " + model;
    el.className = "current-model";
    el.title = "当前模型: " + model + " | 点击进入 AI 设置";
  } else {
    el.textContent = "⚙ 未配置模型";
    el.className = "current-model unconfigured";
    el.title = "点击配置 AI 模型";
  }
}

function renderUserModels() {
  const models = state.user_models || [];
  $("#userModelsList").innerHTML = models.length
    ? models.map(m => `
      <div class="user-model-card">
        <div>
          <strong>${escapeHtml(m.name)}</strong>
          <span class="muted">${escapeHtml(m.provider || "")}</span>
        </div>
        <div class="muted small">${escapeHtml(m.text_model || "")}${m.image_model ? " + " + escapeHtml(m.image_model) : ""}</div>
        <div class="button-row mini-actions">
          <button class="ghost use-user-model" data-id="${m.id}" type="button">使用</button>
          <button class="ghost edit-user-model" data-id="${m.id}" type="button">编辑</button>
          <button class="ghost danger delete-user-model" data-id="${m.id}" type="button">删除</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty-state"><p class="empty-state-title">还没有自定义模型，点击上方添加</p></div>`;
}

function renderSystemPresets() {
  $("#systemPresetsList").innerHTML = aiPresets.map(p => `
    <div class="user-model-card system-preset">
      <div>
        <strong>${escapeHtml(p.name)}</strong>
        <span class="tag">${escapeHtml(p.provider)}</span>
      </div>
      <div class="muted small">文本：${escapeHtml(p.text_model)}${p.image_model ? " · 图片：" + escapeHtml(p.image_model) : ""}</div>
    </div>
  `).join("");
}

function renderSettings() {
  renderAiSettings();
  renderUserModels();
  renderSystemPresets();
}

// --- Articles ---

// 给 select 设置值；若期望 id 在新 options 中不存在（关联产品/问题已被删），
// 动态插入"（已失效）"占位 option 并选中，给用户可见反馈。
// value 留空：提交时 collectArticleForm 会把 "" 规整为 "0"（未关联），避免脏 id 回写。
function setSelectValueWithFallback(el, expectedId, fallbackLabel = "（已失效）") {
  if (!el) return;
  const expected = expectedId == null ? "" : String(expectedId);
  // "0" / "" 表示未关联，已有对应占位 option，直接置值即可
  if (expected === "" || expected === "0") {
    el.value = expected;
    return;
  }
  if (Array.from(el.options).some(o => o.value === expected)) {
    el.value = expected;
    return;
  }
  // 关联实体已失效：插入占位 option 并选中
  const opt = document.createElement("option");
  opt.value = "";
  opt.textContent = fallbackLabel;
  opt.selected = true;
  el.appendChild(opt);
  el.value = "";
}

function renderArticles() {
  // Render product selector in article editor（保留当前选中值）
  const productOpts = state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  const apEl = $("#articleProduct");
  if (apEl) {
    const curProduct = apEl.value;
    apEl.innerHTML = `<option value="0">未关联</option>` + productOpts;
    // 恢复选中值：如果有已选文章，用其 product_id；否则保留当前值
    if (state.selectedArticleId) {
      const article = state.articles.find(a => a.id === state.selectedArticleId);
      if (article) setSelectValueWithFallback(apEl, article.product_id || 0);
    } else {
      setSelectValueWithFallback(apEl, curProduct || "0");
    }
  }

  // Render GEO question selector（按当前所选产品过滤，保留当前选中值）
  const agEl = $("#articleGeoQuestion");
  if (agEl) {
    const curQ = agEl.value;
    const productId = apEl?.value || "";
    const qs = state.geo_questions.filter(q => !productId || q.product_id === productId);
    agEl.innerHTML = `<option value="0">未关联（不影响覆盖率统计）</option>` +
      qs.map(q => `<option value="${q.id}">${escapeHtml(q.question)}</option>`).join("");
    if (state.selectedArticleId) {
      const article = state.articles.find(a => a.id === state.selectedArticleId);
      if (article) setSelectValueWithFallback(agEl, article.geo_question_id || 0);
    } else if (curQ) {
      setSelectValueWithFallback(agEl, curQ);
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

  // 预建 GEO 问题查表，避免逐篇 O(n·m) find
  const qMap = new Map(state.geo_questions.map(q => [String(q.id), q]));
  $("#articleList").innerHTML = filtered.map(article => {
    const geoQ = qMap.get(String(article.geo_question_id));
    const parts = [escapeHtml(article.target_platform), escapeHtml(article.content_type), geoQ ? escapeHtml(geoQ.question) : ""].filter(Boolean);
    const quality = typeof calcContentQuality === "function" ? calcContentQuality(article.body, article.title) : { score: 0, label: "", level: "low" };
    return `
    <article class="article-row ${article.id === state.selectedArticleId ? "active" : ""}" data-id="${article.id}">
      <div class="article-row-head">
        <h4>${escapeHtml(article.title)}</h4>
        ${quality.score > 0 ? `<span class="quality-score ${quality.level}" title="内容质量评分">${quality.score}分 · ${quality.label}</span>` : ""}
      </div>
      ${parts.length ? `<p class="muted">${parts.join(" · ")}</p>` : ""}
      <div class="tagline">
        <span class="tag">${escapeHtml(article.status)}</span>
        ${(article.tags || "").split(",").filter(Boolean).slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag.trim())}</span>`).join("")}
      </div>
    </article>`;
  }).join("") || (state.articles.length ? `<div class="search-empty">没有找到匹配的文章</div>` : emptyStateWithAction("文章库为空", "📝", `<button class="ghost" data-action="jump" data-target="workshop" type="button">去内容工坊</button>`));

  const tapEl = $("#taskArticlePicker");
  if (tapEl) {
    tapEl.innerHTML = state.articles.map(article => `
      <label><input type="checkbox" value="${article.id}">${escapeHtml(article.title)}</label>
    `).join("");
  }

  // 更新内容列表计数
  const tabCount = $("#workshopGeneratedCount");
  if (tabCount) tabCount.textContent = String(state.articles.length);
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
  // 路由同步
  syncRoute("workshop", id);
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

// 当前选中的平台ID（与 state.selectedPlatformId 保持同步，本地用于渲染高亮）

function renderPlatforms() {
  const query = ($("#platformSearch")?.value || "").trim().toLowerCase();
  const list = state.platforms.filter(p => {
    const text = `${p.name} ${p.category} ${p.content_style} ${p.notes} ${p.account_name} ${p.login_notes}`.toLowerCase();
    return !query || text.includes(query);
  });

  // 左侧列表项
  const listItemHtml = (platform) => {
    const initial = (platform.name || "?").trim().charAt(0).toUpperCase();
    const isEnabled = platform.status === "enabled";
    const statusLabel = isEnabled ? "启用" : (platform.status === "watch" ? "观察" : "暂停");
    const isActive = state.selectedPlatformId === platform.id;
    return `
    <div class="platform-list-item ${isActive ? "active" : ""}" data-id="${platform.id}" role="button" tabindex="0">
      <div class="platform-list-avatar ${isEnabled ? "" : "off"}">${escapeHtml(initial)}</div>
      <div class="platform-list-info">
        <div class="platform-list-name">${escapeHtml(platform.name)}</div>
        <div class="platform-list-meta">${escapeHtml(platform.category || "未分类")} · ${statusLabel}</div>
      </div>
    </div>`;
  };

  const listHtml = !list.length
    ? (state.platforms.length
      ? `<div class="search-empty">没有找到匹配的平台</div>`
      : `<div class="empty-state"><p class="empty-state-title">还没有平台档案</p></div>`)
    : list.map(listItemHtml).join("");

  const listEl = $("#platformList");
  if (listEl) listEl.innerHTML = listHtml;

  // 更新计数
  const cnt = $("#platformListCount");
  if (cnt) cnt.textContent = `${state.platforms.length} 个平台`;

  // 绑定点击事件
  if (listEl) {
    listEl.querySelectorAll(".platform-list-item").forEach(el => {
      el.addEventListener("click", () => {
        selectPlatform(el.dataset.id);
      });
    });
  }

  // 同步发布任务页面的平台选择器
  const enabled = state.platforms.filter(p => p.status === "enabled");
  const tppEl = $("#taskPlatformPicker");
  if (tppEl) {
    tppEl.innerHTML = enabled.map(platform => `
      <label><input type="checkbox" value="${platform.id}">${escapeHtml(platform.name)}${platform.account_name ? ` / ${escapeHtml(platform.account_name)}` : ""}</label>
    `).join("");
  }
}

// 渲染右侧平台详情
function renderPlatformDetail(platform) {
  if (!platform) return;

  // 标题
  const nameEl = $("#platformDetailName");
  if (nameEl) nameEl.textContent = platform.name || "未命名平台";

  // 状态标签
  const statusEl = $("#platformDetailStatus");
  if (statusEl) {
    const statusMap = { enabled: "启用", watch: "观察", paused: "暂停" };
    statusEl.textContent = statusMap[platform.status] || "启用";
    statusEl.className = `platform-status ${platform.status || "enabled"}`;
  }

  // 切换按钮文案
  const toggleBtn = $("#platformDetailToggle");
  if (toggleBtn) {
    toggleBtn.textContent = platform.status === "enabled" ? "观察" : "启用";
    toggleBtn.dataset.id = platform.id;
    toggleBtn.dataset.status = platform.status === "enabled" ? "watch" : "enabled";
  }

  // 打开按钮
  const openBtn = $("#platformDetailOpen");
  if (openBtn) {
    openBtn.dataset.url = platform.url || "";
  }

  // 删除按钮
  const delBtn = $("#platformDetailDelete");
  if (delBtn) delBtn.dataset.id = platform.id;

  // 查看模式字段
  const linkMap = { allowed: "可外链", limited: "限外链", forbidden: "禁外链" };
  const fitMap = { high: "高适配", medium: "中适配", low: "低适配" };
  const setViewText = (id, value) => {
    const el = $(`#${id}`);
    if (el) el.textContent = value || "-";
  };
  setViewText("platformViewCategory", platform.category);
  setViewText("platformViewUrl", platform.url);
  setViewText("platformViewAccountName", platform.account_name);
  setViewText("platformViewContentStyle", platform.content_style);
  setViewText("platformViewWords", platform.recommended_words);
  setViewText("platformViewFrequency", platform.frequency);
  setViewText("platformViewTitleStyle", platform.title_style);
  setViewText("platformViewTagsRule", platform.tags_rule);
  setViewText("platformViewLinks", linkMap[platform.allows_external_links]);
  setViewText("platformViewFit", fitMap[platform.soft_article_fit]);
  setViewText("platformViewLoginNotes", platform.login_notes);
  setViewText("platformViewNotes", platform.notes);

  // 统计
  const tasks = state.tasks.filter(t => String(t.platform_id) === String(platform.id));
  const published = tasks.filter(t => t.status === "published").length;
  const todo = tasks.filter(t => t.status === "todo").length;
  const setStat = (id, value) => {
    const el = $(`#${id}`);
    if (el) el.textContent = value;
  };
  setStat("platformStatTasks", tasks.length);
  setStat("platformStatPublished", published);
  setStat("platformStatTodo", todo);

  // 显示详情面板，隐藏空状态
  const emptyState = $("#platformEmptyState");
  const detailPanel = $("#platformDetailPanel");
  if (emptyState) emptyState.style.display = "none";
  if (detailPanel) detailPanel.style.display = "flex";

  // 默认显示查看模式
  showPlatformViewMode();
}

function showPlatformViewMode() {
  const viewMode = $("#platformViewMode");
  const editMode = $("#platformEditMode");
  if (viewMode) viewMode.style.display = "";
  if (editMode) editMode.style.display = "none";
}

function showPlatformEditMode(platform) {
  if (!platform) return;
  // 隐藏空状态，显示详情面板
  const emptyState = $("#platformEmptyState");
  const detailPanel = $("#platformDetailPanel");
  if (emptyState) emptyState.style.display = "none";
  if (detailPanel) detailPanel.style.display = "flex";
  // 切换到编辑模式
  const viewMode = $("#platformViewMode");
  const editMode = $("#platformEditMode");
  if (viewMode) viewMode.style.display = "none";
  if (editMode) editMode.style.display = "";
  // 标题显示
  const nameEl = $("#platformDetailName");
  if (nameEl) nameEl.textContent = platform.id ? platform.name || "未命名平台" : "新建平台";
  const statusEl = $("#platformDetailStatus");
  if (statusEl) statusEl.style.display = platform.id ? "" : "none";

  // 填充表单
  $("#platformId").value = platform.id || "";
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
}

function selectPlatform(id) {
  state.selectedPlatformId = id;
  const platform = state.platforms.find(item => item.id === id);
  if (!platform) return;
  // 更新左侧列表的选中状态
  document.querySelectorAll(".platform-list-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });
  // 渲染右侧详情
  renderPlatformDetail(platform);
  // 滚动列表项到可见区域
  const activeItem = document.querySelector(`.platform-list-item.active`);
  if (activeItem) activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
  // 路由同步
  syncRoute("platforms", id);
}

function resetPlatformForm() {
  state.selectedPlatformId = null;
  const emptyState = $("#platformEmptyState");
  const detailPanel = $("#platformDetailPanel");
  if (emptyState) emptyState.style.display = "";
  if (detailPanel) detailPanel.style.display = "none";
  // 清空表单
  const form = $("#platformForm");
  if (form) form.reset();
  $("#platformId").value = "";
  $("#platformLinks").value = "limited";
  $("#platformFit").value = "medium";
  $("#platformStatus").value = "enabled";
}

// --- Tasks ---

function renderTasks() {
  renderTaskStats();
  renderTaskForm();
  renderTaskStatFilters();
  renderTaskBoardStats();
  renderTaskBoard();
  renderTaskCalendar();
}

// 渲染新建发布记录表单的下拉选项
function renderTaskForm() {
  // 产品
  const pEl = $("#taskFormProduct");
  if (pEl) {
    const cur = pEl.value;
    pEl.innerHTML = `<option value="">请选择产品…</option>` +
      state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    pEl.value = cur;
  }
  // 内容（按产品过滤）
  const aEl = $("#taskFormArticle");
  if (aEl) {
    const curA = aEl.value;
    const pid = pEl?.value || "";
    const arts = pid ? state.articles.filter(a => String(a.product_id) === pid) : state.articles;
    aEl.innerHTML = `<option value="">请选择内容…</option>` +
      arts.map(a => `<option value="${a.id}">${escapeHtml(a.title || "未命名")}</option>`).join("");
    aEl.value = curA;
  }
  // 平台
  const plEl = $("#taskFormPlatform");
  if (plEl) {
    const curP = plEl.value;
    plEl.innerHTML = `<option value="">请选择平台…</option>` +
      state.platforms.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    plEl.value = curP;
  }
}

function renderTaskStatFilters() {
  const pEl = $("#taskStatProduct");
  if (pEl) {
    const cur = pEl.value;
    pEl.innerHTML = `<option value="">全部产品</option>` +
      state.products.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    pEl.value = cur;
  }
  const plEl = $("#taskStatPlatform");
  if (plEl) {
    const cur = plEl.value;
    plEl.innerHTML = `<option value="">全部平台</option>` +
      state.platforms.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    plEl.value = cur;
  }
}

// 看板视图：分产品 / 分平台 统计卡片
function renderTaskBoardStats() {
  const selectedProduct = $("#taskStatProduct")?.value || "";
  const selectedPlatform = $("#taskStatPlatform")?.value || "";

  const byProductEl = $("#taskStatByProduct");
  if (byProductEl) {
    const products = selectedProduct
      ? state.products.filter(p => String(p.id) === selectedProduct)
      : state.products;
    byProductEl.innerHTML = products.map(product => {
      const tasks = state.tasks.filter(t =>
        String(t.product_id) === String(product.id) &&
        (!selectedPlatform || String(t.platform_id) === selectedPlatform)
      );
      return taskStatCard(product.name, tasks);
    }).join("") || `<p class="muted">暂无产品</p>`;
  }

  const byPlatformEl = $("#taskStatByPlatform");
  if (byPlatformEl) {
    const platforms = selectedPlatform
      ? state.platforms.filter(p => String(p.id) === selectedPlatform)
      : state.platforms;
    byPlatformEl.innerHTML = platforms.map(platform => {
      const tasks = state.tasks.filter(t =>
        String(t.platform_id) === String(platform.id) &&
        (!selectedProduct || String(t.product_id) === selectedProduct)
      );
      return taskStatCard(platform.name, tasks);
    }).join("") || `<p class="muted">暂无平台</p>`;
  }
}

function taskStatCard(name, tasks) {
  const total = tasks.length;
  const published = tasks.filter(t => t.status === "published").length;
  const todo = tasks.filter(t => t.status === "todo").length;
  const rate = total ? Math.round((published / total) * 100) : 0;
  return `
    <div class="task-stat-mini">
      <div class="task-stat-mini-name">${escapeHtml(name)}</div>
      <div class="task-stat-mini-num">${total}</div>
      <div class="task-stat-mini-meta">已发布 ${published} · 待发布 ${todo} · ${rate}%</div>
    </div>
  `;
}

// 发布统计卡片：状态分布 + 平台覆盖
function renderTaskStats() {
  const bar = $("#taskStatsBar");
  if (!bar) return;
  const tasks = state.tasks || [];
  const total = tasks.length;
  const byStatus = {
    published: tasks.filter(t => t.status === "published").length,
    todo: tasks.filter(t => t.status === "todo").length,
    revise: tasks.filter(t => t.status === "revise").length,
    skipped: tasks.filter(t => t.status === "skipped").length,
  };
  const publishedRate = total ? Math.round((byStatus.published / total) * 100) : 0;
  // 平台覆盖：统计有多少个平台已有发布记录
  const platformsWithPublish = new Set(
    tasks.filter(t => t.status === "published" && t.platform_id).map(t => t.platform_id)
  );
  const totalPlatforms = state.platforms.filter(p => p.status === "enabled").length;
  const platformCov = totalPlatforms ? Math.round((platformsWithPublish.size / totalPlatforms) * 100) : 0;

  const cards = [
    { label: "发布任务", value: total, hint: "总记录数", tone: "neutral" },
    { label: "已发布", value: byStatus.published, hint: `占比 ${publishedRate}%`, tone: "good" },
    { label: "待发布", value: byStatus.todo, hint: byStatus.revise ? `需修改 ${byStatus.revise}` : "等待执行", tone: "warn" },
    { label: "平台覆盖", value: `${platformsWithPublish.size}/${totalPlatforms}`, hint: `覆盖率 ${platformCov}%`, tone: "accent" },
  ];
  bar.innerHTML = cards.map(c => `
    <div class="task-stat-card tone-${c.tone}">
      <div class="task-stat-value">${c.value}</div>
      <div class="task-stat-label">${escapeHtml(c.label)}</div>
      <div class="task-stat-hint">${escapeHtml(c.hint)}</div>
    </div>
  `).join("");
}

function getFilteredTasks(useStatFilters = false) {
  const query = ($("#taskSearch")?.value || "").trim().toLowerCase();
  const productId = useStatFilters ? ($("#taskStatProduct")?.value || "") : "";
  const platformId = useStatFilters ? ($("#taskStatPlatform")?.value || "") : "";
  return state.tasks.filter(task => {
    const text = [task.article_title, task.platform_name, task.platform_account_name, task.article_tags]
      .filter(Boolean).join(" ").toLowerCase();
    if (query && !text.includes(query)) return false;
    if (productId && String(task.product_id || "") !== String(productId)) return false;
    if (platformId && String(task.platform_id || "") !== String(platformId)) return false;
    return true;
  });
}

function renderTaskBoard() {
  // 用户正在看板内交互（如往 publishedUrl- 输入粘贴链接）时，跳过本次重建，
  // 避免清空正在输入的内容；下一次无焦点的 load 会正常刷新
  const board = $("#taskBoard");
  if (!board) return;
  if (board.contains(document.activeElement)) return;
  const groups = ["todo", "published", "revise", "skipped"];
  const labels = { todo: "待发布", published: "已发布", revise: "需修改", skipped: "已跳过" };
  const tasks = getFilteredTasks(true);
  const hasResults = tasks.length > 0;
  board.innerHTML = groups.map(status => {
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
      <button class="ghost" data-calendar="prev" type="button">‹ 上月</button>
      <h3>${year}年 ${month + 1}月</h3>
      <button class="ghost" data-calendar="next" type="button">下月 ›</button>
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
  const isPublished = task.status === "published" && task.published_url;
  // 发布最佳时间建议（仅待发布状态显示）
  let bestTimeHint = "";
  if (task.status === "todo" && task.platform_name) {
    const bestTime = typeof getPlatformBestPublishTime === "function" ? getPlatformBestPublishTime(task.platform_name) : null;
    if (bestTime) {
      bestTimeHint = `<p class="hint compact-hint best-time">⏰ 最佳发布：${escapeHtml(bestTime.weekday)} ${escapeHtml(bestTime.time)} · ${escapeHtml(bestTime.note)}</p>`;
    }
  }
  return `
    <article class="task-row ${isPublished ? 'published' : ''}">
      <h3>${escapeHtml(task.article_title)}</h3>
      ${metaParts.length ? `<p class="muted">${metaParts.join(" · ")}</p>` : ""}
      ${task.platform_login_notes ? `<p class="hint compact-hint">${escapeHtml(task.platform_login_notes)}</p>` : ""}
      ${bestTimeHint}
      ${task.article_risk_notes ? `<p class="muted">风险：${escapeHtml(task.article_risk_notes)}</p>` : ""}
      <div class="task-compact">
        <input id="publishedUrl-${task.id}" placeholder="粘贴已发布链接，然后点「已发布」" value="${escapeHtml(task.published_url || "")}" />
        <button class="ghost task-open" data-url="${escapeHtml(task.platform_url)}" type="button">打开</button>
        <div class="copy-group">
          <button class="ghost task-copy-toggle" type="button">复制 ▾</button>
          <div class="copy-menu">
            <button class="ghost task-copy" data-id="${task.id}" data-kind="title" type="button">复制标题</button>
            <button class="ghost task-copy" data-id="${task.id}" data-kind="body" type="button">复制正文</button>
            <button class="ghost task-copy" data-id="${task.id}" data-kind="all" type="button">复制整包</button>
            ${isPublished ? `<button class="ghost task-copy share" data-id="${task.id}" data-kind="share" type="button">📤 分享链接</button>` : ""}
          </div>
        </div>
        ${isPublished ? `<button class="ghost task-share-card" data-id="${task.id}" title="生成分享卡片" type="button">✨ 分享</button>` : ""}
        <button class="${isPublished ? 'ghost' : 'solid'} task-status" data-id="${task.id}" data-status="published" type="button">已发布</button>
        <button class="ghost task-status" data-id="${task.id}" data-status="revise" type="button">需修改</button>
        <button class="ghost task-status" data-id="${task.id}" data-status="skipped" type="button">跳过</button>
        <button class="ghost danger task-delete" data-id="${task.id}" type="button">删除</button>
      </div>
    </article>
  `;
}

function taskCopyText(task, kind) {
  if (kind === "title") return task.article_title || "";
  if (kind === "body") return task.article_body || "";
  if (kind === "tags") return task.article_tags || "";
  if (kind === "share") {
    const userName = typeof getCurrentUserName === "function" ? getCurrentUserName() : "";
    const parts = [];
    parts.push(`📝 ${task.article_title || ""}`);
    if (userName) parts.push(`✍️ ${userName}`);
    if (task.published_url) parts.push(`🔗 ${task.published_url}`);
    parts.push("\n—— 来自 GEO Studio");
    return parts.join("\n");
  }
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

// 校验 URL 是否为安全的 http(s) 协议（用 URL 解析，避免 javascript: / JaVaScRiPt: 等大小写绕过）
function isSafeHttpUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// 校验 data: URL 是否为安全的位图图片（明确排除 svg / svg+xml，避免点击导航后执行内嵌脚本）
function isSafeDataImageUrl(raw) {
  return /^data:image\/(png|jpeg|jpg|gif|webp|avif)([;,])/i.test(raw);
}

function renderGeneratedImage(result, baseUrl = "") {
  const data = result?.data?.[0] || result?.images?.[0] || result;
  const url = data?.url || data?.image_url || data?.b64_json;
  if (!url) {
    $("#imageResult").innerHTML = `<pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
    return;
  }
  const raw = String(url);
  let src = "";
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 100) {
    // 纯 base64 字符串：包成 PNG data URL（img 不执行脚本，安全）
    src = `data:image/png;base64,${raw}`;
  } else if (isSafeHttpUrl(raw)) {
    src = raw;
  } else if (isSafeDataImageUrl(raw)) {
    // 安全的位图 data URL：仅用于 <img>，不渲染可点击的 a 链接
    src = raw;
  } else if (baseUrl && isSafeHttpUrl(baseUrl)) {
    // 相对路径：拼接 baseUrl 后再次校验协议
    const abs = baseUrl.replace(/\/+$/, "") + "/" + raw.replace(/^\/+/, "");
    if (isSafeHttpUrl(abs)) src = abs;
  }

  if (!src) {
    $("#imageResult").innerHTML = `<pre>无效的图片 URL</pre>`;
    return;
  }

  // <a href> 仅在 src 为 http(s) 时渲染；data: 图片只渲染 <img>（img 不执行脚本）
  const isHttp = isSafeHttpUrl(src);
  const linkHtml = isHttp
    ? `<a class="ghost link-button" href="${escapeHtml(src)}" target="_blank" rel="noreferrer">打开图片</a>`
    : "";
  $("#imageResult").innerHTML = `
    <figure>
      <img src="${escapeHtml(src)}" alt="AI 生成配图" />
      <figcaption>
        <button class="ghost" id="copyImageUrlBtn" type="button">复制图片地址</button>
        ${linkHtml}
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
  const productId = payload.product_id || "";
  const targetPlatform = (payload.target_platform || "").trim();
  const status = payload.status || "draft";
  const isDraft = status === "draft";

  if (!title) errors.push("文章标题不能为空");
  if (title.length > 500) errors.push("文章标题不能超过 500 字");
  // 草稿可更宽松：允许空正文；非草稿必须满足完整度
  if (!isDraft) {
    if (body.length < 50) errors.push("正文内容过少，建议至少 50 字");
    if (!productId || productId === "0") errors.push("请选择关联产品");
    if (!targetPlatform) errors.push("请选择目标发布平台");
  }

  const product = state.products.find(p => p.id === productId);
  if (product && product.forbidden_words) {
    const forbidden = product.forbidden_words.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    const found = forbidden.filter(word => title.includes(word) || body.includes(word));
    if (found.length) errors.push(`包含产品禁用词：${found.join(", ")}`);
  }

  return errors;
}
