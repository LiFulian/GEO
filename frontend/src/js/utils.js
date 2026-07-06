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
// 注意：更健壮的 JSON 解析在 ai-prompts.js 的 extractJsonObject / extractJsonArray，
// 新代码请直接用那两个；本函数已废弃删除以避免两套实现并存。

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
  let listType = null; // null | "ul" | "ol"
  let inQuote = false;
  const closeList = () => { if (listType === "ul") html.push("</ul>"); else if (listType === "ol") html.push("</ol>"); listType = null; };
  const closeQuote = () => { if (inQuote) { html.push("</blockquote>"); inQuote = false; } };
  for (let line of lines) {
    let m;
    // 标题
    if (m = line.match(/^### (.*)$/)) { closeList(); closeQuote(); html.push(`<h3>${m[1]}</h3>`); continue; }
    if (m = line.match(/^## (.*)$/)) { closeList(); closeQuote(); html.push(`<h2>${m[1]}</h2>`); continue; }
    if (m = line.match(/^# (.*)$/)) { closeList(); closeQuote(); html.push(`<h1>${m[1]}</h1>`); continue; }
    // 有序列表
    if (m = line.match(/^\d+\.\s+(.*)$/)) { closeQuote(); if (listType !== "ol") { closeList(); html.push("<ol>"); listType = "ol"; } html.push(`<li>${m[1]}</li>`); continue; }
    // 无序列表
    if (m = line.match(/^[-*] (.*)$/)) { closeQuote(); if (listType !== "ul") { closeList(); html.push("<ul>"); listType = "ul"; } html.push(`<li>${m[1]}</li>`); continue; }
    closeList();
    // 引用（不手动追加 <br>，交给末尾统一的换行处理，避免双 <br>）
    if (m = line.match(/^&gt; (.*)$/)) { if (!inQuote) { html.push("<blockquote>"); inQuote = true; } html.push(m[1]); continue; }
    closeQuote();
    // 空行
    if (!line.trim()) { html.push(""); continue; }
    // 普通行
    html.push(line);
  }
  closeList();
  closeQuote();
  return html.join("\n")
    // 图片（仅放行 http(s)）
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (__, alt, url) =>
      /^https?:\/\//i.test(url) ? `<img src="${url}" alt="${alt}" loading="lazy" />` : (alt || ""))
    // 链接（仅放行 http(s)/mailto，阻断 javascript:/data: 等协议）
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (__, txt, url) =>
      /^(https?:|mailto:)/i.test(url) ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>` : txt)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

// ===== 数据导出（CSV / JSON）=====

// 触发浏览器下载
function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type: mime }); // BOM 让 Excel 正确识别 UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 把对象数组转成 CSV（cols: [{key, label}]）
function toCSV(rows, cols) {
  const esc = (v) => {
    const s = (v == null ? "" : String(v)).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const header = cols.map(c => esc(c.label)).join(",");
  const body = rows.map(r => cols.map(c => esc(r[c.key])).join(",")).join("\n");
  return header + "\n" + body;
}

// 导出某类实体为 CSV（按日期戳命名）
function exportCSV(filenameStem, rows, cols) {
  if (!rows || !rows.length) { showToast("没有可导出的数据", "warning"); return; }
  const d = new Date().toISOString().slice(0, 10);
  downloadFile(`${filenameStem}-${d}.csv`, toCSV(rows, cols), "text/csv;charset=utf-8");
  showToast(`已导出 ${rows.length} 条`, "success");
}

// 全量 JSON 备份（当前账号可见的全部业务数据）
function exportAllJSON() {
  const payload = {
    exported_at: new Date().toISOString(),
    products: state.products,
    geo_questions: state.geo_questions,
    articles: state.articles,
    platforms: state.platforms,
    tasks: state.tasks,
    geo_rank_checks: state.geo_rank_checks,
    product_images: (state.product_images || []).map(p => ({ ...p, image: "（文件需另行导出）" })),
  };
  const d = new Date().toISOString().slice(0, 10);
  const total = Object.values(payload).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  downloadFile(`geo-backup-${d}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  showToast(`已备份 ${total} 条记录`, "success");
}
