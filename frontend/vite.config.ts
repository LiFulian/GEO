import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 将 .env 中的前端配置注入到 HTML 内联脚本（window.__GEO_ENV__）
function injectGeoEnvPlugin() {
  let env: Record<string, string>
  return {
    name: 'geo-inject-env',
    configResolved(resolved: any) {
      env = resolved.env
    },
    transformIndexHtml(html: string) {
      const key = env.VITE_DEFAULT_AI_KEY || ''
      const pbUrl = env.VITE_PB_URL || ''
      const injected = `window.__GEO_CONFIG__ = Object.assign(window.__GEO_CONFIG__ || {}, { pbUrl: ${JSON.stringify(pbUrl)} }); window.__GEO_ENV__ = { VITE_DEFAULT_AI_KEY: ${JSON.stringify(key)} };`
      return html.replace('</head>', `  <script>${injected}</script>\n</head>`)
    },
  }
}

export default defineConfig({
  root: 'src',
  envDir: '..',
  plugins: [vue(), injectGeoEnvPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8085',
        changeOrigin: true,
        bypass(req) {
          // 不代理源文件请求（/api/*.ts 等），否则 Vite 无法编译 src/api/ 下的模块
          if (/\.(ts|vue|css|js|jsx|tsx)(\?|$)/.test(req.url)) return req.url
        },
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
})
