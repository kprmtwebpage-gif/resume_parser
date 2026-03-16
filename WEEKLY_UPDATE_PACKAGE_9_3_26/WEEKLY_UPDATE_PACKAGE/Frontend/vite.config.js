import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5175,
    strictPort: true,
    proxy: {
      '/candidates': { target: 'http://localhost:8000', changeOrigin: true },
      '/upload-resume': { target: 'http://localhost:8000', changeOrigin: true },
      '/stats': { target: 'http://localhost:8000', changeOrigin: true },
      '/search': { target: 'http://localhost:8000', changeOrigin: true },
      '/skills': { target: 'http://localhost:8000', changeOrigin: true },
      '/gdrive': { target: 'http://localhost:8000', changeOrigin: true },
      '/chatbot': { target: 'http://localhost:8000', changeOrigin: true },
      '/chat': { target: 'http://localhost:8000', changeOrigin: true },
      '/job-titles': { target: 'http://localhost:8000', changeOrigin: true },
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/saved-jobs': { target: 'http://localhost:8000', changeOrigin: true },
      '/search-history': { target: 'http://localhost:8000', changeOrigin: true },
      '/job-applications': { target: 'http://localhost:8000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
