import { useEffect, useId, useRef, useState } from 'react';
import { ChartScatter, ExternalLink } from 'lucide-react';
import { OPTIMIZERS, type ExperimentResult, type OptimizerId } from '../lib/engine';
import {
  HOLDOUT_DATA,
  TRAINING_DATA,
  REGRESSION_OPTIMUM,
  meanSquaredError,
  predict,
} from '../lib/regression';
import { formatNumber } from './LossChart';
import '../styles/regression.css';

export default function RegressionPanel({
  result,
  step,
}: {
  result: ExperimentResult;
  step: number;
}) {
  const [chosen, setChosen] = useState<OptimizerId>('gd');
  const [holdout, setHoldout] = useState(true);
  const [observation, setObservation] = useState(12);
  const [width, setWidth] = useState(650);
  const ref = useRef<SVGSVGElement>(null);
  const clipId = useId().replaceAll(':', '');
  const run = result.runs.find(({ id }) => id === chosen) || result.runs[0];
  const optimizer = OPTIMIZERS.find(({ id }) => id === run.id)!;
  const point = run.points[Math.min(step, run.points.length - 1)];
  const sample = TRAINING_DATA[observation];
  const prediction = predict(point, sample.feature);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(280, entry.contentRect.width)),
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const height = 280,
    left = 48,
    right = 18,
    top = 18,
    bottom = 38;
  const x = (value: number) => left + ((value + 2.7) / 5.4) * (width - left - right);
  const y = (value: number) => height - bottom - ((value + 4) / 9) * (height - top - bottom);
  return (
    <section className="model-panel panel" aria-labelledby="model-heading">
      <div className="panel-heading">
        <div>
          <h2 id="model-heading">
            <ChartScatter size={17} />
            From parameters to predictions
          </h2>
          <p>
            The surface’s x is slope w; its y is intercept b. The chart below shows the resulting
            model.
          </p>
        </div>
      </div>
      <div className="model-controls">
        <label>
          Inspect optimizer
          <select value={run.id} onChange={(event) => setChosen(event.target.value as OptimizerId)}>
            {result.runs.map(({ id }) => (
              <option key={id} value={id}>
                {OPTIMIZERS.find((item) => item.id === id)!.name}
              </option>
            ))}
          </select>
        </label>
        <label className="model-check">
          <input
            type="checkbox"
            checked={holdout}
            onChange={(event) => setHoldout(event.target.checked)}
          />
          Show held-out observations
        </label>
      </div>
      <div className="model-equation">
        <span>THE CURRENT MODEL</span>
        <strong>
          prediction = {formatNumber(point.x)} × feature {point.y < 0 ? '−' : '+'}{' '}
          {formatNumber(Math.abs(point.y))}
        </strong>
        <small>
          Iteration {point.step}
          {point.step < step ? ' · last recorded state' : ''}
        </small>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        className="model-chart"
        role="img"
        aria-label={`Synthetic data and the ${optimizer.name} fitted line. Slope ${formatNumber(point.x)}, intercept ${formatNumber(point.y)}. Numerical errors are shown below.`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={left} y={top} width={width - left - right} height={height - top - bottom} />
          </clipPath>
        </defs>
        {[-3, 0, 3].map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke="#e1e7db"
              strokeDasharray="3 5"
            />
            <text x={left - 10} y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        {[-2, 0, 2].map((value) => (
          <g key={value}>
            <line x1={x(value)} x2={x(value)} y1={top} y2={height - bottom} stroke="#eef1e8" />
            <text x={x(value)} y={height - 19} textAnchor="middle">
              {value}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${clipId})`}>
          {TRAINING_DATA.map((item, index) => (
            <g key={index}>
              <line
                x1={x(item.feature)}
                x2={x(item.feature)}
                y1={y(item.target)}
                y2={y(predict(point, item.feature))}
                stroke={optimizer.color}
                strokeOpacity="0.55"
                strokeDasharray="2 3"
              />
              <circle
                cx={x(item.feature)}
                cy={y(item.target)}
                r={index === observation ? 5 : 3}
                fill="#244c3f"
                stroke={index === observation ? '#e57547' : '#fff'}
                strokeWidth="1.5"
              />
            </g>
          ))}
          {holdout &&
            HOLDOUT_DATA.map((item, index) => (
              <circle
                key={index}
                cx={x(item.feature)}
                cy={y(item.target)}
                r="3.5"
                fill="white"
                stroke="#6a7d9a"
                strokeWidth="1.5"
              />
            ))}
          <line
            x1={x(-2.7)}
            x2={x(2.7)}
            y1={y(predict(REGRESSION_OPTIMUM, -2.7))}
            y2={y(predict(REGRESSION_OPTIMUM, 2.7))}
            stroke="#60705c"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
          <line
            x1={x(-2.7)}
            x2={x(2.7)}
            y1={y(predict(point, -2.7))}
            y2={y(predict(point, 2.7))}
            stroke={optimizer.color}
            strokeWidth="2.8"
          />
        </g>
        <text x={width - right} y={height - 2} textAnchor="end">
          feature u
        </text>
        <text x="8" y="12">
          target t
        </text>
      </svg>
      <div className="model-legend">
        <span>● Training observations</span>
        <span>○ Held-out observations</span>
        <span>– – Least-squares solution</span>
        <span style={{ borderLeftColor: optimizer.color }}>{optimizer.name} prediction</span>
      </div>
      <div className="model-metrics">
        <div>
          <span>Training MSE</span>
          <strong>{formatNumber(meanSquaredError(point, TRAINING_DATA))}</strong>
          <small>25 observations used in every gradient</small>
        </div>
        <div>
          <span>Held-out MSE</span>
          <strong>{formatNumber(meanSquaredError(point, HOLDOUT_DATA))}</strong>
          <small>12 observations never used for updates</small>
        </div>
        <div>
          <span>Surface height L</span>
          <strong>{formatNumber(point.loss)}</strong>
          <small>½ × training MSE, for a simpler derivative</small>
        </div>
      </div>
      <details className="model-example">
        <summary>Work through one prediction and its error</summary>
        <label>
          Training observation
          <select
            value={observation}
            onChange={(event) => setObservation(Number(event.target.value))}
          >
            {TRAINING_DATA.map((item, index) => (
              <option key={index} value={index}>
                Observation {index + 1} · u = {item.feature.toFixed(1)}
              </option>
            ))}
          </select>
        </label>
        <p>
          For feature <strong>{sample.feature.toFixed(2)}</strong>, the target is{' '}
          <strong>{sample.target.toFixed(4)}</strong>. The current model predicts{' '}
          <strong>{prediction.toFixed(4)}</strong>.
        </p>
        <code>
          residual = prediction − target = {(prediction - sample.target).toFixed(4)}
          <br />
          squared error = residual² = {((prediction - sample.target) ** 2).toFixed(4)}
        </code>
        <p>
          The training MSE averages squared error over all 25 points. Each optimizer changes w and b
          to reduce that shared objective.
        </p>
      </details>
      <p className="model-note">
        This fixed synthetic dataset connects optimization to model fitting. Held-out error
        illustrates evaluation; one small generated split does not establish real-world
        generalization. Noise in the experiment controls perturbs the gradient, not the
        observations.
      </p>
      <a
        className="model-source"
        href="https://developers.google.com/machine-learning/crash-course/linear-regression/loss"
        target="_blank"
        rel="noreferrer"
      >
        Read Google’s explanation of regression loss <ExternalLink size={12} />
      </a>
    </section>
  );
}
