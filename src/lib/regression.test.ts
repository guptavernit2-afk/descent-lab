import { describe, expect, it } from 'vitest';
import { normalizeConfig, runExperiment } from './engine';
import {
  HOLDOUT_DATA,
  TRAINING_DATA,
  REGRESSION_OPTIMUM,
  REGRESSION_SURFACE,
  leastSquares,
  meanSquaredError,
  predict,
  regressionGradient,
} from './regression';

describe('the model-fitting objective', () => {
  it('solves an independently known exact line', () => {
    const points = [-2, -1, 0, 1, 2].map((feature) => ({ feature, target: 3 * feature - 2 }));
    expect(leastSquares(points)).toEqual({ x: 3, y: -2 });
    expect(meanSquaredError({ x: 3, y: -2 }, points)).toBe(0);
    expect(predict({ x: 3, y: -2 }, 4)).toBe(10);
  });
  it('separates synthetic holdout observations from the training objective', () => {
    expect(TRAINING_DATA).toHaveLength(25);
    expect(HOLDOUT_DATA).toHaveLength(12);
    expect(
      HOLDOUT_DATA.every(
        (point) => !TRAINING_DATA.some((other) => other.feature === point.feature),
      ),
    ).toBe(true);
    const { x, y } = REGRESSION_OPTIMUM;
    expect(REGRESSION_SURFACE.value(x, y)).toBe(meanSquaredError({ x, y }, TRAINING_DATA) / 2);
    expect(meanSquaredError({ x, y }, HOLDOUT_DATA)).not.toBe(
      meanSquaredError({ x, y }, TRAINING_DATA),
    );
  });
  it('matches central differences of half-MSE', () => {
    const theta = { x: -0.8, y: 1.2 },
      h = 1e-5;
    const analytical = regressionGradient(theta);
    for (const axis of ['x', 'y'] as const) {
      const above = { ...theta, [axis]: theta[axis] + h };
      const below = { ...theta, [axis]: theta[axis] - h };
      const numeric =
        (meanSquaredError(above, TRAINING_DATA) - meanSquaredError(below, TRAINING_DATA)) / (4 * h);
      expect(analytical[axis]).toBeCloseTo(numeric, 8);
    }
  });
  it('has a stationary least-squares optimum with nonzero residual error', () => {
    const gradient = regressionGradient(REGRESSION_OPTIMUM);
    expect(Math.hypot(gradient.x, gradient.y)).toBeLessThan(1e-12);
    expect(REGRESSION_SURFACE.value(REGRESSION_OPTIMUM.x, REGRESSION_OPTIMUM.y)).toBeGreaterThan(0);
  });
  it('learns the least-squares solution using the same optimizer engine', () => {
    const result = runExperiment(
      normalizeConfig({ surfaceId: 'regression', optimizerIds: ['gd'], steps: 500 }),
    );
    const run = result.runs[0],
      point = run.points.at(-1)!;
    expect(run.status).toBe('converged');
    expect(point.x).toBeCloseTo(REGRESSION_OPTIMUM.x, 4);
    expect(point.y).toBeCloseTo(REGRESSION_OPTIMUM.y, 4);
    expect(point.loss).toBeLessThan(run.points[0].loss);
  });
  it('rejects underdetermined data', () => {
    expect(() => leastSquares([{ feature: 1, target: 2 }])).toThrow();
    expect(() =>
      leastSquares([
        { feature: 1, target: 2 },
        { feature: 1, target: 3 },
      ]),
    ).toThrow();
    expect(() => meanSquaredError({ x: 0, y: 0 }, [])).toThrow();
    expect(() => regressionGradient({ x: 0, y: 0 }, [])).toThrow();
  });
});
