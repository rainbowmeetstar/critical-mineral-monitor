const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const url = require('url')

const PORT = process.env.PORT || 3000
const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '')
const DIST = path.join(__dirname, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
}

function proxy(req, res) {
  const target = BACKEND_URL + req.url
  const parsed = url.parse(target)
  const transport = parsed.protocol === 'https:' ? https : http
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.path,
    method: req.method,
    headers: { ...req.headers, host: parsed.hostname },
  }
  const upstream = transport.request(options, (upRes) => {
    res.writeHead(upRes.statusCode, upRes.headers)
    upRes.pipe(res)
  })
  upstream.on('error', (err) => {
    console.error('[proxy error]', err.message)
    res.writeHead(502)
    res.end('Bad Gateway')
  })
  req.pipe(upstream)
}

http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0]

  if (BACKEND_URL && urlPath.startsWith('/api/')) {
    return proxy(req, res)
  }

  let filePath = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }

  const contentType = MIME[path.extname(filePath)] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': contentType })
  res.end(fs.readFileSync(filePath))
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Critical Mineral Monitor frontend on port ${PORT}`)
  if (BACKEND_URL) {
    console.log(`Proxying /api/ -> ${BACKEND_URL}`)
  } else {
    console.warn('BACKEND_URL not set — API requests will not be proxied')
  }
})
