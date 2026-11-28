import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["loop-icon.svg", "loop-favicon-48.png", "loop-touch-icon.png"],
      workbox: { navigateFallbackDenylist: [/^\/api\//], globPatterns: ["**/*.{js,css,html,svg,png}"] },
      manifest: {
        name: "Loop", short_name: "Loop", description: "A calm wellness companion",
        theme_color: "#8B7CFF", background_color: "#F4F1FF", display: "standalone", start_url: "/",
        icons: [
          { src: "loop-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "loop-icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "loop-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
    }),
  ],
});
