// Standalone version of the image proxy — not needed for normal
// `npm run dev` anymore (Vite's dev server mounts the same logic directly,
// see vite.config.js), but kept as an option for running the proxy on its
// own port/process if that's ever useful.
import express from "express";
import cors from "cors";
import { fetchImageFromUrl } from "./src/server/imageProxy.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/proxy-image", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: "URL required" });
    }

    console.log("Fetching:", url);

    const image = await fetchImageFromUrl(url);

    res.json({
      success: true,
      data: image.buffer.toString("base64"),
      type: image.mimeType,
      filename:
        image.url.split("/").pop() ||
        `image${image.mimeType.includes("png") ? ".png" : ".jpg"}`,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
