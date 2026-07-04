/* GEO Studio - Core utilities and API layer */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

// --- API ---

async function api(path, options = {}) {
  return window.geoApi(path, options);
}

// --- Toast ---
// 兼容旧调用：所有 toast() 调用统一走新的 showToast（enhancements.js 提供）
function toast(message, type = "default") {
  if (typeof showToast === "function") {
    showToast(message, type);
  } else {
    // 极端情况下 showToast 还未加载，使用简单 fallback
    console.log(`[toast:${type}]`, message);
  }
}

// --- HTML Utilities ---

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function emptyStateWithAction(message, icon = "📄", actionHtml = "") {
  return `<div class="empty-state"><div class="empty-state-icon">${icon}</div><p class="empty-state-title">${message}</p>${actionHtml ? `<div class="empty-state-action">${actionHtml}</div>` : ""}</div>`;
}

// --- Debounce ---

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// --- Loading State ---

function setLoading(button, loading = true) {
  if (!button) return;
  if (loading) {
    button._originalText = button.textContent;
    button.disabled = true;
    button.dataset.loading = "true";
    const spinner = document.createElement("span");
    spinner.className = "loading";
    button.prepend(spinner);
  } else {
    button.disabled = false;
    delete button.dataset.loading;
    button.textContent = button._originalText || button.textContent;
  }
}

function isLoading(button) {
  return button && button.dataset.loading === "true";
}

// --- Clipboard ---

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

// --- Checkbox Helpers ---

function selectedValues(selector) {
  return $$(`${selector} input:checked`).map(input => input.value);
}

// --- JSON Parsing ---

function parseJsonObjectText(text) {
  let value = text.trim();
  if (value.startsWith("```")) {
    value = value.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed[0] || {}) : parsed;
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("没有找到可解析的 JSON 对象");
    return JSON.parse(value.slice(start, end + 1));
  }
}

function normalizeProductSuggestion(item) {
  return {
    name: item.name || item["产品名称"] || item["名称"] || "",
    type: item.type || item["产品类型"] || item["类型"] || "",
    url: item.url || item["产品链接"] || item["链接"] || "",
    audience: item.audience || item["目标用户"] || item["用户"] || "",
    selling_points: item.selling_points || item["核心卖点"] || item["卖点"] || "",
    competitors: item.competitors || item["竞品"] || item["竞品/替代方案"] || item["替代方案"] || "",
    tone: item.tone || item["品牌语气"] || "真实、专业、克制",
    goal: item.goal || item["转化目标"] || "",
    forbidden_words: item.forbidden_words || item["禁用表达"] || item["风险提示"] || "",
  };
}

// --- Time ---

function formatLocalNow() {
  // 返回本地时间字符串 YYYY-MM-DD HH:MM:SS，避免 toISOString 的时区偏差
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// --- Markdown ---

function markdownToHtml(text) {
  if (!text) return "";
  const lines = escapeHtml(text).split("\n");
  let html = [];
  let inList = false;
  let inQuote = false;
  for (let line of lines) {
    // 标题
    let m;
    if (m = line.match(/^### (.*)$/)) { if (inList) { html.push("</ul>"); inList = false; } if (inQuote) { html.push("</blockquote>"); inQuote = false; } html.push(`<h3>${m[1]}</h3>`); continue; }
    if (m = line.match(/^## (.*)$/)) { if (inList) { html.push("</ul>"); inList = false; } if (inQuote) { html.push("</blockquote>"); inQuote = false; } html.push(`<h2>${m[1]}</h2>`); continue; }
    if (m = line.match(/^# (.*)$/)) { if (inList) { html.push("</ul>"); inList = false; } if (inQuote) { html.push("</blockquote>"); inQuote = false; } html.push(`<h1>${m[1]}</h1>`); continue; }
    // 列表
    if (m = line.match(/^[-*] (.*)$/)) { if (inQuote) { html.push("</blockquote>"); inQuote = false; } if (!inList) { html.push("<ul>"); inList = true; } html.push(`<li>${m[1]}</li>`); continue; }
    if (inList) { html.push("</ul>"); inList = false; }
    // 引用
    if (m = line.match(/^&gt; (.*)$/)) { if (!inQuote) { html.push("<blockquote>"); inQuote = true; } html.push(m[1] + "<br>"); continue; }
    if (inQuote) { html.push("</blockquote>"); inQuote = false; }
    // 空行
    if (!line.trim()) { html.push(""); continue; }
    // 普通行
    html.push(line);
  }
  if (inList) html.push("</ul>");
  if (inQuote) html.push("</blockquote>");
  return html.join("\n")
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}
