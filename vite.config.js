import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
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
  plugins: [react(), imageProxyPlugin()],
});
