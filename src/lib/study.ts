import {
  DEFAULT_CONFIG,
  OPTIMIZERS,
  getSurface,
  normalizeConfig,
  runExperiment,
  type ExperimentConfig,
  type OptimizerId,
  type OptimizerRun,
  type Point,
  type SurfaceId,
} from './engine';

export interface StudyConfig {
  surfaceId: SurfaceId;
  rateMin: number;
  rateMax: number;
  rateCount: number;
  repetitions: number;
  noise: number;
  steps: number;
  seed: number;
  momentum: number;
  start: Point;
}

export interface StudyTrial {
  optimizerId: OptimizerId;
  learningRate: number;
  seed: number;
  status: OptimizerRun['status'];
  /** Null for a divergent run: its last valid point is not a completed result. */
  finalLoss: number | null;
  lastFiniteLoss: number;
  bestRecordedLoss: number;
  gradientNorm: number;
  completedSteps: number;
  finalPosition: Point;
}

export interface StudyCell {
  optimizerId: OptimizerId;
  learningRate: number;
  trials: StudyTrial[];
  medianFinalLoss: number | null;
  minFinalLoss: number | null;
  maxFinalLoss: number | null;
  validCount: number;
  convergedCount: number;
  divergedCount: number;
}

export interface StudyResult {
  config: StudyConfig;
  rates: number[];
  seeds: number[];
  trials: StudyTrial[];
  cells: StudyCell[];
}

export const MAX_STUDY_TRIALS = 210;

export function createStudyConfig(experiment: ExperimentConfig = DEFAULT_CONFIG): StudyConfig {
  const base = normalizeConfig(experiment);
  return {
    surfaceId: base.surfaceId,
    rateMin: Math.max(0.000001, base.learningRate / 10),
    rateMax: Math.min(2, Math.max(0.00001, base.learningRate * 10)),
    rateCount: 5,
    repetitions: 3,
    noise: Math.min(2, base.noise),
    steps: Math.max(200, Math.min(1000, base.steps)),
    seed: base.seed,
    momentum: base.momentum,
    start: { ...base.start },
  };
}

function bounded(value: unknown, name: string, min: number, max: number, integer = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${name} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`,
    );
  }
  return value;
}

export function normalizeStudyConfig(input: unknown): StudyConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Study settings must be an object.');
  const record = input as Record<string, unknown>;
  const experiment = normalizeConfig({
    surfaceId: record.surfaceId,
    learningRate: record.rateMin,
    momentum: record.momentum,
    noise: record.noise,
    steps: record.steps,
    seed: record.seed,
    start: record.start,
  });
  const rateMin = bounded(record.rateMin, 'Minimum rate', 0.000001, 2);
  const rateMax = bounded(record.rateMax, 'Maximum rate', 0.000001, 2);
  if (rateMin >= rateMax) throw new Error('Maximum rate must be larger than minimum rate.');
  return {
    surfaceId: experiment.surfaceId,
    rateMin,
    rateMax,
    rateCount: bounded(record.rateCount, 'Number of rates', 3, 7, true),
    repetitions: bounded(record.repetitions, 'Seed repetitions', 1, 5, true),
    noise: bounded(experiment.noise, 'Study noise', 0, 2),
    steps: bounded(experiment.steps, 'Study iterations', 200, 1000, true),
    seed: experiment.seed,
    momentum: experiment.momentum,
    start: { ...experiment.start },
  };
}

/** Equal spacing in log space means equal ratios rather than equal differences. */
export function logarithmicRates(min: number, max: number, count: number): number[] {
  bounded(min, 'Minimum rate', 0.000001, 2);
  bounded(max, 'Maximum rate', 0.000001, 2);
  bounded(count, 'Number of rates', 3, 7, true);
  if (min >= max) throw new Error('Maximum rate must be larger than minimum rate.');
  return Array.from({ length: count }, (_, index) =>
    index === 0
      ? min
      : index === count - 1
        ? max
        : Math.exp(Math.log(min) + ((Math.log(max) - Math.log(min)) * index) / (count - 1)),
  );
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  if (values.some((value) => !Number.isFinite(value)))
    throw new Error('Median requires finite values.');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function aggregateStudyTrials(trials: StudyTrial[], rates: number[]): StudyCell[] {
  return OPTIMIZERS.flatMap(({ id }) =>
    rates.map((learningRate) => {
      const matching = trials.filter(
        (trial) => trial.optimizerId === id && trial.learningRate === learningRate,
      );
      const finalLosses = matching.flatMap((trial) =>
        trial.status !== 'diverged' && trial.finalLoss !== null ? [trial.finalLoss] : [],
      );
      return {
        optimizerId: id,
        learningRate,
        trials: matching,
        medianFinalLoss: median(finalLosses),
        minFinalLoss: finalLosses.length ? Math.min(...finalLosses) : null,
        maxFinalLoss: finalLosses.length ? Math.max(...finalLosses) : null,
        validCount: finalLosses.length,
        convergedCount: matching.filter((trial) => trial.status === 'converged').length,
        divergedCount: matching.filter((trial) => trial.status === 'diverged').length,
      };
    }),
  );
}

export function trialExperiment(
  config: StudyConfig,
  trial: Pick<StudyTrial, 'optimizerId' | 'learningRate' | 'seed'>,
  allOptimizers = false,
): ExperimentConfig {
  return normalizeConfig({
    surfaceId: config.surfaceId,
    learningRate: trial.learningRate,
    momentum: config.momentum,
    noise: config.noise,
    steps: config.steps,
    seed: trial.seed,
    start: config.start,
    optimizerIds: allOptimizers ? OPTIMIZERS.map(({ id }) => id) : [trial.optimizerId],
  });
}

export class StudyCancelledError extends Error {
  constructor() {
    super('Study cancelled. Partial results were discarded.');
    this.name = 'StudyCancelledError';
  }
}

export async function runStudy(
  input: StudyConfig,
  options: {
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
    /** Injectable scheduler makes cancellation and progress deterministic in tests. */
    yieldControl?: () => Promise<void>;
  } = {},
): Promise<StudyResult> {
  const config = normalizeStudyConfig(input);
  const rates = logarithmicRates(config.rateMin, config.rateMax, config.rateCount);
  const seeds = Array.from(
    { length: config.repetitions },
    (_, index) => (config.seed + index) >>> 0,
  );
  const trials: StudyTrial[] = [];
  const total = rates.length * seeds.length * OPTIMIZERS.length;
  const checkCancelled = () => {
    if (options.signal?.aborted) throw new StudyCancelledError();
  };
  const yieldControl =
    options.yieldControl ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  checkCancelled();
  options.onProgress?.(0, total);
  for (const learningRate of rates) {
    for (const seed of seeds) {
      for (const { id: optimizerId } of OPTIMIZERS) {
        checkCancelled();
        // Only one bounded trace is alive at a time. The study retains summaries, not trajectories.
        const {
          runs: [run],
        } = runExperiment(trialExperiment(config, { optimizerId, learningRate, seed }), {
          captureUpdates: false,
        });
        const final = run.points.at(-1)!;
        trials.push({
          optimizerId,
          learningRate,
          seed,
          status: run.status,
          finalLoss: run.status === 'diverged' ? null : final.loss,
          lastFiniteLoss: final.loss,
          bestRecordedLoss: run.bestLoss,
          gradientNorm: final.gradientNorm,
          completedSteps: final.step,
          finalPosition: { x: final.x, y: final.y },
        });
        options.onProgress?.(trials.length, total);
        await yieldControl();
        checkCancelled();
      }
    }
  }
  return { config, rates, seeds, trials, cells: aggregateStudyTrials(trials, rates) };
}

export function studyCsv(result: StudyResult): string {
  const { config } = result;
  return [
    'surface,optimizer,learning_rate,seed,status,final_loss,last_finite_loss,best_recorded_loss,gradient_norm,completed_steps,noise,momentum,start_x,start_y,budget',
    ...result.trials.map((trial) =>
      [
        config.surfaceId,
        trial.optimizerId,
        trial.learningRate,
        trial.seed,
        trial.status,
        trial.finalLoss ?? '',
        trial.lastFiniteLoss,
        trial.bestRecordedLoss,
        trial.gradientNorm,
        trial.completedSteps,
        config.noise,
        config.momentum,
        config.start.x,
        config.start.y,
        config.steps,
      ].join(','),
    ),
  ].join('\n');
}

export function studyJson(result: StudyResult): string {
  return JSON.stringify(
    {
      format: 'optimizer-lab/study-v1',
      note: 'Study report, not a single-experiment import. Median and range include only non-divergent trials; every failed trial is retained with a null finalLoss and a separate lastFiniteLoss. This is a one-dimensional sensitivity study, not an optimizer ranking or a confidence interval.',
      surface: getSurface(result.config.surfaceId).name,
      ...result,
    },
    null,
    2,
  );
}
