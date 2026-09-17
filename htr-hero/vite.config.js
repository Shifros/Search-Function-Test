import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL vars (including non-VITE_ ones) for server-side use only.
  // The key is injected into proxied API requests here, so it never
  // needs to be reachable from browser JavaScript.
  const serverEnv = loadEnv(mode, process.cwd(), '')
  // NOTE: read at dev-server startup (restart `npm run dev` after editing .env.local).
  const apiKey = serverEnv.VITE_TYPESAFE_API_KEY || serverEnv.TYPESAFE_API_KEY || ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Same-origin proxy → no browser CORS block.
        // Frontend calls /api/systemone; dev server forwards to TypeSafe
        // and attaches the API key server-side.
        '/api/systemone': {
          target: 'https://api.typesafe.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/systemone/, '/v1/systemone'),
          // http-proxy merges these into the outgoing request headers.
          ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
        },
      },
    },
  }
})
