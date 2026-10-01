import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Point } from '../scan/cornerGeometry';

interface CornerEditorProps {
  /** URL gambar pratinjau (data URL). */
  src: string;
  /** Dimensi gambar dalam piksel (ruang koordinat sudut). */
  imageWidth: number;
  imageHeight: number;
  corners: Point[];
  onCornersChange: (corners: Point[]) => void;
  className?: string;
}

type DragTarget = { kind: 'corner'; index: number } | { kind: 'whole' } | null;

/**
 * Kanvas pengatur sudut dokumen.
 *
 * Menampilkan gambar dengan overlay poligon 4 sudut yang bisa digeser — baik
 * per-sudut maupun seluruh bingkai sekaligus. Semua koordinat disimpan dalam
 * ruang gambar (piksel), lalu dipetakan ke persentase agar hasil drag konsisten
 * di berbagai ukuran layar dan aman untuk sentuhan di HP.
 */
export function CornerEditor({
  src,
  imageWidth,
  imageHeight,
  corners,
  onCornersChange,
  className,
}: CornerEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragTarget>(null);
  const lastPointer = useRef<Point | null>(null);

  const toImagePoint = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
      const xPct = (clientX - rect.left) / rect.width;
      const yPct = (clientY - rect.top) / rect.height;
      return {
        x: Math.min(Math.max(xPct * imageWidth, 0), imageWidth),
        y: Math.min(Math.max(yPct * imageHeight, 0), imageHeight),
      };
    },
    [imageWidth, imageHeight],
  );

  const handlePointerDownCorner = (index: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({ kind: 'corner', index });
  };

  const handlePointerDownWhole = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    lastPointer.current = toImagePoint(e.clientX, e.clientY);
    setDrag({ kind: 'whole' });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toImagePoint(e.clientX, e.clientY);

    if (drag.kind === 'corner') {
      const next = corners.map((c, i) => (i === drag.index ? p : c));
      onCornersChange(next);
    } else {
      const last = lastPointer.current;
      if (!last) return;
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      const moved = corners.map((c) => ({
        x: Math.min(Math.max(c.x + dx, 0), imageWidth),
        y: Math.min(Math.max(c.y + dy, 0), imageHeight),
      }));
      lastPointer.current = p;
      onCornersChange(moved);
    }
  };

  const endDrag = () => {
    setDrag(null);
    lastPointer.current = null;
  };

  const pctX = (x: number) => (imageWidth > 0 ? (x / imageWidth) * 100 : 0);
  const pctY = (y: number) => (imageHeight > 0 ? (y / imageHeight) * 100 : 0);

  const polyPoints = corners
    .map((p) => `${pctX(p.x)},${pctY(p.y)}`)
    .join(' ');

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative select-none touch-none overflow-hidden rounded-lg bg-black',
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <img
        src={src}
        alt="Dokumen"
        draggable={false}
        className="block w-full h-auto"
        onPointerDown={handlePointerDownWhole}
      />

      {/* Overlay: area di luar dokumen digelapkan */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="scan-dim-mask">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <polygon points={polyPoints} fill="black" />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="rgba(0,0,0,0.45)"
          mask="url(#scan-dim-mask)"
        />
        <polygon points={polyPoints} fill="none" stroke="#3b82f6" strokeWidth="0.6" />
      </svg>

      {/* Handle sudut — elemen HTML agar nyaman disentuh di HP */}
      {corners.map((p, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Sudut ${i + 1}`}
          className="absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500/30 shadow-md touch-none active:bg-blue-500/60"
          style={{ left: `${pctX(p.x)}%`, top: `${pctY(p.y)}%` }}
          onPointerDown={handlePointerDownCorner(i)}
        >
          <span className="block h-2.5 w-2.5 rounded-full bg-white" />
        </button>
      ))}
    </div>
  );
}
