import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve('.');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end('Method not allowed');
      return;
    }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relative = decodeURIComponent(pathname);
    if (relative.includes('\\') || relative.split('/').some(part => part.startsWith('.'))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const file = resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const type = types[extname(file)];
    if (!type) {
      response.writeHead(404).end('Not found');
      return;
    }
    const bytes = await readFile(file);
    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, host, () => {
  console.log(`FitnessPilot preview: http://${host}:${port}`);
});