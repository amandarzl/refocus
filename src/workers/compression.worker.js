// Web Worker for off-thread image compression and palette extraction
// Uses OffscreenCanvas for resizing + WebP encoding

const MAX_DIMENSION = 800;
const WEBP_QUALITY = 0.75;

// Quantize RGB to reduce color space for palette extraction
function quantizeColor(r, g, b) {
  const step = 32; // 8 levels per channel = 512 buckets
  return (
    (Math.floor(r / step) * step) |
    0 |
    (((Math.floor(g / step) * step) | 0) << 8) |
    (((Math.floor(b / step) * step) | 0) << 16)
  );
}

// Extract top N dominant colors from ImageData
function extractPaletteFromData(imageData, colorCount = 5) {
  const { data, width, height } = imageData;
  const buckets = new Map();
  const stride = Math.max(1, Math.floor((width * height) / 10000)); // sample ~10k pixels

  for (let i = 0; i < data.length; i += 4 * stride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Skip transparent or near-transparent pixels
    if (a < 128) continue;

    const key = quantizeColor(r, g, b);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  // Sort by frequency, take top N
  const sorted = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, colorCount * 3); // get extra in case we need to deduplicate

  const palette = [];
  const seen = new Set();

  for (const [key] of sorted) {
    if (palette.length >= colorCount) break;

    const r = key & 0xff;
    const g = (key >> 8) & 0xff;
    const b = (key >> 16) & 0xff;

    // Round to nearest multiple of step for cleaner colors
    const step = 32;
    const rr = Math.min(255, Math.round(r / step) * step);
    const gg = Math.min(255, Math.round(g / step) * step);
    const bb = Math.min(255, Math.round(b / step) * step);

    const hex =
      "#" +
      rr.toString(16).padStart(2, "0") +
      gg.toString(16).padStart(2, "0") +
      bb.toString(16).padStart(2, "0");

    if (!seen.has(hex)) {
      seen.add(hex);
      palette.push(hex);
    }
  }

  return palette;
}

// Resize using OffscreenCanvas and return WebP blob
async function compressImage(file, extractPalette = false) {
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Calculate new dimensions maintaining aspect ratio
    if (width > height) {
      if (width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      }
    } else {
      if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }

    // Use OffscreenCanvas if available
    let canvas;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(width, height);
    } else if (typeof self.OffscreenCanvas !== "undefined") {
      canvas = new self.OffscreenCanvas(width, height);
    } else {
      throw new Error("OffscreenCanvas not available");
    }

    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: "image/webp",
      quality: WEBP_QUALITY,
    });

    let palette = [];
    if (extractPalette) {
      // Extract palette from the resized image
      const imageData = ctx.getImageData(0, 0, width, height);
      palette = extractPaletteFromData(imageData, 5);
    }

    return { blob, width, height, palette };
  } catch (err) {
    console.error("Worker compression failed:", err);
    throw err;
  }
}

// Handle messages from main thread
self.onmessage = async (e) => {
  const { id, file, extractPalette = false } = e.data;

  try {
    const result = await compressImage(file, extractPalette);

    // Convert blob to ArrayBuffer for transfer
    const arrayBuffer = await result.blob.arrayBuffer();
    self.postMessage(
      {
        id,
        success: true,
        blob: arrayBuffer,
        mimeType: result.blob.type,
        width: result.width,
        height: result.height,
        palette: result.palette,
      },
      [arrayBuffer],
    );
  } catch (err) {
    self.postMessage({
      id,
      success: false,
      error: err.message || "Compression failed",
    });
  }
};
