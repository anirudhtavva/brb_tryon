/**
 * Run the API (and the web app, if built) on your laptop without a Vercel account:
 *   npm run local        → http://localhost:3000            (web app, if backend/public exists)
 *                        → http://localhost:3000/api/...    (the API)
 *
 * It loads `.env.local`, then serves the exact same handlers Vercel uses.
 * Your phone (Expo Go) can reach it on your Wi-Fi at http://<laptop-ip>:3000.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { productionDeps } from '../src/deps.js';
import { createHealthHandler, createStatusHandler, createTryOnHandler } from '../src/handlers.js';

process.loadEnvFile?.('.env.local');

const routes: Record<string, (req: Request) => Promise<Response>> = {
  'POST /api/tryon': createTryOnHandler(productionDeps),
  'GET /api/tryon-status': createStatusHandler(productionDeps),
  'GET /api/health': createHealthHandler(productionDeps),
};

// The web build of the app (made by "Deploy to Vercel.command" or `npm run build:web` in /app).
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

/** Serve a file from /public, falling back to index.html so app links like /product/x work. */
function serveStatic(pathname: string, res: import('node:http').ServerResponse): boolean {
  if (!existsSync(PUBLIC_DIR)) return false;
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(PUBLIC_DIR, safe);
  if (!file.startsWith(PUBLIC_DIR) || !existsSync(file) || statSync(file).isDirectory()) {
    file = path.join(PUBLIC_DIR, 'index.html');
  }
  if (!existsSync(file)) return false;
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
  return true;
}

const port = Number(process.env.PORT ?? 3000);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) {
    if (req.method === 'GET' && !url.pathname.startsWith('/api/') && serveStatic(url.pathname, res)) return;
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":{"code":"NOT_FOUND"}}');
    return;
  }

  // Convert Node's request into a standard web Request.
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
  headers.set('x-forwarded-for', req.socket.remoteAddress ?? 'local');

  const response = await handler(
    new Request(url, { method: req.method, headers, body: req.method === 'GET' ? undefined : Buffer.concat(chunks) }),
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '0.0.0.0', () =>
  console.log(`Try-on API on http://localhost:${port}  (provider: ${process.env.TRYON_PROVIDER ?? 'mock'})`),
);
