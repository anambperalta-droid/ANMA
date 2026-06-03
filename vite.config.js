import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Versión = timestamp del build. Lo inyectamos como __BUILD_VERSION__ para
// que la UI pueda mostrar la versión que el usuario está corriendo y detectar
// si está con caché viejo.
const BUILD_VERSION = new Date().toISOString().slice(0, 16).replace('T', ' ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  server: {
    port: 5174,
    proxy: {
      // Proxy para Resend API — evita CORS en desarrollo
      '/resend-api': {
        target: 'https://api.resend.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/resend-api/, ''),
      },
    },
  },
})
