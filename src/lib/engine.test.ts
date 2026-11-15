import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  MAX_STEPS,
  OPTIMIZERS,
  SURFACES,
  getSurface,
  normalizeConfig,
  runExperiment,
  type ExperimentConfig,
  type OptimizerId,
} from './engine';

const config = (overrides: Partial<ExperimentConfig> = {}): ExperimentConfig => ({
  ...DEFAULT_CONFIG,
  start: { ...DEFAULT_CONFIG.start },
  optimizerIds: [...DEFAULT_CONFIG.optimizerIds],
  ...overrides,
});

describe('benchmark definitions', () => {
  for (const surface of SURFACES) {
    it(`${surface.name} has an analytic gradient matching finite differences`, () => {
      const h = 1e-5;
      for (const [x, y] of [
        [-1.23, 0.71],
        [0.31, -0.84],
        [1.13, 1.74],
      ]) {
        const gradient = surface.gradient(x, y);
        const numericX = (surface.value(x + h, y) - surface.value(x - h, y)) / (2 * h);
        const numericY = (surface.value(x, y + h) - surface.value(x, y - h)) / (2 * h);
        expect(gradient.x).toBeCloseTo(numericX, 4);
        expect(gradient.y).toBeCloseTo(numericY, 4);
      }
    });

    it(`${surface.name} lists stationary global minima`, () => {
      for (const { x, y } of surface.minima) {
        const gradient = surface.gradient(x, y);
        expect(Math.hypot(gradient.x, gradient.y)).toBeLessThan(0.001);
        if (surface.id !== 'saddle') expect(surface.value(x, y)).toBeCloseTo(0, 6);
      }
    });
  }

  it('quartic saddle is stationary at the origin but lower at its minima', () => {
    const surface = getSurface('saddle');
    expect(surface.gradient(0, 0)).toEqual({ x: 0, y: 0 });
    expect(surface.value(surface.minima[0].x, surface.minima[0].y)).toBeLessThan(
      surface.value(0, 0),
    );
  });
});

describe('optimizer update equations', () => {
  const firstStep = (id: OptimizerId) =>
    runExperiment(
      config({ start: { x: 1, y: 1 }, learningRate: 0.1, steps: 1, optimizerIds: [id] }),
    ).runs[0].points[1];

  for (const id of ['gd', 'momentum', 'nesterov'] as const) {
    it(`${id} starts with the exact gradient step`, () => {
      expect(firstStep(id).x).toBeCloseTo(0.9, 12);
      expect(firstStep(id).y).toBeCloseTo(0.4, 12);
    });
  }

  for (const id of ['adagrad', 'adam'] as const) {
    it(`${id} normalizes its first gradient coordinatewise`, () => {
      expect(firstStep(id).x).toBeCloseTo(0.9, 8);
      expect(firstStep(id).y).toBeCloseTo(0.9, 8);
    });
  }

  it('RMSProp uses its uncorrected exponential second moment', () => {
    expect(firstStep('rmsprop').x).toBeCloseTo(1 - 0.1 / (Math.sqrt(0.1) + 1e-8), 12);
    expect(firstStep('rmsprop').y).toBeCloseTo(1 - 0.6 / (Math.sqrt(3.6) + 1e-8), 12);
  });

  it('Nesterov evaluates the second gradient at the look-ahead position', () => {
    const result = runExperiment(
      config({
        start: { x: 1, y: 1 },
        learningRate: 0.1,
        momentum: 0.9,
        steps: 2,
        optimizerIds: ['nesterov', 'momentum'],
      }),
    );
    // x1 = .9, v1 = -.1; look-ahead=.81; v2=-.09-.081=-.171.
    expect(result.runs[0].points[2].x).toBeCloseTo(0.729, 12);
    expect(result.runs[1].points[2].x).toBeCloseTo(0.72, 12);
  });

  it('Adam corrects both moments on the second step', () => {
    const points = runExperiment(
      config({ start: { x: 1, y: 1 }, learningRate: 0.1, steps: 2, optimizerIds: ['adam'] }),
    ).runs[0].points;
    const g1 = 1;
    const g2 = points[1].x;
    const m2 = (0.9 * 0.1 * g1 + 0.1 * g2) / (1 - 0.9 ** 2);
    const v2 = (0.999 * 0.001 * g1 ** 2 + 0.001 * g2 ** 2) / (1 - 0.999 ** 2);
    expect(points[2].x).toBeCloseTo(points[1].x - (0.1 * m2) / (Math.sqrt(v2) + 1e-8), 12);
  });
});

describe('reproducible experiments', () => {
  it('replays identical settings and seed exactly', () => {
    const settings = config({ noise: 0.2, seed: 718, steps: 100 });
    expect(runExperiment(settings)).toEqual(runExperiment(settings));
  });

  it('changes noisy traces when the seed changes', () => {
    expect(runExperiment(config({ noise: 0.2, seed: 1 })).runs).not.toEqual(
      runExperiment(config({ noise: 0.2, seed: 2 })).runs,
    );
  });

  it('changing the seed has no effect without noise', () => {
    expect(runExperiment(config({ seed: 1 })).runs).toEqual(
      runExperiment(config({ seed: 2 })).runs,
    );
  });

  it('selection and ordering do not alter an optimizer’s noise stream', () => {
    const all = runExperiment(config({ noise: 0.5 }));
    const selected = runExperiment(config({ noise: 0.5, optimizerIds: ['adam', 'gd'] }));
    expect(selected.runs[0]).toEqual(all.runs.find(({ id }) => id === 'adam'));
    expect(selected.runs[1]).toEqual(all.runs.find(({ id }) => id === 'gd'));
  });

  it('does not mutate caller settings or share returned coordinate objects', () => {
    const input = config();
    const original = structuredClone(input);
    const result = runExperiment(input);
    result.config.start.x = 0;
    result.config.optimizerIds.pop();
    expect(input).toEqual(original);
  });

  it('records the true gradient, excluding injected noise', () => {
    const run = runExperiment(config({ noise: 2, steps: 10, optimizerIds: ['gd'] })).runs[0];
    for (const point of run.points)
      expect(point.gradientNorm).toBeCloseTo(Math.hypot(point.x, 6 * point.y), 12);
  });
});

describe('convergence and numerical safety', () => {
  it('GD converges to the quadratic minimum with a suitable learning rate', () => {
    const run = runExperiment(config({ optimizerIds: ['gd'], steps: 1000 })).runs[0];
    expect(run.status).toBe('converged');
    expect(run.bestLoss).toBeLessThan(1e-9);
    expect(run.points.at(-1)?.gradientNorm).toBeLessThanOrEqual(1e-5);
  });

  it('identifies an initial global minimum without inventing movement', () => {
    const result = runExperiment(config({ start: { x: 0, y: 0 } }));
    for (const run of result.runs) {
      expect(run.status).toBe('converged');
      expect(run.points).toHaveLength(1);
    }
  });

  it('does not label a stationary saddle as converged', () => {
    const result = runExperiment(config({ surfaceId: 'saddle', start: { x: 0, y: 0 }, steps: 20 }));
    for (const run of result.runs) {
      expect(run.status).toBe('completed');
      expect(run.points.at(-1)?.loss).toBe(0);
    }
  });

  it('does not stop noisy optimization at a momentary minimum', () => {
    const result = runExperiment(config({ start: { x: 0, y: 0 }, noise: 0.1, steps: 20 }));
    for (const run of result.runs) expect(run.points).toHaveLength(21);
  });

  it('stops divergence and keeps finite, un-clamped history', () => {
    const run = runExperiment(config({ learningRate: 2, optimizerIds: ['gd'], steps: 3000 }))
      .runs[0];
    expect(run.status).toBe('diverged');
    expect(run.points.length).toBeLessThan(3001);
    expect(run.points.some(({ y }) => Math.abs(y) > 4)).toBe(true);
    for (const point of run.points) expect(Object.values(point).every(Number.isFinite)).toBe(true);
    expect(run.bestLoss).toBe(Math.min(...run.points.map(({ loss }) => loss)));
  });

  it('every default surface experiment returns finite sequential traces', () => {
    for (const surface of SURFACES) {
      const result = runExperiment(normalizeConfig({ surfaceId: surface.id, steps: 200 }));
      expect(result.runs).toHaveLength(OPTIMIZERS.length);
      for (const run of result.runs) {
        expect(run.points[0].step).toBe(0);
        run.points.forEach((point, index) => {
          expect(point.step).toBe(index);
          expect(Object.values(point).every(Number.isFinite)).toBe(true);
        });
      }
    }
  });
});

describe('untrusted configuration validation', () => {
  it('uses surface-specific starting points and rates for omitted settings', () => {
    const result = normalizeConfig({ surfaceId: 'rosenbrock' });
    expect(result.start).toEqual(getSurface('rosenbrock').start);
    expect(result.learningRate).toBe(getSurface('rosenbrock').learningRate);
  });

  it.each([
    null,
    [],
    'settings',
    { surfaceId: 'custom' },
    { learningRate: 0 },
    { learningRate: Infinity },
    { learningRate: '0.05' },
    { learningRate: NaN },
    { momentum: 1 },
    { noise: -1 },
    { seed: -1 },
    { seed: 1.2 },
    { steps: MAX_STEPS + 1 },
    { steps: 0 },
    { steps: 2.5 },
    { optimizerIds: [] },
    { optimizerIds: ['unknown'] },
    { optimizerIds: ['adam', 'adam'] },
    { start: { x: 100, y: 0 } },
    { start: { x: 0 } },
    { start: 'origin' },
  ])('rejects malformed or unsafe settings: %j', (input) => {
    expect(() => normalizeConfig(input)).toThrow();
  });

  it('allows seed zero and the maximum supported budget', () => {
    expect(normalizeConfig({ seed: 0, steps: MAX_STEPS })).toMatchObject({
      seed: 0,
      steps: MAX_STEPS,
    });
  });
});
