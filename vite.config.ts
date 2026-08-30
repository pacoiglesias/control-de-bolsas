import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })),
    // Version REAL de package.json, inyectada en tiempo de build. Antes
    // Layout.tsx y el modal "Bitacora Historica" en Dashboard.tsx tenian la
    // version escrita a mano en dos (y hasta tres) lugares distintos, y se
    // desincronizaban en cuanto se subia una version sin acordarse de tocar
    // las tres. Con esto solo hay un lugar donde vive el numero: package.json.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // FIX (v8.9.0): 'masked-icon.svg' se listaba aqui pero el archivo nunca
      // existio en public/ -- referencia muerta desde el template original.
      // 'favicon.ico' antes tampoco existia (index.html apuntaba directo a
      // /logo.png); ahora si existe, generado a partir del logo real.
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Control Bolsas ERP',
        short_name: 'ERP Providencia',
        description: 'ERP de Control de Bolsas y Facturación',
        theme_color: '#09090b',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      }
    })
  ],
  build: {
    outDir: 'dist',
    sourcemap: 'hidden', // genera .map para debugging pero no los expone en el bundle
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // El SDK de Firebase pesa; separarlo deja que el navegador lo cachee
        // entre despliegues en vez de volver a bajarlo con cada cambio de UI.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          excel: ['xlsx'],
          pdf: ['html2pdf.js'],
        },
      },
    },
  },
  server: { port: 5173, open: true },
});
