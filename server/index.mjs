/**
 * Servidor de producción para Render (y cualquier host de Node):
 * - Sirve el bundle estático de `dist/` con fallback SPA (toda ruta no
 *   estática → index.html).
 * - Reenvía `/api/*` a `http://heartcheckapi.runasp.net/api/*` de forma
 *   interna (proxied server-side): el navegador solo habla con el mismo
 *   origen, eliminando ERR_CONNECTION_RESET, ERR_TIMED_OUT y Mixed Content.
 * Sin dependencias externas: usa solo `node:http`/`node:https`/`node:fs`.
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT) || 3000
const DIST_DIR = fileURLToPath(new URL('../dist/', import.meta.url))
const API_TARGET_HOST = 'heartcheckapi.runasp.net'
const API_TARGET_PORT = 80

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function sendFile(res, filePath) {
  res.writeHead(200, {
    'Content-Type':
      MIME_TYPES[extname(filePath)] || 'application/octet-stream',
  })
  createReadStream(filePath).pipe(res)
}

function serveStatic(res, pathname) {
  const normalized = normalize(pathname).replace(/^([./\\])+/, '')
  const filePath = join(DIST_DIR, normalized)
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    sendFile(res, filePath)
    return true
  }
  return false
}

function proxyApi(req, res) {
  const upstream = httpsRequest(
    {
      host: API_TARGET_HOST,
      port: API_TARGET_PORT,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        Host: API_TARGET_HOST,
        'X-Forwarded-For': req.socket.remoteAddress || '',
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Heart-Check API no disponible (502).')
  })
  req.pipe(upstream)
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    .pathname

  if (pathname.startsWith('/api/')) {
    proxyApi(req, res)
    return
  }

  if (serveStatic(res, pathname)) {
    return
  }

  // Fallback SPA: toda ruta no estática sirve la aplicación.
  sendFile(res, join(DIST_DIR, 'index.html'))
})

server.listen(PORT, () => {
  console.log(`Heart-Check Web en http://localhost:${PORT}`)
})