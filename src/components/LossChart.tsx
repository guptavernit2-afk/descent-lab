import { OPTIMIZERS, type OptimizerRun } from '../lib/engine';
import { useEffect, useRef, useState } from 'react';

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0.000';
  if (Math.abs(value) < 0.001 || Math.abs(value) >= 10000) return value.toExponential(2);
  return value.toFixed(3);
}

export default function LossChart({
  runs,
  step,
  budget,
  logarithmic,
}: {
  runs: OptimizerRun[];
  step: number;
  budget: number;
  logarithmic: boolean;
}) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    const svg = chartRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const height = 200,
    left = 53,
    right = 20,
    top = 16,
    bottom = 29;
  const transform = (loss: number) =>
    logarithmic ? Math.sign(loss) * Math.log10(1 + Math.abs(loss)) : loss;
  const values = runs.flatMap((run) =>
    run.points.filter((p) => p.step <= step).map((p) => transform(p.loss)),
  );
  let min = Math.min(0, ...values),
    max = Math.max(0.1, ...values);
  if (max === min) max = min + 1;
  const padding = (max - min) * 0.08;
  min -= padding;
  max += padding;
  const x = (n: number) => left + (n / budget) * (width - left - right);
  const y = (n: number) =>
    height - bottom - ((transform(n) - min) / (max - min)) * (height - top - bottom);
  const inverse = (n: number) => (logarithmic ? Math.sign(n) * (10 ** Math.abs(n) - 1) : n);
  return (
    <svg
      ref={chartRef}
      className="loss-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Loss history through iteration ${step}. ${logarithmic ? 'Signed log scale' : 'Linear scale'}. Exact current losses are in the comparison table.`}
    >
      {[0, 1, 2, 3].map((i) => {
        const v = min + ((max - min) * i) / 3;
        const py = height - bottom - (i / 3) * (height - top - bottom);
        return (
          <g key={i}>
            <line
              x1={left}
              x2={width - right}
              y1={py}
              y2={py}
              stroke="#e9ede8"
              strokeDasharray="3 5"
            />
            <text x={left - 10} y={py + 4} textAnchor="end">
              {formatNumber(inverse(v))}
            </text>
          </g>
        );
      })}
      {[0, 1, 2, 3, 4].map((i) => (
        <text key={i} x={x((budget * i) / 4)} y={height - 7} textAnchor="middle">
          {Math.round((budget * i) / 4)}
        </text>
      ))}
      {runs.map((run) => {
        const points = run.points.filter((p) => p.step <= step);
        const stride = Math.max(1, Math.floor(points.length / 500));
        const sampled = points.filter((_, i) => i % stride === 0 || i === points.length - 1);
        const color = OPTIMIZERS.find((o) => o.id === run.id)!.color;
        return (
          <g key={run.id}>
            <path
              d={sampled
                .map((p, i) => `${i ? 'L' : 'M'}${x(p.step).toFixed(2)},${y(p.loss).toFixed(2)}`)
                .join(' ')}
              fill="none"
              stroke={color}
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.length > 0 && (
              <circle cx={x(points.at(-1)!.step)} cy={y(points.at(-1)!.loss)} r="3" fill={color} />
            )}
          </g>
        );
      })}
      {step === 0 && (
        <text className="chart-empty" x={(left + width - right) / 2} y="86" textAnchor="middle">
          <tspan>Run an experiment.</tspan>
          <tspan x={(left + width - right) / 2} dy="19">
            Watch the story unfold.
          </tspan>
        </text>
      )}
    </svg>
  );
}
