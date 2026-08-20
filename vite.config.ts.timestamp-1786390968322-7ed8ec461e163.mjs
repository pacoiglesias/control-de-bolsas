// vite.config.ts
import { defineConfig } from "file:///sessions/happy-affectionate-lamport/mnt/CONTROL%20%20FACTURAS%20PROVIDENCIA/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/happy-affectionate-lamport/mnt/CONTROL%20%20FACTURAS%20PROVIDENCIA/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///sessions/happy-affectionate-lamport/mnt/CONTROL%20%20FACTURAS%20PROVIDENCIA/node_modules/vite-plugin-pwa/dist/index.js";

// package.json
var package_default = {
  name: "control-bolsas-v7",
  private: true,
  version: "7.0.18",
  type: "module",
  description: "ERP Control Bolsas \u2014 Master Track. React + Vite + Firebase.",
  scripts: {
    dev: "vite",
    build: "tsc -b && vite build && npm --prefix functions run build",
    preview: "vite preview",
    typecheck: "tsc --noEmit",
    deploy: "npm run build && firebase deploy",
    "deploy:hosting": "npm run build && firebase deploy --only hosting,firestore,storage",
    "deploy:functions": "firebase deploy --only functions",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL2hhcHB5LWFmZmVjdGlvbmF0ZS1sYW1wb3J0L21udC9DT05UUk9MICBGQUNUVVJBUyBQUk9WSURFTkNJQVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2hhcHB5LWFmZmVjdGlvbmF0ZS1sYW1wb3J0L21udC9DT05UUk9MICBGQUNUVVJBUyBQUk9WSURFTkNJQS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vc2Vzc2lvbnMvaGFwcHktYWZmZWN0aW9uYXRlLWxhbXBvcnQvbW50L0NPTlRST0wlMjAlMjBGQUNUVVJBUyUyMFBST1ZJREVOQ0lBL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5pbXBvcnQgcGtnIGZyb20gJy4vcGFja2FnZS5qc29uJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgZGVmaW5lOiB7XG4gICAgX19CVUlMRF9EQVRFX186IEpTT04uc3RyaW5naWZ5KG5ldyBEYXRlKCkudG9Mb2NhbGVTdHJpbmcoJ2VzLU1YJywgeyBkYXRlU3R5bGU6ICdzaG9ydCcsIHRpbWVTdHlsZTogJ3Nob3J0JyB9KSksXG4gICAgLy8gVmVyc2lvbiBSRUFMIGRlIHBhY2thZ2UuanNvbiwgaW55ZWN0YWRhIGVuIHRpZW1wbyBkZSBidWlsZC4gQW50ZXNcbiAgICAvLyBMYXlvdXQudHN4IHkgZWwgbW9kYWwgXCJCaXRhY29yYSBIaXN0b3JpY2FcIiBlbiBEYXNoYm9hcmQudHN4IHRlbmlhbiBsYVxuICAgIC8vIHZlcnNpb24gZXNjcml0YSBhIG1hbm8gZW4gZG9zICh5IGhhc3RhIHRyZXMpIGx1Z2FyZXMgZGlzdGludG9zLCB5IHNlXG4gICAgLy8gZGVzaW5jcm9uaXphYmFuIGVuIGN1YW50byBzZSBzdWJpYSB1bmEgdmVyc2lvbiBzaW4gYWNvcmRhcnNlIGRlIHRvY2FyXG4gICAgLy8gbGFzIHRyZXMuIENvbiBlc3RvIHNvbG8gaGF5IHVuIGx1Z2FyIGRvbmRlIHZpdmUgZWwgbnVtZXJvOiBwYWNrYWdlLmpzb24uXG4gICAgX19BUFBfVkVSU0lPTl9fOiBKU09OLnN0cmluZ2lmeShwa2cudmVyc2lvbiksXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAncHJvbXB0JyxcbiAgICAgIGluY2x1ZGVBc3NldHM6IFsnZmF2aWNvbi5pY28nLCAnYXBwbGUtdG91Y2gtaWNvbi5wbmcnLCAnbWFza2VkLWljb24uc3ZnJ10sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnQ29udHJvbCBCb2xzYXMgRVJQJyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ0VSUCBQcm92aWRlbmNpYScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnRVJQIGRlIENvbnRyb2wgZGUgQm9sc2FzIHkgRmFjdHVyYWNpXHUwMEYzbicsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzA5MDkwYicsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6ICcjZmZmZmZmJyxcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZydcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnfSddLFxuICAgICAgfVxuICAgIH0pXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDEwMDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIEVsIFNESyBkZSBGaXJlYmFzZSBwZXNhOyBzZXBhcmFybG8gZGVqYSBxdWUgZWwgbmF2ZWdhZG9yIGxvIGNhY2hlZVxuICAgICAgICAvLyBlbnRyZSBkZXNwbGllZ3VlcyBlbiB2ZXogZGUgdm9sdmVyIGEgYmFqYXJsbyBjb24gY2FkYSBjYW1iaW8gZGUgVUkuXG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgIGZpcmViYXNlOiBbJ2ZpcmViYXNlL2FwcCcsICdmaXJlYmFzZS9hdXRoJywgJ2ZpcmViYXNlL2ZpcmVzdG9yZScsICdmaXJlYmFzZS9zdG9yYWdlJ10sXG4gICAgICAgICAgcmVhY3Q6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7IHBvcnQ6IDUxNzMsIG9wZW46IHRydWUgfSxcbn0pO1xuIiwgIntcclxuICBcIm5hbWVcIjogXCJjb250cm9sLWJvbHNhcy12N1wiLFxyXG4gIFwicHJpdmF0ZVwiOiB0cnVlLFxyXG4gIFwidmVyc2lvblwiOiBcIjcuMC4xOFwiLFxyXG4gIFwidHlwZVwiOiBcIm1vZHVsZVwiLFxyXG4gIFwiZGVzY3JpcHRpb25cIjogXCJFUlAgQ29udHJvbCBCb2xzYXMgXHUyMDE0IE1hc3RlciBUcmFjay4gUmVhY3QgKyBWaXRlICsgRmlyZWJhc2UuXCIsXHJcbiAgXCJzY3JpcHRzXCI6IHtcclxuICAgIFwiZGV2XCI6IFwidml0ZVwiLFxyXG4gICAgXCJidWlsZFwiOiBcInRzYyAtYiAmJiB2aXRlIGJ1aWxkICYmIG5wbSAtLXByZWZpeCBmdW5jdGlvbnMgcnVuIGJ1aWxkXCIsXHJcbiAgICBcInByZXZpZXdcIjogXCJ2aXRlIHByZXZpZXdcIixcclxuICAgIFwidHlwZWNoZWNrXCI6IFwidHNjIC0tbm9FbWl0XCIsXHJcbiAgICBcImRlcGxveVwiOiBcIm5wbSBydW4gYnVpbGQgJiYgZmlyZWJhc2UgZGVwbG95XCIsXHJcbiAgICBcImRlcGxveTpob3N0aW5nXCI6IFwibnBtIHJ1biBidWlsZCAmJiBmaXJlYmFzZSBkZXBsb3kgLS1vbmx5IGhvc3RpbmcsZmlyZXN0b3JlLHN0b3JhZ2VcIixcclxuICAgIFwiZGVwbG95OmZ1bmN0aW9uc1wiOiBcImZpcmViYXNlIGRlcGxveSAtLW9ubHkgZnVuY3Rpb25zXCIsXHJcbiAgICBcImxpbnRcIjogXCJlc2xpbnQgLlwiLFxyXG4gICAgXCJ0ZXN0XCI6IFwidml0ZXN0IHJ1blwiLFxyXG4gICAgXCJ0ZXN0OndhdGNoXCI6IFwidml0ZXN0XCJcclxuICB9LFxyXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQHR5cGVzL2ZpbGUtc2F2ZXJcIjogXCJeMi4wLjdcIixcclxuICAgIFwiY2FudmFzLWNvbmZldHRpXCI6IFwiXjEuOS40XCIsXHJcbiAgICBcImRlY2ltYWwuanMtbGlnaHRcIjogXCJeMi41LjFcIixcclxuICAgIFwiZmlsZS1zYXZlclwiOiBcIl4yLjAuNVwiLFxyXG4gICAgXCJmaXJlYmFzZVwiOiBcIl4xMS4xMC4wXCIsXHJcbiAgICBcImZyYW1lci1tb3Rpb25cIjogXCJeMTIuNDMuMFwiLFxyXG4gICAgXCJodG1sMnBkZi5qc1wiOiBcIl4wLjE0LjBcIixcclxuICAgIFwianN6aXBcIjogXCJeMy4xMC4xXCIsXHJcbiAgICBcInBkZmpzLWRpc3RcIjogXCJeMy4xMS4xNzRcIixcclxuICAgIFwicmVhY3RcIjogXCJeMTguMy4xXCIsXHJcbiAgICBcInJlYWN0LWRvbVwiOiBcIl4xOC4zLjFcIixcclxuICAgIFwicmVhY3QtZmlyZWJhc2UtaG9va3NcIjogXCJeNS4xLjFcIixcclxuICAgIFwicmVhY3QtaG90LXRvYXN0XCI6IFwiXjIuNi4wXCIsXHJcbiAgICBcInJlYWN0LXJvdXRlci1kb21cIjogXCJeNy4xOC4yXCIsXHJcbiAgICBcInJlY2hhcnRzXCI6IFwiXjMuMTAuMVwiLFxyXG4gICAgXCJ4bHN4XCI6IFwiXjAuMTguNVwiXHJcbiAgfSxcclxuICBcImRldkRlcGVuZGVuY2llc1wiOiB7XHJcbiAgICBcIkBlc2xpbnQvanNcIjogXCJeOS4zOS41XCIsXHJcbiAgICBcIkB0eXBlcy9jYW52YXMtY29uZmV0dGlcIjogXCJeMS45LjBcIixcclxuICAgIFwiQHR5cGVzL3JlYWN0XCI6IFwiXjE4LjMuMTJcIixcclxuICAgIFwiQHR5cGVzL3JlYWN0LWRvbVwiOiBcIl4xOC4zLjFcIixcclxuICAgIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjogXCJeNC4zLjRcIixcclxuICAgIFwiZXNsaW50XCI6IFwiXjkuMzkuNVwiLFxyXG4gICAgXCJlc2xpbnQtcGx1Z2luLXJlYWN0LWhvb2tzXCI6IFwiXjUuMi4wXCIsXHJcbiAgICBcImdsb2JhbHNcIjogXCJeMTUuMTUuMFwiLFxyXG4gICAgXCJqc2RvbVwiOiBcIl4yOS4xLjFcIixcclxuICAgIFwidHlwZXNjcmlwdFwiOiBcIl41LjYuM1wiLFxyXG4gICAgXCJ0eXBlc2NyaXB0LWVzbGludFwiOiBcIl44LjY1LjBcIixcclxuICAgIFwidml0ZVwiOiBcIl41LjQuMTFcIixcclxuICAgIFwidml0ZS1wbHVnaW4tcHdhXCI6IFwiXjEuMy4wXCIsXHJcbiAgICBcInZpdGVzdFwiOiBcIl4yLjEuOVwiXHJcbiAgfVxyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFksU0FBUyxvQkFBb0I7QUFDdmEsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTs7O0FDRnhCO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsRUFDWCxNQUFRO0FBQUEsRUFDUixhQUFlO0FBQUEsRUFDZixTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxTQUFXO0FBQUEsSUFDWCxXQUFhO0FBQUEsSUFDYixRQUFVO0FBQUEsSUFDVixrQkFBa0I7QUFBQSxJQUNsQixvQkFBb0I7QUFBQSxJQUNwQixNQUFRO0FBQUEsSUFDUixNQUFRO0FBQUEsSUFDUixjQUFjO0FBQUEsRUFDaEI7QUFBQSxFQUNBLGNBQWdCO0FBQUEsSUFDZCxxQkFBcUI7QUFBQSxJQUNyQixtQkFBbUI7QUFBQSxJQUNuQixvQkFBb0I7QUFBQSxJQUNwQixjQUFjO0FBQUEsSUFDZCxVQUFZO0FBQUEsSUFDWixpQkFBaUI7QUFBQSxJQUNqQixlQUFlO0FBQUEsSUFDZixPQUFTO0FBQUEsSUFDVCxjQUFjO0FBQUEsSUFDZCxPQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYix3QkFBd0I7QUFBQSxJQUN4QixtQkFBbUI7QUFBQSxJQUNuQixvQkFBb0I7QUFBQSxJQUNwQixVQUFZO0FBQUEsSUFDWixNQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsaUJBQW1CO0FBQUEsSUFDakIsY0FBYztBQUFBLElBQ2QsMEJBQTBCO0FBQUEsSUFDMUIsZ0JBQWdCO0FBQUEsSUFDaEIsb0JBQW9CO0FBQUEsSUFDcEIsd0JBQXdCO0FBQUEsSUFDeEIsUUFBVTtBQUFBLElBQ1YsNkJBQTZCO0FBQUEsSUFDN0IsU0FBVztBQUFBLElBQ1gsT0FBUztBQUFBLElBQ1QsWUFBYztBQUFBLElBQ2QscUJBQXFCO0FBQUEsSUFDckIsTUFBUTtBQUFBLElBQ1IsbUJBQW1CO0FBQUEsSUFDbkIsUUFBVTtBQUFBLEVBQ1o7QUFDRjs7O0FEL0NBLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFFBQVE7QUFBQSxJQUNOLGdCQUFnQixLQUFLLFdBQVUsb0JBQUksS0FBSyxHQUFFLGVBQWUsU0FBUyxFQUFFLFdBQVcsU0FBUyxXQUFXLFFBQVEsQ0FBQyxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBTTdHLGlCQUFpQixLQUFLLFVBQVUsZ0JBQUksT0FBTztBQUFBLEVBQzdDO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZUFBZSx3QkFBd0IsaUJBQWlCO0FBQUEsTUFDeEUsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsY0FBYyxDQUFDLGdDQUFnQztBQUFBLE1BQ2pEO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUE7QUFBQSxRQUdOLGNBQWM7QUFBQSxVQUNaLFVBQVUsQ0FBQyxnQkFBZ0IsaUJBQWlCLHNCQUFzQixrQkFBa0I7QUFBQSxVQUNwRixPQUFPLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFFBQ2xEO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRLEVBQUUsTUFBTSxNQUFNLE1BQU0sS0FBSztBQUNuQyxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
