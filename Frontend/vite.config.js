import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/candidates': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/upload-resume': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/stats': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/search': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/skills': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/gdrive': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/chatbot': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/chat': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/job-titles': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
