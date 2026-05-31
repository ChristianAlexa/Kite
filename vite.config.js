import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves under /<repo>/; root hosts (Vercel/Netlify) and local dev
// stay at /. The CI Pages workflow sets GITHUB_PAGES=true.
const base = process.env.GITHUB_PAGES ? '/Kite/' : '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['kite.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Kite — When can I fly?',
        short_name: 'Kite',
        description: 'Kite-flying weather windows for the next 7 days.',
        theme_color: '#0ea5e9',
        background_color: '#f0f9ff',
        display: 'standalone',
        start_url: base,
        scope: base,
        // Relative paths resolve against the manifest URL, so they're correct
        // under both / and /Kite/ without double-prefixing the base.
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(api|geocoding-api)\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
})
