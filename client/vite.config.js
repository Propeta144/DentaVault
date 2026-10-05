import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // never swap app code out from under an in-progress form — see src/pwa.js
      devOptions: { enabled: true }, // lets the service worker run under `npm run dev` too, not just a build
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'DentaVault — Teodosio-Rufin Dental Clinic',
        short_name: 'DentaVault',
        description: 'Dental records, charting, and X-ray management for Teodosio-Rufin Dental Clinic.',
        theme_color: '#171123',
        background_color: '#fbfbfb',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the built app shell (JS/CSS/HTML/icons) so the UI loads
        // instantly offline. Runtime data below is handled separately.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          // Order matters: Workbox uses the FIRST matching route. The X-ray
          // image rule must come before the general /api/ rule below, or
          // its broad `startsWith('/api/')` check claims image requests
          // first and they silently get NetworkFirst's 7-day-TTL treatment
          // instead of CacheFirst's image-appropriate 30-day one.
          {
            // X-ray image bytes: large, immutable once uploaded, and
            // expensive to refetch — cache-first keeps repeat views fast
            // and available offline without re-downloading every time.
            urlPattern: ({ url }) => /\/api\/xrays\/\d+\/file$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'dentavault-xray-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
              // Without this, the cache key is just the URL — so a dentist
              // opening /api/xrays/9/file and a *different* logged-in
              // patient opening the same URL later on the same device would
              // share one cache entry, and the patient could be served the
              // dentist's cached (and possibly RBAC-forbidden) response
              // instead of a fresh, correctly-scoped one. Folding a hash of
              // the Authorization header into the key keeps every signed-in
              // identity's cache separate, on top of the server-side RBAC
              // check that gates the real fetch.
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const auth = request.headers.get('Authorization') || 'anon'
                    let hash = 0
                    for (let i = 0; i < auth.length; i++) hash = (hash * 31 + auth.charCodeAt(i)) | 0
                    const url = new URL(request.url)
                    url.searchParams.set('__u', String(hash))
                    return url.toString()
                  },
                },
              ],
            },
          },
          {
            // Patient/treatment/chart JSON: try the network first (data
            // must be current when online), fall back to the last-seen
            // response when the clinic's connection drops — this is the
            // "offline access to patient records" requirement.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/auth/') &&
              request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dentavault-api-data',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
              // Same per-identity cache-key scoping as the X-ray image rule
              // above — otherwise a slow/offline network moment could fall
              // back to another signed-in user's cached patient JSON.
              plugins: [
                {
                  cacheKeyWillBeUsed: async ({ request }) => {
                    const auth = request.headers.get('Authorization') || 'anon'
                    let hash = 0
                    for (let i = 0; i < auth.length; i++) hash = (hash * 31 + auth.charCodeAt(i)) | 0
                    const url = new URL(request.url)
                    url.searchParams.set('__u', String(hash))
                    return url.toString()
                  },
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  build: {
    // Never publish source maps: they would hand the original, readable
    // source to anyone who opens DevTools. (Vite's default is already off;
    // this keeps it off on purpose.)
    sourcemap: false,
    rolldownOptions: {
      output: {
        // Hash-only filenames sorted into folders by type, so DevTools shows
        // `assets/js/a1B2c3D4.js` instead of `assets/LoginPage-a1B2c3D4.js`
        // and the build doesn't advertise every page/feature by name.
        // Frontend JS can't be hidden from the browser that runs it; the real
        // protection stays on the server (auth, role and record access checks).
        entryFileNames: 'assets/js/[hash].js',
        chunkFileNames: 'assets/js/[hash].js',
        assetFileNames: (asset) => {
          const name = asset.names?.[0] ?? ''
          if (name.endsWith('.css')) return 'assets/css/[hash][extname]'
          if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/i.test(name)) return 'assets/images/[hash][extname]'
          if (/\.(glb|gltf)$/i.test(name)) return 'assets/models/[hash][extname]'
          if (/\.(woff2?|ttf|otf)$/i.test(name)) return 'assets/fonts/[hash][extname]'
          return 'assets/[hash][extname]'
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
