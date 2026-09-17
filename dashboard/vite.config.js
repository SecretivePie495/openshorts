import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import seo from './vite-plugin-seo'

// Backend target for the dev proxy. Defaults to the docker-compose service
// name; set VITE_PROXY_TARGET=http://localhost:8000 to run the dev server on
// the host against a backend reachable at localhost (no CORS, same-origin).
const backend = process.env.VITE_PROXY_TARGET || 'http://backend:8000'
const renderer = process.env.VITE_RENDER_TARGET || 'http://renderer:3100'

// https://vitejs.dev/config/
export default defineConfig({
  // seo() runs on build only. It injects the crawler-visible homepage content
  // into #root and emits the static /alternatives pages, sitemap.xml and
  // llms.txt. See vite-plugin-seo.js.
  plugins: [react(), seo()],
  // esbuild hoists const/let bindings across chunk boundaries during minification,
  // which violates TDZ and produces "Cannot access 'ae' before initialization" in
  // production builds. Disabling syntax minification keeps names intact and avoids
  // the hoist while still tree-shaking and dead-code-eliminating.
  esbuild: { minifySyntax: false },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Only fail on cycles in our own source; third-party libs like mediabunny
        // have known internal cycles that esbuild handles fine but Rollup warns about.
        if (warning.code === 'CIRCULAR_DEPENDENCY' && !warning.message.includes('node_modules')) {
          throw new Error('CIRCULAR: ' + warning.message)
        }
        warn(warning)
      }
    }
  },
  server: {
    allowedHosts: [
      'openshorts.app',
      'www.openshorts.app'
    ],
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/videos': { target: backend, changeOrigin: true },
      '/thumbnails': { target: backend, changeOrigin: true },
      '/gallery': { target: backend, changeOrigin: true },
      '/video': { target: backend, changeOrigin: true },
      '/render': { target: renderer, changeOrigin: true },
    }
  }
})
