/* GEO Studio - Application Entry Point */

bindEvents();

// 根据平台显示搜索快捷键
const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const shortcutEl = document.getElementById("searchShortcut");
if (shortcutEl) shortcutEl.textContent = isMac ? "⌘K" : "Ctrl+K";

// 初始化增强功能（主题、快捷键、AI助手等）
if (typeof initEnhancements === "function") {
  initEnhancements();
}

// 致命错误恢复态：首启 / 后台未就绪时渲染全屏错误遮罩 + 重试按钮，
// 而不是只弹一条 3 秒后消失的 toast（那样首启用户会面对白屏不知所措）。
function showFatalError(msg) {
  const el = document.getElementById("fatalError");
  if (!el) { toast(msg || "加载失败", "error"); return; }
  const msgEl = document.getElementById("fatalErrorMsg");
  if (msgEl) msgEl.textContent = msg || "无法连接后台服务。";
  el.style.display = "flex";
}
function hideFatalError() {
  const el = document.getElementById("fatalError");
  if (el) el.style.display = "none";
}

// 应用引导：已登录则拉数据 + 路由恢复；失败进入致命错误态可点「重试」重跑。
function bootstrapApp() {
  if (!isLoggedIn()) {
    hideFatalError();
    showAuthView();
    render();
    return;
  }
  hideFatalError();
  load().then(() => {
    // 数据加载完成后初始化路由（支持从 hash 恢复状态）
    if (typeof initRouter === "function") initRouter();
    // 数据就绪后再判定是否需要新手引导（避免慢网竞态误弹老用户）
    if (typeof maybeShowWizard === "function") maybeShowWizard();
  }).catch(err => {
    console.error("[GEO] 初始加载失败：", err);
    showFatalError((err && err.message) ? err.message : "无法连接后台服务，请确认 PocketBase 已启动。");
  });
}

document.getElementById("fatalRetryBtn")?.addEventListener("click", bootstrapApp);

bootstrapApp();
