import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function getEnv(mode) {
  // Load both Vite-style env files AND process env.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    ...env,
    ...process.env,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = getEnv(mode)

  // Base path for path-based routing (e.g. '/dev', '/uat', or '' for production root)
  const basePath = env.VITE_BASE_PATH || ''

  // Backend target used by the Vite dev proxy.
  // - Local FastAPI default: http://127.0.0.1:8000
  // - Docker dev compose often maps API to host port 8002: http://127.0.0.1:8002
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

  const proxiedPaths = [
    '/api',
    '/candidates',
    '/upload-resume',
    '/stats',
    '/search',
    '/skills',
    '/locations',
    '/gdrive',
    '/chatbot',
    '/chat',
    '/job-titles',
    '/saved-jobs',
    '/search-history',
    '/job-applications',
    '/email',
    '/uploads',
    '/standalone-comments',
    '/candidate-comments',
  ]

  const proxy = Object.fromEntries(
    proxiedPaths.map((p) => [p, { target: proxyTarget, changeOrigin: true }])
  )

  return {
    // Public base path — ensures asset URLs include the env prefix
    base: basePath ? `${basePath}/` : '/',
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy,
    },
  }
})
