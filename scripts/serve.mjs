import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json' };
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const server = createServer(async (req, res) => {
  try {
    const relative = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const target = path.resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (target !== root && !target.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
    if (!(await stat(target)).isFile()) { res.writeHead(404).end('Not found'); return; }
    const bytes = await readFile(target);
    res.writeHead(200, { 'Content-Type':mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self'; connect-src 'self' http://127.0.0.1:*; object-src 'none'" });
    res.end(bytes);
  } catch { res.writeHead(404).end('Not found'); }
});
server.listen(port, host, () => console.log(`ZpkDxGames avatar preview: http://${host}:${port}`));
