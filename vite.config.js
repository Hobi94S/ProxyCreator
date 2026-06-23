import { defineConfig } from 'vite';
import { handleOnePieceApiRequest } from './server/onepieceApi.js';

function onePieceApiMiddleware() {
  return {
    name: 'one-piece-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.originalUrl || req.url || '/', 'http://localhost');

        if (await handleOnePieceApiRequest(req, res, requestUrl)) {
          return;
        }

        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const requestUrl = new URL(req.originalUrl || req.url || '/', 'http://localhost');

        if (await handleOnePieceApiRequest(req, res, requestUrl)) {
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [onePieceApiMiddleware()],
});
