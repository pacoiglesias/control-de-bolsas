// vite.config.ts
import { defineConfig } from "file:///sessions/happy-affectionate-lamport/mnt/CONTROL%20%20FACTURAS%20PROVIDENCIA/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/happy-affectionate-lamport/mnt/CONTROL%20%20FACTURAS%20PROVIDENCIA/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///sessions/happy-affectionate-lamport/mnt/CONTROL%20%20FACTURAS%20PROVIDENCIA/node_modules/vite-plugin-pwa/dist/index.js";

// package.json
var package_default = {
  name: "control-bolsas-v7",
  private: true,
  version: "7.0.9",
  type: "module",
  description: "ERP Control Bolsas \u2014 Master Track. React + Vite + Firebase.",
  scripts: {
    dev: "vite",
    build: "tsc -b && vite build && npm --prefix functions run build",
    preview: "vite preview",
    typecheck: "tsc --noEmit",
    deploy: "npm run build && firebase deploy",
    lint: "eslint .",
    test: "vitest run",
    "test:watch": "vitest"
  },
  dependencies: {
    "@types/file-saver": "^2.0.7",
    "canvas-confetti": "^1.9.4",
    "decimal.js-light": "^2.5.1",
    "file-saver": "^2.0.5",
    firebase: "^11.10.0",
    "framer-motion": "^12.43.0",
    "html2pdf.js": "^0.14.0",
    jszip: "^3.10.1",
    "pdfjs-dist": "^3.11.174",
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "react-firebase-hooks": "^5.1.1",
    "react-hot-toast": "^2.6.0",
    "react-router-dom": "^7.18.2",
    recharts: "^3.10.1",
    xlsx: "^0.18.5"
  },
  devDependencies: {
    "@eslint/js": "^9.39.5",
    "@types/canvas-confetti": "^1.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    eslint: "^9.39.5",
    "eslint-plugin-react-hooks": "^5.2.0",
    globals: "^15.15.0",
    jsdom: "^29.1.1",
    typescript: "^5.6.3",
    "typescript-eslint": "^8.65.0",
    vite: "^5.4.11",
    "vite-plugin-pwa": "^1.3.0",
    vitest: "^2.1.9"
  }
};

// vite.config.ts
var vite_config_default = defineConfig({
  define: {
    __BUILD_DATE__: JSON.stringify((/* @__PURE__ */ new Date()).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })),
    // Version REAL de package.json, inyectada en tiempo de build. Antes
    // Layout.tsx y el modal "Bitacora Historica" en Dashboard.tsx tenian la
    // version escrita a mano en dos (y hasta tres) lugares distintos, y se
    // desincronizaban en cuanto se subia una version sin acordarse de tocar
    // las tres. Con esto solo hay un lugar donde vive el numero: package.json.
    __APP_VERSION__: JSON.stringify(package_default.version)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      manifest: {
        name: "Control Bolsas ERP",
        short_name: "ERP Providencia",
        description: "ERP de Control de Bolsas y Facturaci\xF3n",
        theme_color: "#09090b",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    })
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        // El SDK de Firebase pesa; separarlo deja que el navegador lo cachee
        // entre despliegues en vez de volver a bajarlo con cada cambio de UI.
        manualChunks: {
          firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage"],
          react: ["react", "react-dom", "react-router-dom"]
        }
      }
    }
  },
  server: { port: 5173, open: true }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL2hhcHB5LWFmZmVjdGlvbmF0ZS1sYW1wb3J0L21udC9DT05UUk9MICBGQUNUVVJBUyBQUk9WSURFTkNJQVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2hhcHB5LWFmZmVjdGlvbmF0ZS1sYW1wb3J0L21udC9DT05UUk9MICBGQUNUVVJBUyBQUk9WSURFTkNJQS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvaGFwcHktYWZmZWN0aW9uYXRlLWxhbXBvcnQvbW50L0NPTlRST0wlMjAlMjBGQUNUVVJBUyUyMFBST1ZJREVOQ0lBL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5pbXBvcnQgcGtnIGZyb20gJy4vcGFja2FnZS5qc29uJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgZGVmaW5lOiB7XG4gICAgX19CVUlMRF9EQVRFX186IEpTT04uc3RyaW5naWZ5KG5ldyBEYXRlKCkudG9Mb2NhbGVTdHJpbmcoJ2VzLU1YJywgeyBkYXRlU3R5bGU6ICdzaG9ydCcsIHRpbWVTdHlsZTogJ3Nob3J0JyB9KSksXG4gICAgLy8gVmVyc2lvbiBSRUFMIGRlIHBhY2thZ2UuanNvbiwgaW55ZWN0YWRhIGVuIHRpZW1wbyBkZSBidWlsZC4gQW50ZXNcbiAgICAvLyBMYXlvdXQudHN4IHkgZWwgbW9kYWwgXCJCaXRhY29yYSBIaXN0b3JpY2FcIiBlbiBEYXNoYm9hcmQudHN4IHRlbmlhbiBsYVxuICAgIC8vIHZlcnNpb24gZXNjcml0YSBhIG1hbm8gZW4gZG9zICh5IGhhc3RhIHRyZXMpIGx1Z2FyZXMgZGlzdGludG9zLCB5IHNlXG4gICAgLy8gZGVzaW5jcm9uaXphYmFuIGVuIGN1YW50byBzZSBzdWJpYSB1bmEgdmVyc2lvbiBzaW4gYWNvcmRhcnNlIGRlIHRvY2FyXG4gICAgLy8gbGFzIHRyZXMuIENvbiBlc3RvIHNvbG8gaGF5IHVuIGx1Z2FyIGRvbmRlIHZpdmUgZWwgbnVtZXJvOiBwYWNrYWdlLmpzb24uXG4gICAgX19BUFBfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShwa2cudmVyc2lvbiksXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAncHJvbXB0JyxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnbWFza2VkLWljb24uc3ZnJ10sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnQ29udHJvbCBCb2xzYXMgRVJQJyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ0VSUCBQcm92aWRlbmNpYScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRVJQIGRlIENvbnRyb2wgZGUgQm9sc2FzIHkgRmFjdHVyYWNpXHUwMEYzbicsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzA5MDkwYicsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZmZmZmZmJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnfSddLFxuICAgICAgfVxuICAgIH0pXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIEVsIFNESyBkZSBGaXJlYmFzZSBwZXNhOyBzZXBhcmFybG8gZGVqYSBxdWUgZWwgbmF2ZWdhZG9yIGxvIGNhY2hlZVxuICAgICAgICAvLyBlbnRyZSBkZXNwbGllZ3VlcyBlbiB2ZXogZGUgdm9sdmVyIGEgYmFqYXJsbyBjb24gY2FkYSBjYW1iaW8gZGUgVUkuXG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIGZpcmViYXNlOiBbJ2ZpcmViYXNlL2FwcCcsICdmaXJlYmFzZS9hdXRoJywgJ2ZpcmViYXNlL2ZpcmVzdG9yZScsICdmaXJlYmFzZS9zdG9yYWdlJ10sXG4gICAgICAgICAgcmVhY3Q6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7IHBvcnQ6IDUxNzMsIG9wZW46IHRydWUgfSxcbn0pO1xuIiwgIntcclxuICBcIm5hbWVcIjogXCJjb250cm9sLWJvbHNhcy12N1wiLFxyXG4gIFwicHJpdmF0ZVwiOiB0cnVlLFxyXG4gIFwidmVyc2lvblwiOiBcIjcuMC45XCIsXHJcbiAgXCJ0eXBlXCI6IFwibW9kdWxlXCIsXHJcbiAgXCJkZXNjcmlwdGlvblwiOiBcIkVSUCBDb250cm9sIEJvbHNhcyBcdTIwMTQgTWFzdGVyIFRyYWNrLiBSZWFjdCArIFZpdGUgKyBGaXJlYmFzZS5cIixcclxuICBcInNjcmlwdHNcIjoge1xyXG4gICAgXCJkZXZcIjogXCJ2aXRlXCIsXHJcbiAgICBcImJ1aWxkXCI6IFwidHNjIC1iICYmIHZpdGUgYnVpbGQgJiYgbnBtIC0tcHJlZml4IGZ1bmN0aW9ucyBydW4gYnVpbGRcIixcclxuICAgIFwicHJldmlld1wiOiBcInZpdGUgcHJldmlld1wiLFxyXG4gICAgXCJ0eXBlY2hlY2tcIjogXCJ0c2MgLS1ub0VtaXRcIixcclxuICAgIFwiZGVwbG95XCI6IFwibnBtIHJ1biBidWlsZCAmJiBmaXJlYmFzZSBkZXBsb3lcIixcclxuICAgIFwibGludFwiOiBcImVzbGludCAuXCIsXHJcbiAgICBcInRlc3RcIjogXCJ2aXRlc3QgcnVuXCIsXHJcbiAgICBcInRlc3Q6d2F0Y2hcIjogXCJ2aXRlc3RcIlxyXG4gIH0sXHJcbiAgXCJkZXBlbmRlbmNpZXNcIjoge1xyXG4gICAgXCJAdHlwZXMvZmlsZS1zYXZlclwiOiBcIl4yLjAuN1wiLFxyXG4gICAgXCJjYW52YXMtY29uZmV0dGlcIjogXCJeMS45LjRcIixcclxuICAgIFwiZGVjaW1hbC5qcy1saWdodFwiOiBcIl4yLjUuMVwiLFxyXG4gICAgXCJmaWxlLXNhdmVyXCI6IFwiXjIuMC41XCIsXHJcbiAgICBcImZpcmViYXNlXCI6IFwiXjExLjEwLjBcIixcclxuICAgIFwiZnJhbWVyLW1vdGlvblwiOiBcIl4xMi40My4wXCIsXHJcbiAgICBcImh0bWwycGRmLmpzXCI6IFwiXjAuMTQuMFwiLFxyXG4gICAgXCJqc3ppcFwiOiBcIl4zLjEwLjFcIixcclxuICAgIFwicGRmanMtZGlzdFwiOiBcIl4zLjExLjE3NFwiLFxyXG4gICAgXCJyZWFjdFwiOiBcIl4xOC4zLjFcIixcclxuICAgIFwicmVhY3QtZG9tXCI6IFwiXjE4LjMuMVwiLFxyXG4gICAgXCJyZWFjdC1maXJlYmFzZS1ob29rc1wiOiBcIl41LjEuMVwiLFxyXG4gICAgXCJyZWFjdC1ob3QtdG9hc3RcIjogXCJeMi42LjBcIixcclxuICAgIFwicmVhY3Qtcm91dGVyLWRvbVwiOiBcIl43LjE4LjJcIixcclxuICAgIFwicmVjaGFydHNcIjogXCJeMy4xMC4xXCIsXHJcbiAgICBcInhsc3hcIjogXCJeMC4xOC41XCJcclxuICB9LFxyXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQGVzbGludC9qc1wiOiBcIl45LjM5LjVcIixcclxuICAgIFwiQHR5cGVzL2NhbnZhcy1jb25mZXR0aVwiOiBcIl4xLjkuMFwiLFxyXG4gICAgXCJAdHlwZXMvcmVhY3RcIjogXCJeMTguMy4xMlwiLFxyXG4gICAgXCJAdHlwZXMvcmVhY3QtZG9tXCI6IFwiXjE4LjMuMVwiLFxyXG4gICAgXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiOiBcIl40LjMuNFwiLFxyXG4gICAgXCJlc2xpbnRcIjogXCJeOS4zOS41XCIsXHJcbiAgICBcImVzbGludC1wbHVnaW4tcmVhY3QtaG9va3NcIjogXCJeNS4yLjBcIixcclxuICAgIFwiZ2xvYmFsc1wiOiBcIl4xNS4xNS4wXCIsXHJcbiAgICBcImpzZG9tXCI6IFwiXjI5LjEuMVwiLFxyXG4gICAgXCJ0eXBlc2NyaXB0XCI6IFwiXjUuNi4zXCIsXHJcbiAgICBcInR5cGVzY3JpcHQtZXNsaW50XCI6IFwiXjguNjUuMFwiLFxyXG4gICAgXCJ2aXRlXCI6IFwiXjUuNC4xMVwiLFxyXG4gICAgXCJ2aXRlLXBsdWdpbi1wd2FcIjogXCJeMS4zLjBcIixcclxuICAgIFwidml0ZXN0XCI6IFwiXjIuMS45XCJcclxuICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwWSxTQUFTLG9CQUFvQjtBQUN2YSxPQUFP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
