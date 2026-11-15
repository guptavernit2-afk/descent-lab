import type { SurfaceDefinition } from '../lib/engine';

export default function LandscapeGlyph({
  surface,
  large = false,
}: {
  surface: SurfaceDefinition;
  large?: boolean;
}) {
  const n = 12,
    [lo, hi] = surface.domain;
  const rows = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => {
      const x = lo + ((hi - lo) * i) / n,
        y = lo + ((hi - lo) * j) / n;
      return Math.asinh(surface.value(x, y));
    }),
  );
  const values = rows.flat(),
    min = Math.min(...values),
    max = Math.max(...values);
  const point = (i: number, j: number) =>
    `${40 + (i - j) * 2.5},${34 + (i + j) * 0.75 - ((rows[i][j] - min) / (max - min || 1)) * 26}`;
  return (
    <svg
      viewBox="0 0 80 60"
      className={large ? 'landscape-glyph large' : 'landscape-glyph'}
      aria-hidden="true"
    >
      {Array.from({ length: 7 }, (_, k) => k * 2).map((i) => (
        <g key={i} fill="none" stroke="currentColor" strokeWidth="0.65" opacity="0.8">
          <polyline points={Array.from({ length: n + 1 }, (_, j) => point(i, j)).join(' ')} />
          <polyline points={Array.from({ length: n + 1 }, (_, j) => point(j, i)).join(' ')} />
        </g>
      ))}
    </svg>
  );
}
