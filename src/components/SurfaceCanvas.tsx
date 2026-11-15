import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  OPTIMIZERS,
  type OptimizerRun,
  type Point,
  type SurfaceDefinition as Surface,
} from '../lib/engine';

interface SurfaceCanvasProps {
  surface: Surface;
  runs: OptimizerRun[];
  step: number;
  mode: 'surface' | 'contour';
  showTrails: boolean;
  showGrid: boolean;
  onStartChange?: (point: Point) => void;
  resetKey?: number;
}

type Vertex = Point & { height: number };
type ScreenPoint = { x: number; y: number; depth: number };
type Camera = { yaw: number; elevation: number; zoom: number };
const INITIAL_CAMERA: Camera = { yaw: -0.72, elevation: 0.6, zoom: 0.88 };
const RESOLUTION = 44;
const colors = new Map(OPTIMIZERS.map((optimizer) => [optimizer.id, optimizer.color]));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function surfaceColor(height: number, alpha = 1): string {
  const h = clamp(height, 0, 1);
  const stops = [
    [19, 68, 61],
    [31, 117, 99],
    [90, 170, 135],
    [175, 213, 167],
  ];
  const segment = Math.min(2, Math.floor(h * 3));
  const mix = h * 3 - segment;
  const rgb = stops[segment].map((channel, i) =>
    Math.round(channel + (stops[segment + 1][i] - channel) * mix),
  );
  return `rgba(${rgb.join(',')},${alpha})`;
}

function sampleSurface(surface: Surface) {
  const [low, high] = surface.domain;
  const raw: (Point & { value: number })[] = [];
  for (let j = 0; j <= RESOLUTION; j++) {
    for (let i = 0; i <= RESOLUTION; i++) {
      const x = low + (i / RESOLUTION) * (high - low);
      const y = low + (j / RESOLUTION) * (high - low);
      raw.push({ x, y, value: surface.value(x, y) });
    }
  }
  const finite = raw.map((vertex) => vertex.value).filter(Number.isFinite);
  const min = Math.min(...finite, ...surface.minima.map(({ x, y }) => surface.value(x, y)));
  const max = Math.max(...finite);
  const scale = Math.max((max - min) * 0.045, 1e-8);
  const denominator = Math.asinh((max - min) / scale) || 1;
  const heightFor = (value: number) => Math.asinh((value - min) / scale) / denominator;
  const vertices = raw.map(({ x, y, value }) => ({ x, y, height: heightFor(value) }));
  const cells: { vertices: Vertex[]; height: number }[] = [];
  for (let j = 0; j < RESOLUTION; j++) {
    for (let i = 0; i < RESOLUTION; i++) {
      const a = j * (RESOLUTION + 1) + i;
      const corners = [
        vertices[a],
        vertices[a + 1],
        vertices[a + RESOLUTION + 2],
        vertices[a + RESOLUTION + 1],
      ];
      if (corners.every((vertex) => Number.isFinite(vertex.height))) {
        cells.push({
          vertices: corners,
          height: corners.reduce((sum, v) => sum + v.height, 0) / 4,
        });
      }
    }
  }

  // Isolines are interpolated on the same sampled field as the 3D mesh.
  const contours: { from: Point; to: Point; level: number }[] = [];
  for (let band = 1; band < 15; band++) {
    const level = band / 15;
    for (const cell of cells) {
      const crossings: Point[] = [];
      for (let k = 0; k < 4; k++) {
        const a = cell.vertices[k];
        const b = cell.vertices[(k + 1) % 4];
        if (a.height < level !== b.height < level) {
          const t = (level - a.height) / (b.height - a.height);
          crossings.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
      // The cell center disambiguates four-edge crossings at saddle cells.
      if (crossings.length === 4 && cell.height < level !== cell.vertices[0].height < level) {
        contours.push(
          { from: crossings[0], to: crossings[3], level },
          { from: crossings[1], to: crossings[2], level },
        );
      } else {
        for (let k = 0; k + 1 < crossings.length; k += 2) {
          contours.push({ from: crossings[k], to: crossings[k + 1], level });
        }
      }
    }
  }
  return { vertices, cells, contours, heightFor };
}

/** Canvas is a visual projection only. Optimization always uses the original surface. */
export default function SurfaceCanvas({
  surface,
  runs,
  step,
  mode,
  showTrails,
  showGrid,
  onStartChange,
  resetKey,
}: SurfaceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 700, height: 390, pixelRatio: 1 });
  const [camera, setCamera] = useState<Camera>(INITIAL_CAMERA);
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const sampled = useMemo(() => sampleSurface(surface), [surface]);
  const heatmap = useMemo(() => {
    const image = document.createElement('canvas');
    image.width = 180;
    image.height = 180;
    const context = image.getContext('2d');
    if (!context) return image;
    const [low, high] = surface.domain;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const value = surface.value(
          low + (x / (image.width - 1)) * (high - low),
          high - (y / (image.height - 1)) * (high - low),
        );
        context.fillStyle = surfaceColor(sampled.heightFor(value));
        context.fillRect(x, y, 1, 1);
      }
    }
    return image;
  }, [surface, sampled]);

  useEffect(() => {
    setCamera(INITIAL_CAMERA);
  }, [resetKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      setSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== 'surface') return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setCamera((current) => ({
        ...current,
        zoom: clamp(current.zoom * Math.exp(-event.deltaY * 0.001), 0.65, 1.7),
      }));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, [mode]);

  // Keep the mathematical plot clear of the parent's formula, camera controls,
  // and bottom interaction hint on narrow screens as well as desktops.
  const contourRect = useCallback(
    () => ({
      left: 48,
      top: 60,
      width: Math.max(1, size.width - 98),
      height: Math.max(1, size.height - 110),
    }),
    [size],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height, pixelRatio } = size;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#102c28';
    ctx.fillRect(0, 0, width, height);
    const background = ctx.createRadialGradient(
      width * 0.5,
      height * 0.4,
      0,
      width * 0.5,
      height * 0.4,
      width * 0.6,
    );
    background.addColorStop(0, 'rgba(44,92,73,0.28)');
    background.addColorStop(1, 'rgba(10,30,27,0)');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const [low, high] = surface.domain;
    const span = high - low;
    const middle = (low + high) / 2;
    const factor = Math.min(width / 3.45, height / 2.45) * camera.zoom;
    const plot = contourRect();
    const project = (point: Point, elevation = 0): ScreenPoint => {
      if (mode === 'contour')
        return {
          x: plot.left + ((point.x - low) / span) * plot.width,
          y: plot.top + (1 - (point.y - low) / span) * plot.height,
          depth: 0,
        };
      const x = ((point.x - middle) / span) * 2;
      const y = ((point.y - middle) / span) * 2;
      const lateral = x * Math.cos(camera.yaw) - y * Math.sin(camera.yaw);
      const depth = x * Math.sin(camera.yaw) + y * Math.cos(camera.yaw);
      return {
        x: width / 2 + lateral * factor,
        y:
          height * 0.66 +
          (depth * Math.sin(camera.elevation) - elevation * 1.1 * Math.cos(camera.elevation)) *
            factor,
        depth,
      };
    };
    const line = (a: ScreenPoint, b: ScreenPoint) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    const inside = (point: Point) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= low &&
      point.x <= high &&
      point.y >= low &&
      point.y <= high;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.font = '10px "SFMono-Regular", Consolas, monospace';

    if (mode === 'surface') {
      if (showGrid) {
        ctx.strokeStyle = 'rgba(139,190,169,0.14)';
        ctx.lineWidth = 0.7;
        for (let i = 0; i <= 10; i++) {
          const tick = low + (i / 10) * span;
          line(project({ x: tick, y: low }, -0.07), project({ x: tick, y: high }, -0.07));
          line(project({ x: low, y: tick }, -0.07), project({ x: high, y: tick }, -0.07));
        }
        ctx.strokeStyle = 'rgba(163,211,189,0.28)';
        line(project({ x: low, y: low }, -0.07), project({ x: high, y: low }, -0.07));
        line(project({ x: high, y: low }, -0.07), project({ x: high, y: high }, -0.07));
      }
      const projected = sampled.cells
        .map((cell) => {
          const vertices = cell.vertices.map((vertex) => project(vertex, vertex.height));
          return {
            vertices,
            depth: vertices.reduce((sum, v) => sum + v.depth, 0) / 4,
            height: cell.height,
          };
        })
        .sort((a, b) => a.depth - b.depth);
      for (const cell of projected) {
        ctx.beginPath();
        ctx.moveTo(cell.vertices[0].x, cell.vertices[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(cell.vertices[i].x, cell.vertices[i].y);
        ctx.closePath();
        ctx.fillStyle = surfaceColor(cell.height, 0.94);
        ctx.fill();
        ctx.strokeStyle = showGrid ? 'rgba(161,224,192,0.23)' : surfaceColor(cell.height, 0.94);
        ctx.lineWidth = showGrid ? 0.55 : 0.7;
        ctx.stroke();
      }
      if (showGrid) {
        const xLabel = project({ x: high + span * 0.1, y: low }, -0.08);
        const yLabel = project({ x: high, y: high + span * 0.1 }, -0.08);
        ctx.fillStyle = '#a0bdaf';
        ctx.font = 'italic 12px Georgia, serif';
        ctx.fillText('x', xLabel.x, xLabel.y);
        ctx.fillText('y', yLabel.x, yLabel.y);
        ctx.font = '10px "SFMono-Regular", Consolas, monospace';
        for (const tick of [low, middle, high]) {
          const label = project({ x: tick, y: low - span * 0.05 }, -0.08);
          ctx.fillStyle = '#829c90';
          ctx.fillText(Number(tick.toFixed(1)).toString(), label.x - 7, label.y + 7);
        }
      }
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(plot.left, plot.top, plot.width, plot.height);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heatmap, plot.left, plot.top, plot.width, plot.height);
      ctx.lineWidth = 0.9;
      for (const contour of sampled.contours) {
        ctx.strokeStyle = `rgba(207,239,207,${0.13 + contour.level * 0.18})`;
        line(project(contour.from), project(contour.to));
      }
      if (showGrid) {
        ctx.strokeStyle = 'rgba(177,220,189,0.13)';
        ctx.lineWidth = 0.6;
        for (let i = 0; i <= 8; i++) {
          const tick = low + (i / 8) * span;
          line(project({ x: tick, y: low }), project({ x: tick, y: high }));
          line(project({ x: low, y: tick }), project({ x: high, y: tick }));
        }
      }
      ctx.restore();
      ctx.strokeStyle = '#44685a';
      ctx.lineWidth = 1;
      ctx.strokeRect(plot.left, plot.top, plot.width, plot.height);
      ctx.fillStyle = '#aac4b4';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const tick = low + (i / 4) * span;
        const x = project({ x: tick, y: low });
        const y = project({ x: low, y: tick });
        ctx.fillText(Number(tick.toFixed(2)).toString(), x.x, x.y + 18);
        ctx.textAlign = 'right';
        ctx.fillText(Number(tick.toFixed(2)).toString(), y.x - 10, y.y + 3);
        ctx.textAlign = 'center';
      }
      ctx.font = 'italic 12px Georgia, serif';
      ctx.fillText('x', plot.left + plot.width + 18, plot.top + plot.height + 4);
      ctx.fillText('y', plot.left - 2, plot.top - 11);
      ctx.textAlign = 'left';
    }

    // Paths are deliberately overlaid, so a deep valley cannot hide a run.
    for (const minimum of surface.minima) {
      if (!inside(minimum)) continue;
      const marker = project(
        minimum,
        sampled.heightFor(surface.value(minimum.x, minimum.y)) + 0.012,
      );
      ctx.strokeStyle = 'rgba(236,216,154,0.6)';
      ctx.fillStyle = '#f0dca9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(marker.x - 12, marker.y);
      ctx.lineTo(marker.x - 5, marker.y);
      ctx.moveTo(marker.x + 5, marker.y);
      ctx.lineTo(marker.x + 12, marker.y);
      ctx.moveTo(marker.x, marker.y - 12);
      ctx.lineTo(marker.x, marker.y - 5);
      ctx.moveTo(marker.x, marker.y + 5);
      ctx.lineTo(marker.x, marker.y + 12);
      ctx.stroke();
    }

    for (const run of runs) {
      const points = run.points.filter((point) => point.step <= step);
      if (!points.length) continue;
      const color = colors.get(run.id) || '#ffffff';
      if (showTrails && points.length > 1) {
        const stride = Math.max(1, Math.floor(points.length / 600));
        const selected = points.filter(
          (_, index) => index % stride === 0 || index === points.length - 1,
        );
        const path = new Path2D();
        let connected = false;
        for (const point of selected) {
          if (!inside(point) || !Number.isFinite(point.loss)) {
            connected = false;
            continue;
          }
          const position = project(point, sampled.heightFor(point.loss) + 0.016);
          if (connected) path.lineTo(position.x, position.y);
          else path.moveTo(position.x, position.y);
          connected = true;
        }
        ctx.strokeStyle = 'rgba(5,24,20,0.65)';
        ctx.lineWidth = 4.5;
        ctx.stroke(path);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.1;
        ctx.stroke(path);
      }
      const point = points[points.length - 1];
      if (!inside(point) || !Number.isFinite(point.loss)) continue;
      const position = project(point, sampled.heightFor(point.loss) + 0.025);
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(position.x, position.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ecf5e9';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    const start = runs[0]?.points[0];
    if (start && inside(start)) {
      const position = project(start, sampled.heightFor(start.loss) + 0.035);
      ctx.strokeStyle = '#e8eedf';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(position.x, position.y - 6);
      ctx.lineTo(position.x + 6, position.y);
      ctx.lineTo(position.x, position.y + 6);
      ctx.lineTo(position.x - 6, position.y);
      ctx.closePath();
      ctx.stroke();
      if (step > 0) {
        ctx.font = '10px "SFMono-Regular", Consolas, monospace';
        ctx.fillStyle = '#d5e1d5';
        ctx.fillText('START', position.x + 11, position.y - 9);
      }
    }
    const offscreen = runs.filter((run) => {
      const point = run.points[Math.min(step, run.points.length - 1)];
      return point && !inside(point);
    }).length;
    if (offscreen) {
      ctx.font = '10px "SFMono-Regular", Consolas, monospace';
      ctx.fillStyle = '#e5c695';
      ctx.fillText(
        `${offscreen} ${offscreen === 1 ? 'trajectory is' : 'trajectories are'} outside the visible domain`,
        18,
        height - 35,
      );
    }
  }, [
    surface,
    runs,
    step,
    mode,
    showTrails,
    showGrid,
    size,
    camera,
    sampled,
    heatmap,
    contourRect,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="surface-canvas"
      role="img"
      tabIndex={0}
      aria-label={`${surface.name} ${mode === 'surface' ? '3D loss surface. Drag or use arrow keys to rotate; scroll or use plus and minus to zoom; double-click to reset.' : 'contour plot. Click to choose the initial point. Initial coordinates can also be entered in the experiment controls.'} Showing ${runs.length} optimizer trajectories at step ${step}. Height and color use an asinh display scale.`}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: 280,
        outlineOffset: -4,
        touchAction: mode === 'surface' ? 'none' : 'pan-y',
        cursor: mode === 'surface' ? 'grab' : 'crosshair',
      }}
      onPointerDown={(event) => {
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
        if (mode === 'surface') event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const previous = drag.current;
        if (!previous) return;
        const dx = event.clientX - previous.x;
        const dy = event.clientY - previous.y;
        previous.moved ||=
          Math.hypot(event.clientX - previous.startX, event.clientY - previous.startY) > 4;
        previous.x = event.clientX;
        previous.y = event.clientY;
        if (mode === 'surface')
          setCamera((current) => ({
            ...current,
            yaw: current.yaw + dx * 0.007,
            elevation: clamp(current.elevation + dy * 0.005, 0.2, 1.3),
          }));
      }}
      onPointerUp={(event) => {
        const previous = drag.current;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (mode !== 'contour' || !previous || previous.moved || !onStartChange) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        const rect = contourRect();
        if (
          x < rect.left ||
          x > rect.left + rect.width ||
          y < rect.top ||
          y > rect.top + rect.height
        )
          return;
        const [low, high] = surface.domain;
        onStartChange({
          x: Number((low + ((x - rect.left) / rect.width) * (high - low)).toFixed(3)),
          y: Number((high - ((y - rect.top) / rect.height) * (high - low)).toFixed(3)),
        });
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={() => {
        if (mode === 'surface') setCamera(INITIAL_CAMERA);
      }}
      onKeyDown={(event) => {
        if (mode !== 'surface') return;
        if (
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '0', 'Home'].includes(
            event.key,
          )
        )
          return;
        event.preventDefault();
        setCamera((current) => {
          if (event.key === '0' || event.key === 'Home') return INITIAL_CAMERA;
          return {
            yaw:
              current.yaw +
              (event.key === 'ArrowRight' ? 0.12 : event.key === 'ArrowLeft' ? -0.12 : 0),
            elevation: clamp(
              current.elevation +
                (event.key === 'ArrowUp' ? 0.08 : event.key === 'ArrowDown' ? -0.08 : 0),
              0.2,
              1.3,
            ),
            zoom: clamp(
              current.zoom +
                (event.key === '+' || event.key === '=' ? 0.1 : event.key === '-' ? -0.1 : 0),
              0.65,
              1.7,
            ),
          };
        });
      }}
    />
  );
}
