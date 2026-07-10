import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { handleOnePieceApiRequest } from './server/onepieceApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const isProduction = args.has('--mode') && args.has('production');
const port = Number(process.env.PORT || 5173);
const distDir = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function serveStaticFile(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(res);
}

async function start() {
  let vite;

  if (!isProduction) {
    vite = await createViteServer({
      root: __dirname,
      configFile: false,
      base: '/',
      optimizeDeps: {
        noDiscovery: true,
        include: [],
      },
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }

  const server = createHttpServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);

    if (await handleOnePieceApiRequest(req, res, requestUrl)) {
      return;
    }

    if (vite) {
      try {
        const pathname = requestUrl.pathname;
        const isHtmlRequest =
          req.method === 'GET' &&
          (pathname === '/' || pathname.endsWith('.html') || !path.extname(pathname));

        if (isHtmlRequest) {
          const rawTemplate = await readFile(path.join(__dirname, 'index.html'), 'utf8');
          const html = await vite.transformIndexHtml(pathname, rawTemplate);
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          res.end(html);
          return;
        }

        vite.middlewares(req, res, (error) => {
          if (error) {
            throw error;
          }

          sendNotFound(res);
        });
      } catch (error) {
        vite.ssrFixStacktrace(error);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(error.message);
      }
      return;
    }

    const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const safeRelativePath = requestedPath.replace(/^\/+/, '');
    const filePath = path.join(distDir, safeRelativePath);

    if (existsSync(filePath) && !filePath.endsWith(path.sep)) {
      serveStaticFile(res, filePath);
      return;
    }

    const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(indexHtml);
  });

  server.listen(port, '0.0.0.0', () => {
    const modeLabel = isProduction ? 'production' : 'development';
    console.log(`ProxyCreator server running in ${modeLabel} mode at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
