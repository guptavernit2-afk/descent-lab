import type { Point, SurfaceDefinition } from './engine';

export interface Observation {
  feature: number;
  target: number;
}

/** Fixed synthetic observations: these are a teaching dataset, not measurements of people. */
function observations(count: number, offset: number): Observation[] {
  return Array.from({ length: count }, (_, index) => {
    const feature = -2.4 + (4.8 * (index + offset)) / (count - 1 + 2 * offset);
    const residual =
      0.28 * Math.sin((index + 1 + offset) * 2.17) + 0.16 * Math.cos((index + offset) * 0.73);
    return { feature, target: 1.4 * feature + 0.65 + residual };
  });
}

export const TRAINING_DATA = observations(25, 0);
export const HOLDOUT_DATA = observations(12, 0.43);

/** theta.x is the slope w; theta.y is the intercept b. */
export function predict(theta: Point, feature: number): number {
  return theta.x * feature + theta.y;
}

export function meanSquaredError(theta: Point, data: readonly Observation[]): number {
  if (!data.length) throw new Error('At least one observation is required.');
  return (
    data.reduce((sum, point) => sum + (predict(theta, point.feature) - point.target) ** 2, 0) /
    data.length
  );
}

export function regressionGradient(
  theta: Point,
  data: readonly Observation[] = TRAINING_DATA,
): Point {
  if (!data.length) throw new Error('At least one observation is required.');
  return data.reduce(
    (gradient, point) => {
      const residual = predict(theta, point.feature) - point.target;
      return {
        x: gradient.x + (residual * point.feature) / data.length,
        y: gradient.y + residual / data.length,
      };
    },
    { x: 0, y: 0 },
  );
}

export function leastSquares(data: readonly Observation[]): Point {
  if (data.length < 2) throw new Error('At least two observations are required.');
  const meanX = data.reduce((sum, point) => sum + point.feature, 0) / data.length;
  const meanY = data.reduce((sum, point) => sum + point.target, 0) / data.length;
  const variance = data.reduce((sum, point) => sum + (point.feature - meanX) ** 2, 0);
  if (variance === 0) throw new Error('Features must vary to identify a slope.');
  const slope =
    data.reduce((sum, point) => sum + (point.feature - meanX) * (point.target - meanY), 0) /
    variance;
  return { x: slope, y: meanY - slope * meanX };
}

export const REGRESSION_OPTIMUM = leastSquares(TRAINING_DATA);
export const REGRESSION_SURFACE: SurfaceDefinition = {
  id: 'regression',
  name: 'Fit a Line',
  shortName: 'Linear regression',
  formula: 'L(w, b) = (1/2n) Σ(wuᵢ + b − tᵢ)²',
  description:
    'Each point on this bowl is a model: x is its slope w, y its intercept b. Descending the loss surface brings the predicted line closer to 25 synthetic training observations.',
  challenge: 'From parameters to predictions',
  domain: [-3, 3],
  start: { x: -2, y: 2 },
  learningRate: 0.08,
  minima: [REGRESSION_OPTIMUM],
  value: (x, y) => meanSquaredError({ x, y }, TRAINING_DATA) / 2,
  gradient: (x, y) => regressionGradient({ x, y }),
};
