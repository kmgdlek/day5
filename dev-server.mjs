// 내 컴퓨터에서 확인하는 작은 서버: 정적 파일 + /api/* 함수 (Vercel 과 같은 방식으로 동작)
// 실행: node dev-server.mjs   →  http://localhost:3000
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3000

// .env 파일을 읽어 환경변수로 쓴다 (이미 설정된 값은 덮어쓰지 않는다)
try {
  for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
} catch {
  console.log('(.env 파일이 없어요 — .env.example 을 복사해서 만들어 주세요)')
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, '')
    const file = path.join(root, 'api', `${name}.js`)
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found') }
    req.query = Object.fromEntries(url.searchParams)
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)) }
    try {
      const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`) // 고치면 바로 반영되게 캐시를 피한다
      await mod.default(req, res)
    } catch (e) {
      console.error(e)
      if (!res.headersSent) res.status(500).json({ error: String(e.message || e) })
    }
    return
  }

  let rel = decodeURIComponent(url.pathname)
  if (rel.endsWith('/')) rel += 'index.html'
  const file = path.normalize(path.join(root, rel))
  const blocked = /(^|[\\/])(\.env|\.git|server|supabase|scripts|data|node_modules)([\\/]|$)/.test(path.relative(root, file))
  if (!file.startsWith(root) || blocked || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.statusCode = 404
    return res.end('not found')
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
}).listen(PORT, () => console.log(`http://localhost:${PORT}`))
