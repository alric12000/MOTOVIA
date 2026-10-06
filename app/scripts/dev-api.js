// Local stand-in for Vercel's function runtime: serves api/**/*.js on :3001 with the
// same req/res helpers our handlers use (req.query, req.body, res.status/json/send).
// Vite (npm run dev) proxies /api here. Usage: npm run dev:api  (reads .env.local)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.API_PORT) || 3001

// Minimal .env loader (KEY=value, # comments). Doesn't override real env vars.
for (const file of ['.env.local', '.env']) {
  const p = path.join(root, file)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

const JSON_ROUTES = new Set(['send', 'test-reply']) // routes that read req.body

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const route = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '')
  const file = path.join(root, 'api', `${route}.js`)
  if (!route || route.split('/').some((s) => s.startsWith('_') || s === '..') || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"error":"Not found"}')
    return
  }
  req.query = Object.fromEntries(url.searchParams)
  if (JSON_ROUTES.has(route)) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { req.body = {} }
  }
  res.status = (c) => { res.statusCode = c; return res }
  res.json = (b) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res }
  res.send = (b) => { res.end(typeof b === 'string' || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res }
  const started = Date.now()
  try {
    const mod = await import(pathToFileURL(file).href)
    await mod.default(req, res)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) res.status(500).json({ error: e.message })
  }
  console.log(`${req.method} /api/${route} → ${res.statusCode} (${Date.now() - started} ms)`)
}).listen(PORT, () => console.log(`API on http://localhost:${PORT}/api  (Vite proxies /api here)`))
