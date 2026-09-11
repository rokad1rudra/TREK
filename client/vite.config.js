import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import http from 'node:http';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2,ttf}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/uploads/,
          /^\/mcp/,
          /^\/oauth\//,
          /^\/.well-known\//,
          /^\/plugin-frame\//,
        ],
        runtimeCaching: [
          {
            // Fast Map Tile Cache (Carto, OpenStreetMap, Esri, Wikimedia, Stadia)
            // CacheFirst ensures tiles load in ~0ms from local CacheStorage
            urlPattern: /^https:\/\/(.*\.tile\.openstreetmap\.(org|de|fr)|[a-d]\.basemaps\.cartocdn\.com|server\.arcgisonline\.com|.*\.tile\.stadiamaps\.com|upload\.wikimedia\.org)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 25000, maxAgeSeconds: 60 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Mapbox GL style, glyphs, sprites and vector tiles. Best-effort
            // offline only: opportunistically caches what the user has already
            // viewed online. Full pre-download offline maps require the Leaflet
            // renderer (raster prefetch in tilePrefetcher.ts) — the GL vector
            // pipeline is not prefetched. StaleWhileRevalidate keeps the basemap
            // fresh online while still serving from cache when offline. Mapbox
            // sends CORS, so responses are non-opaque (real 200s, no quota pad).
            urlPattern: /^https:\/\/(api\.mapbox\.com|[a-d]\.tiles\.mapbox\.com)\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mapbox-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // OpenFreeMap MapLibre style, glyphs, sprites and vector tiles.
            // Same best-effort offline model as Mapbox GL: viewed resources are
            // reused from cache, but the vector tile pipeline is not prefetched.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // API calls — network only. We deliberately do NOT cache API
            // responses in the Service Worker: Workbox keys entries by URL and
            // cannot vary on the httpOnly session cookie, so a shared device
            // could serve one user's cached data to the next (cross-user leak).
            // Offline reads are served from the per-user IndexedDB cache via the
            // repo layer instead. The urlPattern is kept so these requests still
            // bypass the SPA navigation fallback.
            urlPattern: /\/api\/(?!auth|admin|backup|settings|health).*/i,
            handler: 'NetworkOnly',
          },
          {
            // Uploaded files (photos, covers — public assets only)
            urlPattern: /\/uploads\/(?:covers|avatars)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'user-uploads',
              expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      manifest: {
        name: 'GlobeTrotter — Travel Planner',
        short_name: 'GlobeTrotter',
        description: 'Plan and organize every journey in one place.',
        theme_color: '#111827',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        categories: ['travel', 'navigation'],
        icons: [
          { src: 'icons/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  build: {
    sourcemap: false,
    modulePreload: { polyfill: true },
  },
  server: {
    port: 5173,
    proxy: (function () {
      let lastRefusedLog = 0;
      const REFUSED_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', 'ETIMEDOUT']);

      const retryHttpRequest = (req, res, attempt = 1, maxAttempts = 6) => {
        if (!res || typeof res.writeHead !== 'function' || res.headersSent) return;

        const options = {
          hostname: '127.0.0.1',
          port: 3001,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: '127.0.0.1:3001' },
        };

        const clientReq = http.request(options, (backendRes) => {
          if (!res.headersSent) {
            res.writeHead(backendRes.statusCode, backendRes.headers);
            backendRes.pipe(res);
          }
        });

        clientReq.on('error', (err) => {
          if (attempt < maxAttempts) {
            const backoff = Math.min(250 * attempt, 1000);
            setTimeout(() => {
              retryHttpRequest(req, res, attempt + 1, maxAttempts);
            }, backoff);
          } else {
            const now = Date.now();
            if (now - lastRefusedLog > 30000) {
              console.warn('[vite] Backend server (127.0.0.1:3001) is offline or unreachable.');
              lastRefusedLog = now;
            }
            if (!res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Backend server is starting up. Please wait...' }));
            }
          }
        });

        if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) {
          clientReq.end();
        } else {
          try {
            req.pipe(clientReq);
          } catch {
            clientReq.end();
          }
        }
      };

      const handleProxyError = (err, req, res) => {
        if (err && REFUSED_CODES.has(err.code)) {
          if (res && typeof res.writeHead === 'function' && !res.headersSent) {
            retryHttpRequest(req, res);
          } else if (res && typeof res.destroy === 'function') {
            res.destroy();
          }
          return;
        }
        console.error(`[vite] http proxy error for ${req?.url || 'request'}:`, err?.message || err);
      };

      const configureProxy = (proxy) => {
        const origEmit = proxy.emit;
        proxy.emit = function (event, err, req, res) {
          if (event === 'error' && err && REFUSED_CODES.has(err.code)) {
            handleProxyError(err, req, res);
            return true;
          }
          return origEmit.apply(this, arguments);
        };
      };

      const proxyRule = {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        configure: configureProxy,
        onError: handleProxyError,
      };

      const wsProxyRule = {
        target: 'http://127.0.0.1:3001',
        ws: true,
        configure: configureProxy,
        onError: handleProxyError,
      };

      return {
        '/api': proxyRule,
        '/plugin-frame': proxyRule,
        '/uploads': proxyRule,
        '/ws': wsProxyRule,
        '/mcp': proxyRule,
        '/oauth/authorize': proxyRule,
        '/oauth/token': proxyRule,
        '/oauth/register': proxyRule,
        '/oauth/revoke': proxyRule,
        '/.well-known': proxyRule,
      };
    })(),
  },
});
