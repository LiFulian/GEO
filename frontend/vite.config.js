import { defineConfig, loadEnv } from "vite";
import fs from "fs";
import path from "path";

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
      // pbUrl 默认为空 → 走同源（/api/...），dev 由 vite proxy 转发，prod 由 PocketBase 同源提供
      // 仅当后端与前端不同源时才在 .env 设置 VITE_PB_URL
      const pbUrl = env.VITE_PB_URL || "";
      const injected = `window.__GEO_CONFIG__ = Object.assign(window.__GEO_CONFIG__ || {}, { pbUrl: ${JSON.stringify(pbUrl)} }); window.__GEO_ENV__ = { VITE_DEFAULT_AI_KEY: ${JSON.stringify(key)} };`;
      // 注入到 <head> 末尾，确保早于其他脚本执行
      return html.replace("</head>", `  <script>${injected}</script>\n</head>`);
    },
  };
}

// 复制「传统（非 ES module）脚本」到构建产物
// index.html 里的 <script src="/js/*.js"> 和 <script src="/app.js"> 没有 type="module"，
// Vite 不会打包/哈希它们；这里在构建末尾把它们原样复制到 dist/，保证生产环境可加载。
function copyLegacyScriptsPlugin() {
  return {
    name: "geo-copy-legacy-scripts",
    closeBundle() {
      const srcDir = path.resolve("src");
      const outDir = path.resolve("dist");
      const targets = [];
      // src/js/*.js -> dist/js/*.js
      const jsDir = path.join(srcDir, "js");
      if (fs.existsSync(jsDir)) {
        for (const f of fs.readdirSync(jsDir)) {
          if (f.endsWith(".js")) targets.push([path.join(jsDir, f), path.join(outDir, "js", f)]);
        }
      }
      // src/app.js -> dist/app.js
      const appJs = path.join(srcDir, "app.js");
      if (fs.existsSync(appJs)) targets.push([appJs, path.join(outDir, "app.js")]);
      for (const [from, to] of targets) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
      }
      console.log(`[geo] copied ${targets.length} legacy script(s) to dist/`);
    },
  };
}

export default defineConfig({
  root: "src",
  envDir: "..", // 从 frontend/（package.json 所在目录）加载 .env，而非 src/.env
  plugins: [injectGeoEnvPlugin(), copyLegacyScriptsPlugin()],
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
