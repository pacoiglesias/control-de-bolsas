import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

export default defineConfig(({ mode }) => {
  // Carga las variables del archivo .env.<mode> correspondiente.
  // Con prefix '' se obtienen TODAS las variables (incluyendo las sin VITE_).
  const env = loadEnv(mode, process.cwd(), '');

  return {
  define: {
    __BUILD_DATE__: JSON.stringify(new Date().toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })),
    // Version REAL de package.json, inyectada en tiempo de build. Antes
    // Layout.tsx y el modal "Bitacora Historica" en Dashboard.tsx tenian la
    // version escrita a mano en dos (y hasta tres) lugares distintos, y se
    // desincronizaban en cuanto se subia una version sin acordarse de tocar
    // las tres. Con esto solo hay un lugar donde vive el numero: package.json.
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Entorno activo — disponible en runtime como import.meta.env.VITE_ENV
    // sin necesidad de usar import.meta.env directamente en cada componente.
    'import.meta.env.VITE_ENV': JSON.stringify(env.VITE_ENV ?? mode),
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Control Bolsas ERP',
        short_name: 'ERP Providencia',
        description: 'ERP de Control de Bolsas y Facturación',
        lang: 'es-MX',
        start_url: '/',
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
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase/app') || id.includes('firebase/auth')) return 'firebase-core';
            if (id.includes('firebase/firestore')) return 'firebase-firestore';
            if (id.includes('firebase/storage')) return 'firebase-storage';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('xlsx')) return 'excel';
            if (id.includes('html2pdf.js')) return 'pdf';
            if (id.includes('jspdf')) return 'jspdf';
            if (id.includes('pdfjs-dist')) return 'pdfjs';
            if (id.includes('tesseract.js')) return 'tesseract';
            if (id.includes('jszip')) return 'archive';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          }
        },
      },
    },
  },
  server: { port: 5173, open: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      // Cobertura enfocada en la lógica de negocio pura en src/lib/.
      // Se excluyen:
      //   a) Generadores de PDF/Excel/HTML — dependen de libs de renderizado
      //      (pdfmake, xlsx, html) que no se pueden instanciar en Node puro.
      //   b) Archivos con deps de Firebase/DOM/Browser APIs.
      //   c) Archivos de datos (seedData, constants) sin lógica propia.
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/**/*.d.ts',
        'src/lib/__tests__/**',
        // ── Generadores PDF/Excel/HTML (no testeables en Node sin mocks complejos) ──
        'src/lib/andresReceiptPdf.ts',
        'src/lib/andresStatementPdf.ts',
        'src/lib/deliveryRemissionPdf.ts',
        'src/lib/netProfitReportPdf.ts',
        'src/lib/providenciaStatementPdf.ts',
        'src/lib/executiveOnePagerPdf.ts',
        'src/lib/cfdiXmlGenerator.ts',
        'src/lib/prefacturaGenerator.ts',
        'src/lib/export.ts',
        'src/lib/exportOfflineHTML.ts',
        'src/lib/importExcel.ts',
        // ── Dependencias de Firebase/DOM/Browser ──
        'src/lib/bridge.ts',
        'src/lib/cloudBackup.ts',
        'src/lib/logger.ts',
        'src/lib/ocr.ts',
        'src/lib/offlineQueue.ts',
        'src/lib/offlineMaquilaDb.ts',
        'src/lib/confirmDialog.tsx',
        'src/lib/promptDialog.tsx',
        // ── Datos puros / sin lógica testeable ──
        'src/lib/seedData.ts',
        'src/lib/confetti.ts',
        'src/lib/soundEffects.ts',
        'src/lib/sounds.ts',
        'src/lib/systemChangelog.ts',
        'src/lib/constants.ts',
        // ── Mirrors de Firestore (sin lógica propia) ──
        'src/lib/fillInvoicesMirror.ts',
        'src/lib/invoicesMirror.ts',
        'src/lib/whatsappReminder.ts',
      ],
      thresholds: {
        // Umbrales basados en la cobertura real con los 148 tests actuales.
        // Candidatos a mejorar en próximos sprints:
        //   - deliveries.ts (45%) — lógica de entregas físicas
        //   - format.ts (43%) — formateo de monedas/fechas
        //   - hapticEngine.ts (25%) — vibración / notificaciones
        //   - autoHealEngine.ts (51%) — auto-reparación de datos
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 50,
      },
    },
  },


  }; // cierre de return
}); // cierre de defineConfig
