import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeConfig } from './engine';
import {
  LEARNING_PROGRESS_KEY,
  LESSONS,
  loadLessonProgress,
  runLesson,
  saveLessonProgress,
  validLessonProgress,
} from './lessons';

describe('guided lesson integrity', () => {
  it('has five distinct complete lessons with valid reproducible experiments', () => {
    expect(LESSONS).toHaveLength(5);
    expect(new Set(LESSONS.map(({ id }) => id)).size).toBe(LESSONS.length);
    for (const lesson of LESSONS) {
      expect(lesson.goal.length).toBeGreaterThan(20);
      expect(lesson.experiments.length).toBeGreaterThan(0);
      expect(new Set(lesson.experiments.map(({ id }) => id)).size).toBe(lesson.experiments.length);
      for (const experiment of lesson.experiments) {
        expect(normalizeConfig(experiment.config)).toEqual(experiment.config);
      }
      for (const question of [lesson.prediction, lesson.check]) {
        expect(question.options).toHaveLength(3);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(question.options.length);
        expect(question.explanation.length).toBeGreaterThan(30);
      }
      expect(lesson.sources.length).toBeGreaterThan(0);
      lesson.sources.forEach(({ url }) => expect(new URL(url).protocol).toBe('https:'));
    }
  });

  it('measures the independently calculated first GD updates', () => {
    const [small, large] = runLesson(LESSONS[0]).map(({ runs }) => runs[0].points[1]);
    expect(small.x).toBeCloseTo(1.9, 12);
    expect(small.y).toBeCloseTo(0.7, 12);
    expect(large.x).toBeCloseTo(1.8, 12);
    expect(large.y).toBeCloseTo(0.4, 12);
    expect(large.loss).toBeCloseTo(2.1, 12);
    expect(Math.abs(large.y - 1) / Math.abs(large.x - 2)).toBeCloseTo(3, 12);
    expect(large.x - 2).toBeCloseTo(2 * (small.x - 2), 12);
    expect(large.y - 1).toBeCloseTo(2 * (small.y - 1), 12);
  });

  it('demonstrates stable oscillation separately from divergence', () => {
    const [steady, oscillating, unstable] = runLesson(LESSONS[1]).map(({ runs }) => runs[0]);
    expect(steady.points.at(-1)!.loss).toBeLessThan(steady.points[0].loss);
    expect(oscillating.points[1].y).toBeLessThan(0);
    expect(oscillating.points[2].y).toBeGreaterThan(0);
    expect(Math.abs(oscillating.points[2].y)).toBeLessThan(Math.abs(oscillating.points[1].y));
    expect(oscillating.status).not.toBe('diverged');
    expect(oscillating.points.at(-1)!.loss).toBeLessThan(0.001);
    expect(unstable.status).toBe('diverged');
    expect(unstable.points.at(-1)!.step).toBeLessThan(80);
    expect(unstable.points.at(-1)!.loss).toBeGreaterThan(unstable.points[0].loss);
  });

  it('uses matching first updates and differing second updates for memory methods', () => {
    const [gd, momentum, nesterov] = runLesson(LESSONS[2])[0].runs;
    expect(momentum.points[1].x).toBe(gd.points[1].x);
    expect(momentum.points[1].y).toBe(gd.points[1].y);
    expect(nesterov.points[1].x).toBe(gd.points[1].x);
    expect(nesterov.points[1].y).toBe(gd.points[1].y);
    expect(momentum.points[2].x).not.toBe(gd.points[2].x);
    expect(nesterov.points[2].x).not.toBe(momentum.points[2].x);
  });

  it('shows coordinate normalization in the first AdaGrad and Adam updates', () => {
    const [gd, adagrad, adam] = runLesson(LESSONS[3])[0].runs;
    const change = (run: typeof gd) => ({
      x: Math.abs(run.points[1].x - 2),
      y: Math.abs(run.points[1].y - 1),
    });
    expect(change(gd).y / change(gd).x).toBeCloseTo(3, 8);
    for (const run of [adagrad, adam]) {
      expect(change(run).x).toBeCloseTo(0.1, 7);
      expect(change(run).y).toBeCloseTo(0.1, 7);
    }
  });

  it('does not call a saddle or a stationary local basin globally converged', () => {
    const [saddle, noisy, local] = runLesson(LESSONS[4]);
    for (const run of saddle.runs) {
      expect(
        run.points.every(({ x, y, gradientNorm }) => x === 0 && y === 0 && gradientNorm === 0),
      ).toBe(true);
      expect(run.status).toBe('completed');
    }
    expect(noisy.runs[0].points.at(-1)!.loss).toBeLessThan(-1);
    expect(noisy.runs[0].status).toBe('completed');
    expect(local.runs[0].points.at(-1)!.gradientNorm).toBeLessThan(1e-5);
    expect(local.runs[0].points.at(-1)!.loss).toBeGreaterThan(1);
    expect(local.runs[0].status).toBe('completed');
  });

  it('repeats the same measured evidence for a lesson', () => {
    expect(runLesson(LESSONS[4])).toEqual(runLesson(LESSONS[4]));
  });
});

describe('learning progress storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps distinct known identifiers only', () => {
    expect(
      validLessonProgress([LESSONS[0].id, LESSONS[0].id, 'unknown', null, 42, LESSONS[3].id]),
    ).toEqual([LESSONS[0].id, LESSONS[3].id]);
    expect(validLessonProgress({ finished: true })).toEqual([]);
  });

  it('loads validated progress and saves the versioned storage key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify([LESSONS[0].id, 'unknown']),
      setItem,
    });
    expect(loadLessonProgress()).toEqual([LESSONS[0].id]);
    expect(saveLessonProgress([LESSONS[1].id, LESSONS[1].id])).toBe(true);
    expect(setItem).toHaveBeenCalledWith(LEARNING_PROGRESS_KEY, JSON.stringify([LESSONS[1].id]));
  });

  it('handles corrupt and unavailable storage without breaking a lesson', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '{broken',
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(loadLessonProgress()).toEqual([]);
    expect(saveLessonProgress([LESSONS[0].id])).toBe(false);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadLessonProgress()).toEqual([]);
  });
});
