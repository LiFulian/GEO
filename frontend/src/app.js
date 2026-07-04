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

if (isLoggedIn()) {
  load().then(() => {
    // 数据加载完成后初始化路由（支持从 hash 恢复状态）
    if (typeof initRouter === "function") initRouter();
  }).catch(err => toast(err.message, "error"));
} else {
  showAuthView();
  render();
}
