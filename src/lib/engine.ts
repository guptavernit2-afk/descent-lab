/** Pure, deterministic optimization math. Rendering never changes these results. */
export type Point = { x: number; y: number };
export type SurfaceId = 'quadratic' | 'saddle' | 'rosenbrock' | 'himmelblau' | 'rastrigin';
export type OptimizerId = 'gd' | 'momentum' | 'nesterov' | 'adagrad' | 'rmsprop' | 'adam';

export interface SurfaceDefinition {
  id: SurfaceId;
  name: string;
  shortName: string;
  formula: string;
  description: string;
  challenge: string;
  domain: [number, number];
  start: Point;
  learningRate: number;
  minima: Point[];
  value: (x: number, y: number) => number;
  gradient: (x: number, y: number) => Point;
}

export interface OptimizerDefinition {
  id: OptimizerId;
  name: string;
  shortName: string;
  color: string;
  description: string;
  formula: string;
}

export const SURFACES: SurfaceDefinition[] = [
  {
    id: 'quadratic',
    name: 'Quadratic Bowl',
    shortName: 'Quadratic',
    formula: 'f(x, y) = ½(x² + 6y²)',
    description:
      'A smooth convex bowl with one global minimum. Different curvature along each axis reveals overshooting and momentum.',
    challenge: 'Unequal curvature',
    domain: [-4, 4],
    start: { x: -3, y: 2.5 },
    learningRate: 0.05,
    minima: [{ x: 0, y: 0 }],
    value: (x, y) => 0.5 * (x * x + 6 * y * y),
    gradient: (x, y) => ({ x, y: 6 * y }),
  },
  {
    id: 'saddle',
    name: 'Quartic Saddle',
    shortName: 'Saddle',
    formula: 'f(x, y) = x² − y² + 0.15y⁴',
    description:
      'A bounded quartic surface with a saddle at the origin and two global minima. Starting exactly at the saddle with no noise can stall every method.',
    challenge: 'Flat stationary point',
    domain: [-3, 3],
    start: { x: -2, y: 0.15 },
    learningRate: 0.04,
    minima: [
      { x: 0, y: Math.sqrt(1 / 0.3) },
      { x: 0, y: -Math.sqrt(1 / 0.3) },
    ],
    value: (x, y) => x * x - y * y + 0.15 * y ** 4,
    gradient: (x, y) => ({ x: 2 * x, y: -2 * y + 0.6 * y ** 3 }),
  },
  {
    id: 'rosenbrock',
    name: 'Rosenbrock Valley',
    shortName: 'Rosenbrock',
    formula: 'f(x, y) = (1 − x)² + 100(y − x²)²',
    description:
      'A narrow, curved valley leading to the global minimum at (1, 1). A low loss can still be far from the solution.',
    challenge: 'Narrow curved valley',
    domain: [-2.5, 2.5],
    start: { x: -1.2, y: 1 },
    learningRate: 0.001,
    minima: [{ x: 1, y: 1 }],
    value: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    gradient: (x, y) => ({ x: 2 * (x - 1) - 400 * x * (y - x * x), y: 200 * (y - x * x) }),
  },
  {
    id: 'himmelblau',
    name: 'Himmelblau Function',
    shortName: 'Himmelblau',
    formula: 'f(x, y) = (x² + y − 11)² + (x + y² − 7)²',
    description:
      'Four equally good global minima, separated by hills and valleys. Starting position and optimizer dynamics determine the basin reached.',
    challenge: 'Four competing basins',
    domain: [-5, 5],
    start: { x: -3, y: 1 },
    learningRate: 0.01,
    minima: [
      { x: 3, y: 2 },
      { x: -2.805118, y: 3.131312 },
      { x: -3.77931, y: -3.283186 },
      { x: 3.584428, y: -1.848126 },
    ],
    value: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
    gradient: (x, y) => ({
      x: 4 * x * (x * x + y - 11) + 2 * (x + y * y - 7),
      y: 2 * (x * x + y - 11) + 4 * y * (x + y * y - 7),
    }),
  },
  {
    id: 'rastrigin',
    name: 'Rastrigin Landscape',
    shortName: 'Rastrigin',
    formula: 'f(x, y) = 20 + x² + y² − 10[cos(2πx) + cos(2πy)]',
    description:
      'A rippled landscape with many local minima and one global minimum at the origin. Local optimization does not guarantee finding the best basin.',
    challenge: 'Many local minima',
    domain: [-5.12, 5.12],
    start: { x: -3.5, y: 3.2 },
    learningRate: 0.003,
    minima: [{ x: 0, y: 0 }],
    value: (x, y) =>
      20 + x * x + y * y - 10 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)),
    gradient: (x, y) => ({
      x: 2 * x + 20 * Math.PI * Math.sin(2 * Math.PI * x),
      y: 2 * y + 20 * Math.PI * Math.sin(2 * Math.PI * y),
    }),
  },
];

export const OPTIMIZERS: OptimizerDefinition[] = [
  {
    id: 'gd',
    name: 'Gradient Descent',
    shortName: 'GD',
    color: '#f9735b',
    description:
      'Follows the negative gradient with a fixed learning rate. Simple and sensitive to curvature.',
    formula: 'θ ← θ − ηg',
  },
  {
    id: 'momentum',
    name: 'Momentum',
    shortName: 'Momentum',
    color: '#e6b84e',
    description:
      'Accumulates a velocity to carry consistent directions forward. Can overshoot when momentum is high.',
    formula: 'v ← βv − ηg; θ ← θ + v',
  },
  {
    id: 'nesterov',
    name: 'Nesterov',
    shortName: 'Nesterov',
    color: '#b49af3',
    description:
      'Measures the gradient at the momentum look-ahead position before updating velocity.',
    formula: 'v ← βv − η∇f(θ + βv); θ ← θ + v',
  },
  {
    id: 'adagrad',
    name: 'AdaGrad',
    shortName: 'AdaGrad',
    color: '#58bca2',
    description:
      'Scales each coordinate by accumulated squared gradients. Its effective step size tends to decrease.',
    formula: 's ← s + g²; θ ← θ − ηg/(√s + ε)',
  },
  {
    id: 'rmsprop',
    name: 'RMSProp',
    shortName: 'RMSProp',
    color: '#63b4e7',
    description:
      'Uses a moving average of squared gradients so older gradients gradually lose influence.',
    formula: 's ← ρs + (1 − ρ)g²; θ ← θ − ηg/(√s + ε)',
  },
  {
    id: 'adam',
    name: 'Adam',
    shortName: 'Adam',
    color: '#ed8eb5',
    description:
      'Combines first and second gradient moments with bias correction. Performance still depends on the learning rate.',
    formula: 'θ ← θ − ηm̂/(√v̂ + ε)',
  },
];

export interface ExperimentConfig {
  surfaceId: SurfaceId;
  learningRate: number;
  momentum: number;
  /** Additive independent uniform noise per coordinate in [−noise, +noise]. */
  noise: number;
  seed: number;
  steps: number;
  start: Point;
  optimizerIds: OptimizerId[];
}

export interface TrajectoryPoint extends Point {
  step: number;
  loss: number;
  /** Norm of the true gradient at this point, before stochastic noise. */
  gradientNorm: number;
  stepNorm: number;
}

export interface OptimizerRun {
  id: OptimizerId;
  points: TrajectoryPoint[];
  status: 'converged' | 'completed' | 'diverged';
  bestLoss: number;
}

export interface ExperimentResult {
  config: ExperimentConfig;
  runs: OptimizerRun[];
}

export const MAX_STEPS = 3000;
export const DEFAULT_CONFIG: ExperimentConfig = {
  surfaceId: 'quadratic',
  learningRate: 0.05,
  momentum: 0.9,
  noise: 0,
  seed: 42,
  steps: 500,
  start: { x: -3, y: 2.5 },
  optimizerIds: OPTIMIZERS.map(({ id }) => id),
};

export function getSurface(id: SurfaceId): SurfaceDefinition {
  const surface = SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error('Unknown loss surface.');
  return surface;
}

const objectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function numberInRange(
  value: unknown,
  name: string,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${name} must be ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}.`,
    );
  }
  return value;
}

/** Validate untrusted JSON; never evaluate formulas or silently coerce strings. */
export function normalizeConfig(input: unknown): ExperimentConfig {
  if (!objectRecord(input)) throw new Error('Experiment settings must be a JSON object.');
  const surfaceId = input.surfaceId ?? DEFAULT_CONFIG.surfaceId;
  if (typeof surfaceId !== 'string' || !SURFACES.some(({ id }) => id === surfaceId))
    throw new Error('Unknown loss surface.');
  const surface = getSurface(surfaceId as SurfaceId);
  const start = input.start ?? surface.start;
  if (!objectRecord(start)) throw new Error('Starting position must contain x and y coordinates.');
  const ids = input.optimizerIds ?? DEFAULT_CONFIG.optimizerIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > OPTIMIZERS.length ||
    ids.some((id) => !OPTIMIZERS.some((optimizer) => optimizer.id === id))
  ) {
    throw new Error('Choose between one and six valid optimizers.');
  }
  if (new Set(ids).size !== ids.length)
    throw new Error('Each optimizer can only be selected once.');
  return {
    surfaceId: surfaceId as SurfaceId,
    learningRate: numberInRange(
      input.learningRate ?? surface.learningRate,
      'Learning rate',
      0.000001,
      2,
    ),
    momentum: numberInRange(input.momentum ?? DEFAULT_CONFIG.momentum, 'Momentum', 0, 0.999),
    noise: numberInRange(input.noise ?? DEFAULT_CONFIG.noise, 'Gradient noise', 0, 5),
    seed: numberInRange(input.seed ?? DEFAULT_CONFIG.seed, 'Random seed', 0, 4294967295, true),
    steps: numberInRange(
      input.steps ?? DEFAULT_CONFIG.steps,
      'Iteration budget',
      1,
      MAX_STEPS,
      true,
    ),
    start: {
      x: numberInRange(start.x, 'Starting x', ...surface.domain),
      y: numberInRange(start.y, 'Starting y', ...surface.domain),
    },
    optimizerIds: [...ids] as OptimizerId[],
  };
}

/** Mulberry32; a fixed seed yields the same stream across browsers. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const EPSILON = 1e-8;
const RMS_DECAY = 0.9;
const ADAM_BETA2 = 0.999;
const GRADIENT_TOLERANCE = 1e-5;

function trajectoryPoint(
  surface: SurfaceDefinition,
  point: Point,
  step: number,
  stepNorm: number,
): TrajectoryPoint {
  const gradient = surface.gradient(point.x, point.y);
  return {
    ...point,
    step,
    loss: surface.value(point.x, point.y),
    gradientNorm: Math.hypot(gradient.x, gradient.y),
    stepNorm,
  };
}

function isConverged(point: TrajectoryPoint, surface: SurfaceDefinition): boolean {
  return (
    point.gradientNorm <= GRADIENT_TOLERANCE &&
    point.stepNorm <= GRADIENT_TOLERANCE &&
    surface.minima.some((minimum) => Math.hypot(point.x - minimum.x, point.y - minimum.y) <= 1e-3)
  );
}

function isSafe(point: TrajectoryPoint): boolean {
  return (
    Object.values(point).every(Number.isFinite) &&
    Math.abs(point.x) <= 1e6 &&
    Math.abs(point.y) <= 1e6 &&
    Math.abs(point.loss) <= 1e14 &&
    point.gradientNorm <= 1e12
  );
}

/**
 * All optimizers receive the same additive noise at a given step. Selecting,
 * reordering, or removing an optimizer therefore cannot change another trace.
 * Numerical safety limits stop a divergent trace; positions are never clamped.
 */
export function runExperiment(input: ExperimentConfig): ExperimentResult {
  const config = normalizeConfig(input);
  const surface = getSurface(config.surfaceId);
  const random = seededRandom(config.seed);
  const noise = Array.from({ length: config.steps }, () => ({
    x: (random() * 2 - 1) * config.noise,
    y: (random() * 2 - 1) * config.noise,
  }));

  const runs = config.optimizerIds.map((id): OptimizerRun => {
    let position = { ...config.start };
    const velocity: Point = { x: 0, y: 0 };
    const firstMoment: Point = { x: 0, y: 0 };
    const secondMoment: Point = { x: 0, y: 0 };
    const initial = trajectoryPoint(surface, position, 0, 0);
    const run: OptimizerRun = {
      id,
      points: [initial],
      status: 'completed',
      bestLoss: initial.loss,
    };
    if (config.noise === 0 && isConverged(initial, surface)) {
      run.status = 'converged';
      return run;
    }

    for (let step = 1; step <= config.steps; step += 1) {
      const evaluation =
        id === 'nesterov'
          ? {
              x: position.x + config.momentum * velocity.x,
              y: position.y + config.momentum * velocity.y,
            }
          : position;
      const rawGradient = surface.gradient(evaluation.x, evaluation.y);
      const gradient = {
        x: rawGradient.x + noise[step - 1].x,
        y: rawGradient.y + noise[step - 1].y,
      };
      const next = { ...position };
      for (const coordinate of ['x', 'y'] as const) {
        const g = gradient[coordinate];
        let change = 0;
        switch (id) {
          case 'gd':
            change = -config.learningRate * g;
            break;
          case 'momentum':
          case 'nesterov':
            velocity[coordinate] = config.momentum * velocity[coordinate] - config.learningRate * g;
            change = velocity[coordinate];
            break;
          case 'adagrad':
            secondMoment[coordinate] += g * g;
            change = (-config.learningRate * g) / (Math.sqrt(secondMoment[coordinate]) + EPSILON);
            break;
          case 'rmsprop':
            secondMoment[coordinate] =
              RMS_DECAY * secondMoment[coordinate] + (1 - RMS_DECAY) * g * g;
            change = (-config.learningRate * g) / (Math.sqrt(secondMoment[coordinate]) + EPSILON);
            break;
          case 'adam': {
            firstMoment[coordinate] =
              config.momentum * firstMoment[coordinate] + (1 - config.momentum) * g;
            secondMoment[coordinate] =
              ADAM_BETA2 * secondMoment[coordinate] + (1 - ADAM_BETA2) * g * g;
            const correctedFirst = firstMoment[coordinate] / (1 - config.momentum ** step);
            const correctedSecond = secondMoment[coordinate] / (1 - ADAM_BETA2 ** step);
            change =
              (-config.learningRate * correctedFirst) / (Math.sqrt(correctedSecond) + EPSILON);
            break;
          }
        }
        next[coordinate] += change;
      }
      const point = trajectoryPoint(
        surface,
        next,
        step,
        Math.hypot(next.x - position.x, next.y - position.y),
      );
      if (!isSafe(point)) {
        run.status = 'diverged';
        break;
      }
      position = next;
      run.points.push(point);
      run.bestLoss = Math.min(run.bestLoss, point.loss);
      if (config.noise === 0 && isConverged(point, surface)) {
        run.status = 'converged';
        break;
      }
    }
    return run;
  });

  return { config, runs };
}
