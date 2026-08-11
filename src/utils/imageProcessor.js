// Image processing utility with Web Worker off-thread compression
// and main-thread fallback for unsupported browsers

let worker = null;
let workerId = 0;
const pendingRequests = new Map();

function getWorker() {
  if (worker) return worker;

  try {
    // Dynamically import the worker
    const workerUrl = new URL(
      "../workers/compression.worker.js",
      import.meta.url,
    );
    worker = new Worker(workerUrl, { type: "module" });

    worker.onmessage = (e) => {
      const { id, success, blob, mimeType, width, height, palette, error } =
        e.data;

      const resolver = pendingRequests.get(id);
      if (resolver) {
        pendingRequests.delete(id);

        if (success) {
          const blobObj = new Blob([blob], { type: mimeType });
          resolver({ success: true, blob: blobObj, width, height, palette });
        } else {
          resolver({ success: false, error });
        }
      }
    };

    worker.onerror = (err) => {
      console.error("Image worker error:", err);
      // Reject all pending requests
      for (const [id, resolver] of pendingRequests.entries()) {
        pendingRequests.delete(id);
        resolver({ success: false, error: "Worker error" });
      }
      worker = null;
    };

    return worker;
  } catch (err) {
    console.error("Failed to create image worker:", err);
    return null;
  }
}

function compressWithWorker(file, extractPalette = false) {
  return new Promise((resolve) => {
    const id = ++workerId;
    const w = getWorker();

    if (!w) {
      resolve({ success: false, error: "Worker unavailable" });
      return;
    }

    pendingRequests.set(id, resolve);
    w.postMessage({ id, file, extractPalette });
  });
}

// Main-thread fallback using canvas (updated to WebP)
function compressOnMainThread(file, extractPalette = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let palette = [];
        if (extractPalette) {
          const imageData = ctx.getImageData(0, 0, width, height);
          palette = extractPaletteFromData(imageData, 5);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ success: true, blob, width, height, palette });
            } else {
              reject(new Error("Canvas toBlob failed"));
            }
          },
          "image/webp",
          0.75,
        );
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Quantize RGB to reduce color space (same logic as worker)
function quantizeColor(r, g, b) {
  const step = 32;
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
  const stride = Math.max(1, Math.floor((width * height) / 10000));

  for (let i = 0; i < data.length; i += 4 * stride) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;

    const key = quantizeColor(r, g, b);
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const sorted = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, colorCount * 3);

  const palette = [];
  const seen = new Set();

  for (const [key] of sorted) {
    if (palette.length >= colorCount) break;

    const r = key & 0xff;
    const g = (key >> 8) & 0xff;
    const b = (key >> 16) & 0xff;

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

// Public API
export async function compressImage(file, options = {}) {
  const { extractPalette = false, preferWorker = true } = options;

  if (preferWorker) {
    try {
      const result = await compressWithWorker(file, extractPalette);
      if (result.success) return result;
    } catch (err) {
      console.warn("Worker compression failed, falling back:", err);
    }
  }

  // Fallback to main thread
  return compressOnMainThread(file, extractPalette);
}

export function revokeObjectUrl(url) {
  if (url && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

export { extractPaletteFromData };
