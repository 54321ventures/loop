import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      workbox: { navigateFallbackDenylist: [/^\/api\//], globPatterns: ["**/*.{js,css,html,svg,png}"] },
      manifest: {
        name: "Loop", short_name: "Loop", description: "A calm wellness companion",
        theme_color: "#0E1020", background_color: "#0E1020", display: "standalone", start_url: "/",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
});
