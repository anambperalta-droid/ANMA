import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Versión = timestamp del build. Lo inyectamos como __BUILD_VERSION__ para
// que la UI pueda mostrar la versión que el usuario está corriendo y detectar
// si está con caché viejo.
const BUILD_VERSION = new Date().toISOString().slice(0, 16).replace('T', ' ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-fallback-app',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith('/app') && !req.url.includes('.')) {
            req.url = '/app/index.html'
          }
          next()
        })
      },
    },
  ],
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app/index.html'),
      },
      output: {
        // Vendors en chunks propios: cambian poco entre deploys, así el browser
        // los mantiene cacheados y solo re-descarga el código de la app.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'vendor-supabase'
            if (id.includes('react-router')) return 'vendor-react'
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\') || id.includes('scheduler')) return 'vendor-react'
          }
        },
      },
    },
  },
  server: {
    port: 5174,
  },
})
