/**
 * Rotasi gambar 90° searah jarum jam.
 *
 * Dipakai di pemindai supaya operator bisa membetulkan orientasi dokumen yang
 * terfoto menyamping sebelum dipotong.
 */
export function rotate90(image: ImageData): ImageData {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(width * height * 4);
  const newWidth = height;
  const newHeight = width;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;

      // Rotasi 90° CW: (x, y) → (newWidth - 1 - y, x)
      const nx = newWidth - 1 - y;
      const ny = x;
      const dstIdx = (ny * newWidth + nx) * 4;

      out[dstIdx] = data[srcIdx];
      out[dstIdx + 1] = data[srcIdx + 1];
      out[dstIdx + 2] = data[srcIdx + 2];
      out[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return new ImageData(out, newWidth, newHeight);
}
