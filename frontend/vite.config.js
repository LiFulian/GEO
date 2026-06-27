import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
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
