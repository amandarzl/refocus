// Adobe Color Swatch (.aco) binary file generator
// Supports version 1 and version 2 formats for broad compatibility

/**
 * Convert hex color to RGB values
 * @param {string} hex - Color in #RRGGBB format
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Create an Adobe Color Swatch (.aco) binary file from an array of hex colors.
 * Uses pure Version 1 format with strict Big-Endian encoding for Photoshop compatibility.
 *
 * @param {string[]} hexColors - Array of hex color strings (#RRGGBB)
 * @param {string} [filename="palette.aco"] - Download filename
 */
export function exportAco(hexColors, filename = "palette.aco") {
  if (!Array.isArray(hexColors) || hexColors.length === 0) {
    console.warn("No colors provided for .aco export");
    return;
  }

  // Validate and convert colors
  const colors = hexColors.map(hexToRgb).filter((c) => c !== null);
  if (colors.length === 0) {
    console.warn("No valid colors for .aco export");
    return;
  }

  // Adobe Color Swatch Version 1 binary layout
  // Header: 4 bytes (2 bytes version signature + 2 bytes color count)
  // Color record: 10 bytes each
  //   2 bytes: color space (0x0000 = RGB)
  //   2 bytes: red (R << 8) | R
  //   2 bytes: green (G << 8) | G
  //   2 bytes: blue (B << 8) | B
  //   2 bytes: padding (0x0000)
  // Total size: 4 + (count * 10)
  const totalSize = 4 + colors.length * 10;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;

  // Write Version 1 signature
  view.setUint16(offset, 1, false); // big-endian
  offset += 2;
  // Write color count
  view.setUint16(offset, colors.length, false);
  offset += 2;

  // Write each color record (10 bytes)
  for (const color of colors) {
    // Color space: 0x0000 = RGB
    view.setUint16(offset, 0, false);
    offset += 2;
    // Red: (R << 8) | R
    view.setUint16(offset, (color.r << 8) | color.r, false);
    offset += 2;
    // Green: (G << 8) | G
    view.setUint16(offset, (color.g << 8) | color.g, false);
    offset += 2;
    // Blue: (B << 8) | B
    view.setUint16(offset, (color.b << 8) | color.b, false);
    offset += 2;
    // Padding: 0x0000
    view.setUint16(offset, 0, false);
    offset += 2;
  }

  // Create blob and trigger download
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Cleanup
  URL.revokeObjectURL(url);
}
