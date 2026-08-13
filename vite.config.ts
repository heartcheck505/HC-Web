import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://images.unsplash.com",
  "connect-src 'self' https://heartcheckapi.runasp.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

// La CSP se inyecta solo en build para no interferir con el HMR de desarrollo.
const cspPlugin = (): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return {
      html,
      tags: [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CSP_DIRECTIVES,
          },
          injectTo: 'head-prepend',
        },
      ],
    }
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), cspPlugin()],
  server: {
    proxy: {
      '/api': {
        target:
          process.env.HEARTCHECK_API_PROXY_TARGET ??
          'http://heartcheckapi.runasp.net',
        changeOrigin: true,
        // El destino puede ser HTTP local o HTTPS con certificado no confiable.
        secure: false,
        // IIS/ASP.NET resetea la conexión (ECONNRESET) si el Host Header del
        // proxy no coincide con el host del sitio virtual: se fuerza el Host
        // del backend en las peticiones salientes.
        headers: { Host: 'heartcheckapi.runasp.net' },
        // La ruta se reenvía tal cual (/api/auth/login → <target>/api/auth/login).
        rewrite: (path) => path,
      },
    },
  },
})
