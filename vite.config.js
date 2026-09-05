import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fetchImageFromUrl } from "./src/server/imageProxy.js";

// Mounts the Pinterest/URL image proxy directly on the Vite dev server, so
// "npm run dev" alone is enough — no second `node server.js` process to
// remember to start. (Only relevant in dev: the built app is static and
// has no backend, same as before.)
function imageProxyPlugin() {
  return {
    name: "image-proxy",
    configureServer(server) {
      server.middlewares.use("/api/proxy-image", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const { url } = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");

          if (!url) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: "URL required" }));
            return;
          }

          console.log("Fetching:", url);
          const image = await fetchImageFromUrl(url);

          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              success: true,
              data: image.buffer.toString("base64"),
              type: image.mimeType,
              filename:
                image.url.split("/").pop() ||
                `image${image.mimeType.includes("png") ? ".png" : ".jpg"}`,
            }),
          );
        } catch (err) {
          console.error("Proxy error:", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    imageProxyPlugin(),
    // Everything the app needs is already client-side (Dexie/IndexedDB) —
    // this is what turns that into an installable, fully offline app: a
    // manifest for the home-screen icon + standalone window, and a
    // Workbox-generated service worker that precaches the build output.
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ReFocus",
        short_name: "ReFocus",
        description: "Reference-image board for artists, built to prevent burnout.",
        display: "standalone",
        start_url: "/",
        scope: "/",
        // The app's dark-mode --color-surface-canvas (index.html's default
        // data-theme) — see src/index.css.
        theme_color: "#1A1A1A",
        background_color: "#1A1A1A",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // The one external dependency the app has (same-origin build
        // output is precached by Workbox automatically) — cached so the
        // fonts still render after the first load, offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
