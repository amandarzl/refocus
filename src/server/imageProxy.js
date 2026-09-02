import fetch from "node-fetch";

// Fetches an external image (direct CDN URL, or a Pinterest/webpage URL we
// resolve to one) server-side, so pages that block direct cross-origin
// fetches from the browser (Pinterest chief among them) still work. Kept
// framework-agnostic — no Express/CORS here — so it can be mounted either
// as Vite dev-server middleware (see vite.config.js) or run standalone via
// server.js.
function isLikelyImageUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();

    return (
      /\.(png|jpe?g|webp|gif|avif|bmp|svg|heic|heif)(\?.*)?$/i.test(pathname) ||
      /i\.pinimg\.com|s\.pinimg\.com|assets\.pinterest\.com|pinimg\.com/i.test(
        parsed.hostname,
      )
    );
  } catch {
    return false;
  }
}

function normalizeImageCandidate(value) {
  if (!value) return null;

  const cleaned = String(value)
    .trim()
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&");

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractImageUrlFromHtml(html) {
  if (!html || typeof html !== "string" || !html.trim()) return null;

  // matchAll() requires a global regex or it throws — every pattern here
  // needs "g" alongside its other flags.
  const patterns = [
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/gi,
    /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/gi,
    /"image_url"\s*:\s*["']([^"']+)["']/gi,
    /"images"\s*:\s*\[.*?"url"\s*:\s*["']([^"']+)["']/gis,
    /"original"\s*:\s*["']([^"']+)["']/gi,
    /"pinImage"\s*:\s*["']([^"']+)["']/gi,
  ];

  const seen = new Set();

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const candidate = normalizeImageCandidate(match[1]);
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      if (isLikelyImageUrl(candidate)) return candidate;
    }
  }

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    const candidate = normalizeImageCandidate(imgMatch[1]);
    if (candidate && isLikelyImageUrl(candidate)) return candidate;
  }

  return null;
}

async function fetchResponseAsImage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
    redirect: "follow",
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}`);
  }

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Resolved URL is not an image: ${contentType || "unknown"}`,
    );
  }

  return {
    url: response.url || url,
    mimeType: contentType,
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

export async function fetchImageFromUrl(url) {
  const safeUrl = normalizeImageCandidate(url);
  if (!safeUrl) {
    throw new Error("Invalid URL");
  }

  if (isLikelyImageUrl(safeUrl)) {
    try {
      return await fetchResponseAsImage(safeUrl);
    } catch {
      // direct CDN URL may still fail in rare cases, so we continue to the page fallback
    }
  }

  const pageResponse = await fetch(safeUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    },
    redirect: "follow",
  });

  const contentType = pageResponse.headers.get("content-type") || "";
  if (pageResponse.ok && contentType.startsWith("image/")) {
    return await fetchResponseAsImage(pageResponse.url || safeUrl);
  }

  const html = await pageResponse.text();
  if (!html || typeof html !== "string" || !html.trim()) {
    throw new Error(`Pinterest page returned an empty response: ${safeUrl}`);
  }

  const resolvedUrl = extractImageUrlFromHtml(html);

  if (!resolvedUrl) {
    throw new Error(`URL did not resolve to an image: ${safeUrl}`);
  }

  console.log("Resolved Pinterest image URL:", resolvedUrl);

  return await fetchResponseAsImage(resolvedUrl);
}
