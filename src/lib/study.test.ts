import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, OPTIMIZERS, runExperiment } from './engine';
import {
  MAX_STUDY_TRIALS,
  StudyCancelledError,
  aggregateStudyTrials,
  createStudyConfig,
  logarithmicRates,
  median,
  normalizeStudyConfig,
  runStudy,
  studyCsv,
  studyJson,
  trialExperiment,
  type StudyTrial,
} from './study';

const fast = { yieldControl: () => Promise.resolve() };
const small = () => ({
  ...createStudyConfig(DEFAULT_CONFIG),
  rateMin: 0.001,
  rateMax: 0.1,
  rateCount: 3,
  repetitions: 2,
  steps: 200,
  noise: 0.3,
});

describe('study setup and logarithmic spacing', () => {
  it('uses equal ratios and preserves the exact endpoints', () => {
    const rates = logarithmicRates(0.0001, 0.1, 4);
    expect(rates[0]).toBe(0.0001);
    expect(rates.at(-1)).toBe(0.1);
    expect(rates[1]).toBeCloseTo(0.001, 12);
    expect(rates[2]).toBeCloseTo(0.01, 12);
    expect(rates[1] / rates[0]).toBeCloseTo(rates[2] / rates[1], 12);
  });

  it('keeps study defaults within resource limits at extreme valid lab settings', () => {
    for (const learningRate of [0.000001, 2]) {
      const config = createStudyConfig({ ...DEFAULT_CONFIG, learningRate, steps: 3000, noise: 5 });
      expect(normalizeStudyConfig(config)).toEqual(config);
      expect(config.steps).toBe(1000);
      expect(config.noise).toBe(2);
      expect(config.rateMin).toBeLessThan(config.rateMax);
    }
  });

  it('copies starting coordinates instead of retaining the caller object', () => {
    const input = structuredClone(DEFAULT_CONFIG);
    const study = createStudyConfig(input);
    study.start.x = 0;
    expect(input.start.x).toBe(DEFAULT_CONFIG.start.x);
  });

  it.each([
    { rateMin: 0 },
    { rateMin: -1 },
    { rateMax: 2.1 },
    { rateMax: Number.NaN },
    { rateMin: 0.1, rateMax: 0.1 },
    { rateMin: 0.2, rateMax: 0.1 },
    { rateCount: 2 },
    { rateCount: 8 },
    { rateCount: 3.5 },
    { repetitions: 0 },
    { repetitions: 6 },
    { repetitions: 1.5 },
    { noise: -0.1 },
    { noise: 2.1 },
    { steps: 199 },
    { steps: 1001 },
    { seed: -1 },
    { seed: 4294967296 },
    { seed: 0.5 },
    { momentum: 1 },
    { surfaceId: 'unknown' },
    { start: { x: 100, y: 0 } },
  ])('rejects invalid or unbounded settings %j', (patch) => {
    expect(() => normalizeStudyConfig({ ...small(), ...patch })).toThrow();
  });

  it('rejects non-object settings', () => {
    expect(() => normalizeStudyConfig(null)).toThrow();
    expect(() => normalizeStudyConfig([])).toThrow();
    expect(() => normalizeStudyConfig('study')).toThrow();
  });

  it('bounds the maximal sweep at 210 trials', () => {
    const config = normalizeStudyConfig({ ...small(), rateCount: 7, repetitions: 5, steps: 1000 });
    expect(config.rateCount * config.repetitions * OPTIMIZERS.length).toBe(MAX_STUDY_TRIALS);
  });
});

describe('study aggregation', () => {
  it('calculates medians without mutating the input', () => {
    const values = [9, 1, 4];
    expect(median(values)).toBe(4);
    expect(values).toEqual([9, 1, 4]);
    expect(median([1, 9, 2, 6])).toBe(4);
    expect(median([])).toBeNull();
    expect(() => median([1, Infinity])).toThrow();
  });

  function trial(patch: Partial<StudyTrial>): StudyTrial {
    return {
      optimizerId: 'gd',
      learningRate: 0.1,
      seed: 42,
      status: 'completed',
      finalLoss: 2,
      lastFiniteLoss: 2,
      bestRecordedLoss: 1,
      gradientNorm: 0.4,
      completedSteps: 200,
      finalPosition: { x: 1, y: 0.1 },
      ...patch,
    };
  }

  it('keeps failed trials explicit while summarizing only actual terminal losses', () => {
    const trials = [
      trial({ seed: 42, status: 'converged', finalLoss: 0 }),
      trial({ seed: 43, finalLoss: 4 }),
      trial({ seed: 44, status: 'diverged', finalLoss: null, lastFiniteLoss: 100000 }),
    ];
    const cell = aggregateStudyTrials(trials, [0.1]).find(
      ({ optimizerId }) => optimizerId === 'gd',
    )!;
    expect(cell.medianFinalLoss).toBe(2);
    expect(cell.minFinalLoss).toBe(0);
    expect(cell.maxFinalLoss).toBe(4);
    expect(cell.validCount).toBe(2);
    expect(cell.convergedCount).toBe(1);
    expect(cell.divergedCount).toBe(1);
    expect(cell.trials).toHaveLength(3);
  });

  it('does not manufacture a median when every trial diverged', () => {
    const cell = aggregateStudyTrials([trial({ status: 'diverged', finalLoss: null })], [0.1])[0];
    expect(cell.medianFinalLoss).toBeNull();
    expect(cell.minFinalLoss).toBeNull();
    expect(cell.maxFinalLoss).toBeNull();
    expect(cell.divergedCount).toBe(1);
  });

  it('supports negative losses without taking an absolute value', () => {
    const cell = aggregateStudyTrials(
      [trial({ finalLoss: -1.6 }), trial({ seed: 43, finalLoss: -1.2 })],
      [0.1],
    )[0];
    expect(cell.medianFinalLoss).toBeCloseTo(-1.4);
    expect(cell.minFinalLoss).toBe(-1.6);
  });
});

describe('bounded asynchronous execution', () => {
  it('reproduces the same trials, shared seeds, and summary-only output', async () => {
    const a = await runStudy(small(), fast);
    const b = await runStudy(small(), fast);
    expect(a).toEqual(b);
    expect(a.trials).toHaveLength(36);
    expect(a.cells).toHaveLength(18);
    for (const optimizer of OPTIMIZERS) {
      for (const rate of a.rates) {
        expect(
          a.trials
            .filter((trial) => trial.optimizerId === optimizer.id && trial.learningRate === rate)
            .map((trial) => trial.seed),
        ).toEqual([42, 43]);
      }
    }
    expect(a.trials.every((trial) => !('points' in trial) && !('updates' in trial))).toBe(true);
  });

  it('matches an independently reopened trial exactly', async () => {
    const result = await runStudy(small(), fast);
    const trial = result.trials.find(({ optimizerId }) => optimizerId === 'adam')!;
    const config = trialExperiment(result.config, trial);
    const run = runExperiment(config, { captureUpdates: false }).runs[0];
    expect(config.optimizerIds).toEqual(['adam']);
    expect(run.points.at(-1)!.loss).toBe(trial.finalLoss);
    expect(run.bestLoss).toBe(trial.bestRecordedLoss);
    expect(trialExperiment(result.config, trial, true).optimizerIds).toHaveLength(6);
  });

  it('wraps seeds deterministically at the unsigned 32-bit boundary', async () => {
    const result = await runStudy({ ...small(), seed: 4294967295 }, fast);
    expect(result.seeds).toEqual([4294967295, 0]);
  });

  it('reports progress for every run and yields after each trial', async () => {
    const progress: number[] = [];
    let yields = 0;
    const result = await runStudy(
      { ...small(), repetitions: 1 },
      {
        onProgress: (completed, total) => {
          expect(total).toBe(18);
          progress.push(completed);
        },
        yieldControl: async () => {
          yields += 1;
        },
      },
    );
    expect(progress).toEqual(Array.from({ length: 19 }, (_, index) => index));
    expect(yields).toBe(result.trials.length);
  });

  it('honors cancellation before computing any trial', async () => {
    const controller = new AbortController();
    controller.abort();
    let progressCalls = 0;
    await expect(
      runStudy(small(), { ...fast, signal: controller.signal, onProgress: () => progressCalls++ }),
    ).rejects.toBeInstanceOf(StudyCancelledError);
    expect(progressCalls).toBe(0);
  });

  it('discards a partial run when cancelled between trials', async () => {
    const controller = new AbortController();
    let completed = 0;
    await expect(
      runStudy(small(), {
        signal: controller.signal,
        onProgress: (count) => {
          completed = count;
        },
        yieldControl: async () => {
          if (completed === 3) controller.abort();
        },
      }),
    ).rejects.toThrow('Partial results were discarded');
    expect(completed).toBe(3);
  });

  it('captures real divergent outcomes without treating the last finite value as terminal', async () => {
    const result = await runStudy(
      { ...small(), rateMin: 0.5, rateMax: 2, repetitions: 1, noise: 0 },
      fast,
    );
    const failed = result.trials.filter(({ status }) => status === 'diverged');
    expect(failed.length).toBeGreaterThan(0);
    expect(
      failed.every(
        ({ finalLoss, lastFiniteLoss, completedSteps }) =>
          finalLoss === null && Number.isFinite(lastFiniteLoss) && completedSteps < 200,
      ),
    ).toBe(true);
  });
});

describe('study exports', () => {
  it('exports every raw trial with missing terminal values explicit', async () => {
    const result = await runStudy({ ...small(), rateMin: 0.5, rateMax: 2, repetitions: 1 }, fast);
    const rows = studyCsv(result).split('\n');
    expect(rows).toHaveLength(result.trials.length + 1);
    expect(rows[0]).toContain('final_loss,last_finite_loss,best_recorded_loss');
    const divergent = rows.find((row) => row.includes(',diverged,'))!;
    expect(divergent).toContain(',diverged,,');
    expect(divergent.split(',')).toHaveLength(15);
  });

  it('labels the JSON as a study report distinct from an experiment import', async () => {
    const result = await runStudy({ ...small(), repetitions: 1 }, fast);
    const json = JSON.parse(studyJson(result));
    expect(json.format).toBe('optimizer-lab/study-v1');
    expect(json.config).toEqual(result.config);
    expect(json.trials).toEqual(result.trials);
    expect(json.note).toContain('not a single-experiment import');
    expect(json.note).toContain('not an optimizer ranking');
  });
});
