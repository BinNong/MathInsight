import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mathinsight/',
  server: {
    port: 5173,
    proxy: {
      '/mathinsight/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mathinsight/, '')
      },
      '/mathinsight/downloads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mathinsight/, '')
      }
    }
  }
})
