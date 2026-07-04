import { defineConfig, loadEnv } from "vite";

// 将 .env 中的前端配置注入到 HTML 内联脚本（window.__GEO_ENV__）
// 这样传统 <script> 也能读取到环境变量，不需要使用 import.meta.env
function injectGeoEnvPlugin() {
  let env;
  return {
    name: "geo-inject-env",
    configResolved(resolved) {
      env = resolved.env;
    },
    transformIndexHtml(html) {
      const key = env.VITE_DEFAULT_AI_KEY || "";
      const pbUrl = env.VITE_PB_URL || "http://127.0.0.1:8085";
      const injected = `window.__GEO_CONFIG__ = Object.assign(window.__GEO_CONFIG__ || {}, { pbUrl: ${JSON.stringify(pbUrl)} }); window.__GEO_ENV__ = { VITE_DEFAULT_AI_KEY: ${JSON.stringify(key)} };`;
      // 注入到 <head> 末尾，确保早于其他脚本执行
      return html.replace("</head>", `  <script>${injected}</script>\n</head>`);
    },
  };
}

export default defineConfig({
  root: "src",
  plugins: [injectGeoEnvPlugin()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      // 所有 /api 请求代理到 PocketBase
      "/api": {
        target: "http://127.0.0.1:8085",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
