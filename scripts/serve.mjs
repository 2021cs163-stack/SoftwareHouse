import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readPublicConfig } from './public-config.mjs';
const publicConfig = readPublicConfig();
const root = path.resolve('dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml' };
http.createServer(async (req,res) => {
 try {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/src/config.js') {
   res.writeHead(200, { 'Content-Type':'text/javascript', 'Cache-Control':'no-store' });
   return res.end(`export const supabaseConfig = ${JSON.stringify(publicConfig)};`);
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  const body = await readFile(file);
  res.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
  res.end(body);
 } catch { res.writeHead(404); res.end('Not found'); }
}).listen(5173,'127.0.0.1',()=>console.log('Rayan workspace: http://localhost:5173'));
