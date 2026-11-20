import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:5000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mathinsight/',
  // plotly.js 的 lib/* 子模块是 CommonJS 产物，内部引用了 Node 的 global；
  // 浏览器环境需要把它指向 globalThis（兼容开发与构建两种模式）。
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/mathinsight/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mathinsight/, ''),
      },
      '/mathinsight/downloads': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mathinsight/, ''),
      },
    },
  },
})
