/* GEO Studio - Enhancements: Theme, Global AI, Shortcuts, Quick Actions */

// ===== 暗色模式 =====
function initTheme() {
  const saved = localStorage.getItem("geo_theme");
  if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.body.classList.add("dark");
    updateThemeIcon(true);
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem("geo_theme", isDark ? "dark" : "light");
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const btn = $("#themeToggle");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
}

// ===== 全局AI助手 =====
let globalAiHistory = [];

function toggleGlobalAi() {
  const panel = $("#globalAiPanel");
  panel.classList.toggle("open");
  if (panel.classList.contains("open")) {
    if (!globalAiHistory.length) {
      addGlobalAiMsg("assistant", "你好！我是全局AI助手，可以帮你：\n• 分析内容质量\n• 生成写作灵感\n• 优化产品描述\n• 回答使用问题\n\n有什么可以帮你的？");
    }
    setTimeout(() => $("#globalAiInput")?.focus(), 300);
  }
}

function addGlobalAiMsg(role, content) {
  const container = $("#globalAiMessages");
  if (!container) return;
  const msg = document.createElement("div");
  msg.className = `global-ai-msg ${role}`;
  msg.innerHTML = markdownToHtml(content).replace(/\n/g, "<br>");
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
  globalAiHistory.push({ role, content });
}

async function sendGlobalAi() {
  const input = $("#globalAiInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addGlobalAiMsg("user", text);

  const ai = state.ai_settings || {};
  const mode = ai.mode || "manual";
  if (mode !== "api") {
    addGlobalAiMsg("assistant", "请先在「AI 设置」中配置 API 直连模式，我才能回答你的问题哦～");
    return;
  }

  try {
    const systemPrompt = `你是 GEO Studio 的AI助手。GEO Studio是一个生成式引擎优化（GEO）内容工作台，帮助用户管理产品档案、挖掘GEO问题、生成内容、跟踪发布。
请用简洁、专业的语气回答用户问题。如果是关于产品内容优化、GEO策略、写作建议等问题，请给出具体可操作的建议。`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...globalAiHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
    ];
    const response = await callAI(ai, messages);
    addGlobalAiMsg("assistant", response);
  } catch (e) {
    addGlobalAiMsg("assistant", "抱歉，AI调用失败：" + e.message);
  }
}

// ===== 快速创建FAB =====
function toggleFab() {
  $("#quickCreateFab")?.classList.toggle("open");
}

function closeFab() {
  $("#quickCreateFab")?.classList.remove("open");
}

function handleFabAction(action) {
  closeFab();
  switch (action) {
    case "add-product":
      showView("products");
      showProductEditMode({ id: "", name: "", type: "", url: "", audience: "", selling_points: "", competitors: "", tone: "真实、专业、克制", goal: "", forbidden_words: "" });
      break;
    case "add-article":
      showView("workshop");
      // 展开 AI 生成折叠区
      const genDetail = document.querySelector(".workshop-generate");
      if (genDetail) genDetail.open = true;
      break;
    case "add-task":
      showView("tasks");
      switchSubTab("task-publish");
      break;
  }
}

// ===== 快捷操作按钮 =====
function handleQuickAction(action) {
  switch (action) {
    case "add-product":
      showView("products");
      showProductEditMode({ id: "", name: "", type: "", url: "", audience: "", selling_points: "", competitors: "", tone: "真实、专业、克制", goal: "", forbidden_words: "" });
      break;
    case "generate-content":
      showView("workshop");
      const genDetail2 = document.querySelector(".workshop-generate");
      if (genDetail2) genDetail2.open = true;
      break;
    case "add-platform":
      showView("platforms");
      showPlatformEditMode({ id: "", name: "", category: "", url: "", account_name: "", login_notes: "", content_style: "", recommended_words: "", frequency: "", title_style: "", tags_rule: "", allows_external_links: "limited", soft_article_fit: "medium", status: "enabled", notes: "" });
      break;
    case "add-task":
      showView("tasks");
      switchSubTab("task-publish");
      break;
  }
}

// ===== 日期显示 =====
function updateHeroDate() {
  const el = $("#heroDate");
  if (!el) return;
  const now = new Date();
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  el.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]}`;
}

// ===== 内容质量评分 =====
function calcContentQuality(body, title) {
  if (!body && !title) return { score: 0, label: "空", level: "low" };
  let score = 0;
  const text = (body || "").trim();
  const len = text.length;

  if (len >= 300) score += 25;
  else if (len >= 100) score += 15;
  else if (len > 0) score += 5;

  if (text.includes("#") || text.includes("##")) score += 15;
  if (text.includes("- ") || text.includes("* ")) score += 10;
  if (/\d+/.test(text)) score += 10;
  if (title && title.length >= 5) score += 15;
  if (len >= 800) score += 15;
  if (text.includes("**") || text.includes("__")) score += 10;

  score = Math.min(score, 100);
  const level = score >= 70 ? "good" : score >= 40 ? "medium" : "low";
  const label = score >= 70 ? "优质" : score >= 40 ? "一般" : "待完善";
  return { score, label, level };
}

// ===== 全局加载状态 =====
function showGlobalLoader() {
  $("#globalLoader").style.display = "flex";
}

function hideGlobalLoader() {
  $("#globalLoader").style.display = "none";
}

// ===== 增强版 Toast 通知 =====
function showToast(message, type = "info", duration = 3000) {
  const typeMap = { default: "info", success: "success", error: "error", warning: "warning", info: "info", celebrate: "celebrate" };
  const finalType = typeMap[type] || "info";

  let container = $("#toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "💡", celebrate: "🎉" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${finalType}`;
  toast.innerHTML = `<span class="toast-icon">${icons[finalType] || "💡"}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== 成就系统 =====
const ACHIEVEMENTS = [
  { id: "first_product", icon: "📦", name: "初次建档", desc: "创建第一个产品", check: () => (state.products || []).length >= 1 },
  { id: "first_article", icon: "✍️", name: "处女作", desc: "生成第一篇内容", check: () => (state.articles || []).length >= 1 },
  { id: "first_publish", icon: "🚀", name: "首发成功", desc: "完成第一次发布", check: () => (state.tasks || []).filter(t => t.status === "published").length >= 1 },
  { id: "five_published", icon: "⭐", name: "五步成章", desc: "发布5篇内容", check: () => (state.tasks || []).filter(t => t.status === "published").length >= 5 },
  { id: "ten_published", icon: "🏆", name: "十全十美", desc: "发布10篇内容", check: () => (state.tasks || []).filter(t => t.status === "published").length >= 10 },
  { id: "three_products", icon: "🎯", name: "多线作战", desc: "管理3个产品", check: () => (state.products || []).length >= 3 },
  { id: "coverage_50", icon: "📊", name: "半壁江山", desc: "GEO覆盖率达到50%", check: () => {
    const cov = (state.coverage && state.coverage.by_product) || [];
    return cov.some(c => (c.rate || 0) >= 50);
  }},
  { id: "coverage_100", icon: "👑", name: "大满贯", desc: "单个产品GEO覆盖率100%", check: () => {
    const cov = (state.coverage && state.coverage.by_product) || [];
    return cov.some(c => (c.rate || 0) >= 100);
  }},
];

const unlockedAchievements = new Set(JSON.parse(localStorage.getItem("geo_achievements") || "[]"));

function checkAchievements() {
  for (const ach of ACHIEVEMENTS) {
    if (!unlockedAchievements.has(ach.id) && ach.check()) {
      unlockedAchievements.add(ach.id);
      localStorage.setItem("geo_achievements", JSON.stringify([...unlockedAchievements]));
      showAchievementPopup(ach);
    }
  }
}

function showAchievementPopup(ach) {
  const popup = document.createElement("div");
  popup.className = "achievement-popup";
  popup.innerHTML = `
    <div class="achievement-content">
      <div class="achievement-icon">${ach.icon}</div>
      <div class="achievement-info">
        <div class="achievement-title">🎉 解锁成就！</div>
        <div class="achievement-name">${ach.name}</div>
        <div class="achievement-desc">${ach.desc}</div>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add("show"));
  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => popup.remove(), 500);
  }, 4000);
}

// ===== 分享卡片模态框 =====
function showShareCard(taskId) {
  const task = (state.tasks || []).find(t => t.id === taskId);
  if (!task || !task.published_url) return;

  const userName = typeof getCurrentUserName === "function" ? getCurrentUserName() : "GEO Studio 用户";
  const quality = calcContentQuality(task.article_body, task.article_title);

  const modal = document.createElement("div");
  modal.className = "share-card-modal-overlay";
  modal.id = "shareCardModal";
  modal.innerHTML = `
    <div class="share-card-modal-content share-card-modal">
      <div class="share-card-preview">
        <div class="share-card-header">
          <span class="share-card-badge">✨ GEO 内容分享</span>
        </div>
        <div class="share-card-body">
          <h3 class="share-card-title">${escapeHtml(task.article_title || "无标题")}</h3>
          <div class="share-card-meta">
            <span class="share-card-author">✍️ ${escapeHtml(userName)}</span>
            <span class="share-card-platform">📌 ${escapeHtml(task.platform_name || "")}</span>
          </div>
          <div class="share-card-quality">
            <span class="quality-score ${quality.level}">内容质量：${quality.label} ${quality.score}分</span>
          </div>
        </div>
        <div class="share-card-footer">
          <span class="share-card-url">🔗 ${escapeHtml(task.published_url)}</span>
        </div>
      </div>
      <div class="share-card-actions">
        <button class="btn primary" id="copyShareText">📋 复制分享文本</button>
        <button class="btn ghost" id="copyShareUrl">🔗 仅复制链接</button>
        <button class="btn ghost modal-close">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  requestAnimationFrame(() => modal.classList.add("open"));

  modal.querySelector("#copyShareText").addEventListener("click", async () => {
    const text = taskCopyText(task, "share");
    await copyToClipboard(text);
    showToast("分享文本已复制到剪贴板！", "success");
  });

  modal.querySelector("#copyShareUrl").addEventListener("click", async () => {
    await copyToClipboard(task.published_url);
    showToast("链接已复制！", "success");
  });

  modal.querySelector(".modal-close").addEventListener("click", () => closeShareCard());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeShareCard();
  });
}

function closeShareCard() {
  const modal = $("#shareCardModal");
  if (modal) {
    modal.classList.remove("open");
    setTimeout(() => modal.remove(), 300);
  }
}

// ===== 写作灵感 =====
const WRITING_TIPS = [
  "开头用用户最常问的问题直接回答，能提高被AI引用的概率～",
  "善用列表和编号，AI更喜欢结构清晰的内容！",
  "加入具体数据和案例，让你的内容更有说服力。",
  "每段聚焦一个知识点，避免冗长的大段文字。",
  "使用「是什么-为什么-怎么做」的结构，逻辑更清晰。",
  "在文章末尾总结要点，方便AI提取关键信息。",
  "引用权威来源能增加内容可信度哦！",
  "适当使用加粗突出关键词，但不要过度使用～",
  "回答问题时先给结论，再展开解释，符合用户阅读习惯。",
  "定期更新内容，保持信息的时效性和准确性。",
  "加入FAQ小节，覆盖更多相关搜索问题。",
  "用真实场景举例，让抽象概念更容易理解。",
];

function getRandomTip() {
  return WRITING_TIPS[Math.floor(Math.random() * WRITING_TIPS.length)];
}

function showDailyTip() {
  const lastShow = localStorage.getItem("geo_last_tip_date");
  const today = new Date().toDateString();
  if (lastShow === today) return;

  setTimeout(() => {
    localStorage.setItem("geo_last_tip_date", today);
    showToast(`💡 写作灵感：${getRandomTip()}`, "info", 6000);
  }, 2000);
}

// ===== 进度条动画 =====
function animateProgressBars() {
  $$(".progress-fill").forEach(bar => {
    const target = parseFloat(bar.dataset.progress) || 0;
    bar.style.width = "0%";
    requestAnimationFrame(() => {
      setTimeout(() => {
        bar.style.width = target + "%";
      }, 100);
    });
  });
}

// ===== 今日灵感卡片 =====
function renderDailyTip() {
  const box = $("#dailyTipBox");
  if (!box) return;
  const tip = getRandomTip();
  box.innerHTML = `<p class="daily-tip-text">💡 ${tip}</p>`;
}

// ===== 成就展示条 =====
function renderAchievements() {
  const strip = $("#achievementStrip");
  if (!strip) return;
  const unlocked = JSON.parse(localStorage.getItem("geo_achievements") || "[]");
  const total = ACHIEVEMENTS.length;
  const unlockedCount = unlocked.length;

  let html = `<div class="achievement-strip-header">
    <span class="muted" style="font-size:12px">🏆 成就进度</span>
    <span class="achievement-count">${unlockedCount}/${total}</span>
  </div>
  <div class="achievement-icons">`;

  ACHIEVEMENTS.forEach(ach => {
    const isUnlocked = unlocked.includes(ach.id);
    html += `<span class="achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}" title="${ach.name}：${ach.desc}">${ach.icon}</span>`;
  });

  html += `</div>`;
  strip.innerHTML = html;
}

// ===== 键盘快捷键 =====
function initShortcuts() {
  document.addEventListener("keydown", (e) => {
    const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // 在输入框/文本域内不触发全局快捷键（除 Ctrl+S 以外）
    const target = e.target;
    const isInput = !!(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
    const isFormInput = !!(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"));
    const isContentEditable = !!(target && target.isContentEditable);

    if (mod && e.key === "k" && !isInput) {
      e.preventDefault();
      $("#globalSearch")?.focus();
      $("#globalSearch")?.select();
    }

    if (mod && e.key === "n" && !isInput) {
      e.preventDefault();
      toggleFab();
    }

    if (mod && e.key === "/" && !isInput) {
      e.preventDefault();
      toggleGlobalAi();
    }

    if (mod && e.key === "d" && !isInput) {
      e.preventDefault();
      toggleTheme();
    }

    // Ctrl+S 快速保存（在 workshop / products 视图下，输入框内也生效）
    if (mod && e.key === "s" && !isContentEditable) {
      e.preventDefault();
      const activeView = $(".view.active");
      if (activeView?.id === "workshop") {
        $("#saveArticleBtn")?.click();
      } else if (activeView?.id === "products") {
        $("#saveProductBtn")?.click();
      } else {
        // 其他视图的输入框不拦截
        if (isFormInput) return;
      }
    }

    // Ctrl+L 刷新数据（避免与浏览器 Ctrl+R 冲突）
    if (mod && e.key === "l" && !isInput) {
      e.preventDefault();
      if (typeof load === "function") load();
    }

    if (e.key === "Escape") {
      const aiPanel = $("#globalAiPanel");
      if (aiPanel?.classList.contains("open")) {
        toggleGlobalAi();
      } else {
        closeFab();
      }
    }
  });
}

// ===== 增强功能初始化 =====
function initEnhancements() {
  initTheme();
  initShortcuts();
  updateHeroDate();

  const oldToast = $("#toast");
  if (oldToast) oldToast.style.display = "none";

  $("#themeToggle")?.addEventListener("click", toggleTheme);
  $("#globalAiBtn")?.addEventListener("click", toggleGlobalAi);
  $("#globalAiClose")?.addEventListener("click", toggleGlobalAi);
  $("#globalAiSend")?.addEventListener("click", sendGlobalAi);
  $("#globalAiInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendGlobalAi();
    }
  });

  $("#fabMainBtn")?.addEventListener("click", toggleFab);
  $$(".fab-action").forEach(btn => {
    btn.addEventListener("click", () => handleFabAction(btn.dataset.fabAction));
  });

  $$(".quick-action-btn").forEach(btn => {
    btn.addEventListener("click", () => handleQuickAction(btn.dataset.action));
  });

  document.addEventListener("click", (e) => {
    const fab = $("#quickCreateFab");
    if (fab && !fab.contains(e.target) && fab.classList.contains("open")) {
      closeFab();
    }
  });

  if (isLoggedIn()) {
    setTimeout(() => {
      checkAchievements();
      renderDailyTip();
      renderAchievements();
      showDailyTip();
    }, 1500);
  }

  $("#refreshTipBtn")?.addEventListener("click", () => {
    renderDailyTip();
    showToast("灵感已刷新 ✨", "info", 2000);
  });
}

window.initEnhancements = initEnhancements;
window.calcContentQuality = calcContentQuality;
window.showGlobalLoader = showGlobalLoader;
window.hideGlobalLoader = hideGlobalLoader;
window.toggleGlobalAi = toggleGlobalAi;
window.showToast = showToast;
window.toast = showToast;
window.checkAchievements = checkAchievements;
window.showShareCard = showShareCard;
window.closeShareCard = closeShareCard;
window.animateProgressBars = animateProgressBars;
window.getRandomTip = getRandomTip;
window.renderDailyTip = renderDailyTip;
window.renderAchievements = renderAchievements;
