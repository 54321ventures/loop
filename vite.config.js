import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["loop-icon.svg", "loop-favicon-48.png", "loop-touch-icon.png"],
      workbox: { navigateFallbackDenylist: [/^\/api\//], globPatterns: ["**/*.{js,css,html,svg,png}"] },
      manifest: {
        name: "Loop", short_name: "Loop", description: "A calm wellness companion",
        theme_color: "#0E1020", background_color: "#0E1020", display: "standalone", start_url: "/",
        icons: [
          { src: "loop-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "loop-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "loop-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
});
