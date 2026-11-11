import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.woff2':'font/woff2' }
export async function productionFiles(root) {
  const aliases = {}
  for (const name of await readdir(path.join(root,'assets'))) {
    for (const kind of ['before','after']) if (name.startsWith(`demo-${kind}-`)) aliases[`/src/assets/demo-${kind}.png`] = `/assets/${name}`
  }
  return async (req,res) => {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);res.end();return}
    try {
      const url = new URL(req.url,'http://localhost')
      const requested = decodeURIComponent(url.pathname)
      const file = path.resolve(root, `.${aliases[requested] ?? (requested==='/'?'/index.html':requested)}`)
      if (!file.startsWith(root+path.sep)) throw new Error('Outside public root')
      const data = await readFile(file)
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':file.includes(`${path.sep}assets${path.sep}`)?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff'})
      res.end(req.method==='HEAD'?undefined:data)
    } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Berkas tidak ditemukan.')}
  }
}
