/**
 * Geometri sudut dokumen — fungsi murni (tanpa DOM/OpenCV) agar bisa diuji.
 *
 * Semua fungsi di sini bekerja pada titik dengan sistem koordinat gambar
 * (piksel), bukan koordinat layar. Konversi display↔gambar dilakukan oleh
 * komponen UI memakai helper di sini.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Urutkan 4 titik menjadi TL, TR, BR, BL (searah jarum jam dari kiri-atas).
 *
 * Titik dari `approxPolyDP` tidak dijamin urutannya. Tanpa penyeragaman,
 * hasil perspective warp bisa terbalik/terpelintir.
 *
 * Strategi: x+y terkecil = kiri-atas, terbesar = kanan-bawah; lalu beda
 * (y-x) memisahkan kanan-atas dan kiri-bawah.
 */
export function orderCorners(points: Point[]): Point[] {
  if (points.length !== 4) {
    throw new Error(`orderCorners butuh tepat 4 titik, menerima ${points.length}`);
  }

  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const topLeft = bySum[0];
  const bottomRight = bySum[3];

  const rest = points.filter((p) => p !== topLeft && p !== bottomRight);
  // y-x KECIL → kanan-atas (x besar, y kecil); y-x BESAR → kiri-bawah.
  // Urutkan menaik, sehingga elemen pertama adalah kanan-atas.
  const [topRight, bottomLeft] = rest.sort((a, b) => a.y - a.x - (b.y - b.x));

  return [topLeft, topRight, bottomRight, bottomLeft];
}

/** Jarak Euclidean antara dua titik. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Hitung ukuran (lebar × tinggi) hasil rektifikasi dari 4 sudut terurut.
 * Lebar = sisi terpanjang atas/bawah, tinggi = sisi terpanjang kiri/kanan,
 * sehingga tidak ada bagian dokumen yang terpotong.
 */
export function computeOutputSize(corners: Point[]): { width: number; height: number } {
  if (corners.length !== 4) {
    throw new Error(`computeOutputSize butuh 4 titik, menerima ${corners.length}`);
  }
  const [tl, tr, br, bl] = corners;
  const width = Math.max(distance(tl, tr), distance(bl, br));
  const height = Math.max(distance(tl, bl), distance(tr, br));

  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

/** Luas poligon segi empat (dipakai memilih kontur terbesar). */
export function quadArea(corners: Point[]): number {
  if (corners.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Penjepit (clamp) posisi titik ke dalam batas gambar.
 * Dipakai saat operasi drag/move seluruh bingkai.
 */
export function clampPoint(p: Point, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(p.x, 0), width),
    y: Math.min(Math.max(p.y, 0), height),
  };
}

/** Geser seluruh 4 sudut sejauh (dx, dy) sambil menjaga tetap di dalam gambar. */
export function translateQuad(
  corners: Point[],
  dx: number,
  dy: number,
  width: number,
  height: number,
): Point[] {
  return corners.map((p) => clampPoint({ x: p.x + dx, y: p.y + dy }, width, height));
}

/** Titik tengah empat sudut — dipakai sebagai pivot rotate. */
export function quadCenter(corners: Point[]): Point {
  const sum = corners.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / corners.length, y: sum.y / corners.length };
}

/** Batas kotak pembungkus kuadrilateral. */
export function quadBounds(corners: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/**
 * Konversi koordinat gambar → koordinat layar (persentase 0..1 terhadap
 * kotak tampilan). Dipakai untuk menaruh handle di atas gambar.
 */
export function imageToDisplay(
  p: Point,
  imageWidth: number,
  imageHeight: number,
): { xPct: number; yPct: number } {
  return {
    xPct: imageWidth > 0 ? p.x / imageWidth : 0,
    yPct: imageHeight > 0 ? p.y / imageHeight : 0,
  };
}

/** Konversi koordinat layar (0..1) → koordinat gambar. */
export function displayToImage(
  xPct: number,
  yPct: number,
  imageWidth: number,
  imageHeight: number,
): Point {
  return {
    x: clampPoint({ x: xPct * imageWidth, y: yPct * imageHeight }, imageWidth, imageHeight).x,
    y: clampPoint({ x: xPct * imageWidth, y: yPct * imageHeight }, imageWidth, imageHeight).y,
  };
}

/**
 * Sudut default saat deteksi gagal: sedikit ke dalam dari tepi gambar supaya
 * operator melihat bingkai yang bisa langsung digeser.
 */
export function defaultCorners(width: number, height: number, insetPct = 0.04): Point[] {
  const ix = width * insetPct;
  const iy = height * insetPct;
  return [
    { x: ix, y: iy },
    { x: width - ix, y: iy },
    { x: width - ix, y: height - iy },
    { x: ix, y: height - iy },
  ];
}

/** Periksa apakah kuadrilateral cukup besar & cukup persegi untuk diterima. */
export function isPlausibleQuad(
  corners: Point[],
  imageWidth: number,
  imageHeight: number,
  minAreaRatio = 0.15,
): boolean {
  if (corners.length !== 4) return false;
  const imageArea = imageWidth * imageHeight;
  if (imageArea <= 0) return false;

  const area = quadArea(corners);
  if (area / imageArea < minAreaRatio) return false;

  // Semua sudut harus di dalam gambar (dengan toleransi).
  const tolerance = 2;
  return corners.every(
    (p) =>
      p.x >= -tolerance &&
      p.y >= -tolerance &&
      p.x <= imageWidth + tolerance &&
      p.y <= imageHeight + tolerance,
  );
}
