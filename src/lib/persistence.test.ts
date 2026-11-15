import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeConfig, runExperiment } from './engine';
import { exportCsv, exportJson, parseExperiment, sharedExperiment, shareUrl } from './persistence';

const configuration = normalizeConfig({
  noise: 0.25,
  seed: 0,
  steps: 20,
  optimizerIds: ['adam', 'gd'],
});
const result = runExperiment(configuration);
const envelope = (overrides: Record<string, unknown> = {}) => ({
  format: 'optimizer-lab/v2',
  config: configuration,
  iteration: 7,
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

describe('portable JSON experiments', () => {
  it('round-trips the full configuration and playback position', () => {
    const parsed = parseExperiment(JSON.parse(exportJson(result, 7)));
    expect(parsed).toEqual({ config: configuration, iteration: 7 });
    expect(runExperiment(parsed.config)).toEqual(result);
  });

  it('exports only observed points while preserving full numerical precision', () => {
    const exported = JSON.parse(exportJson(result, 7));
    expect(exported.runs).toHaveLength(result.runs.length);
    exported.runs.forEach((run: { id: string; points: unknown[] }, index: number) => {
      expect(run.id).toBe(result.runs[index].id);
      expect(run.points).toEqual(
        result.runs[index].points
          .slice(0, 8)
          .map(({ step, x, y, loss, gradientNorm, stepNorm }) => ({
            step,
            x,
            y,
            loss,
            gradientNorm,
            stepNorm,
          })),
      );
    });
  });

  it('exports the starting state at iteration zero', () => {
    const exported = JSON.parse(exportJson(result, 0));
    for (const run of exported.runs) {
      expect(run.points).toHaveLength(1);
      expect(run.points[0].step).toBe(0);
    }
  });

  it('keeps a maximum-length noisy experiment within the import size limit', () => {
    const large = runExperiment(normalizeConfig({ steps: 3000, noise: 0.1 }));
    const json = exportJson(large, 3000);
    expect(new TextEncoder().encode(json).length).toBeLessThan(8_000_000);
    expect(JSON.parse(json).runs[0].points[1]).not.toHaveProperty('update');
    expect(parseExperiment(JSON.parse(json)).config).toEqual(large.config);
  });

  it('recomputes imported traces instead of trusting file-provided measurements', () => {
    const parsed = parseExperiment(
      envelope({ runs: [{ id: 'gd', points: [{ step: 1, loss: -9999 }] }] }),
    );
    expect(runExperiment(parsed.config)).toEqual(result);
    expect(parsed).not.toHaveProperty('runs');
  });

  it.each([
    null,
    [],
    'experiment',
    {},
    { format: 'optimizer-lab/v1' },
    envelope({ config: undefined }),
    envelope({ config: { surfaceId: 'unknown' } }),
    envelope({ config: { steps: 100000000 } }),
  ])('rejects unsupported or invalid imports: %j', (input) => {
    expect(() => parseExperiment(input)).toThrow();
  });

  it.each([
    { iteration: -3, expected: 0 },
    { iteration: 4.9, expected: 4 },
    { iteration: 100, expected: 20 },
    { iteration: Infinity, expected: 0 },
    { iteration: '7', expected: 0 },
    { iteration: undefined, expected: 0 },
  ])('normalizes playback iteration $iteration to $expected', ({ iteration, expected }) => {
    expect(parseExperiment(envelope({ iteration })).iteration).toBe(expected);
  });
});

describe('measurement CSV exports', () => {
  it('includes a complete reproducible record for every observed optimizer step', () => {
    const lines = exportCsv(result, 7).split('\n');
    expect(lines[0]).toBe(
      'surface,optimizer,step,x,y,loss,gradient_norm,step_norm,learning_rate,momentum,noise,seed',
    );
    expect(lines).toHaveLength(1 + 2 * 8);
    let line = 1;
    for (const run of result.runs) {
      for (const point of run.points.slice(0, 8)) {
        const row = lines[line++].split(',');
        expect(row).toHaveLength(12);
        expect(row.slice(0, 2)).toEqual([configuration.surfaceId, run.id]);
        expect(row.slice(2).map(Number)).toEqual([
          point.step,
          point.x,
          point.y,
          point.loss,
          point.gradientNorm,
          point.stepNorm,
          configuration.learningRate,
          configuration.momentum,
          configuration.noise,
          configuration.seed,
        ]);
      }
    }
  });

  it('preserves negative unscaled saddle losses', () => {
    const saddle = runExperiment(
      normalizeConfig({ surfaceId: 'saddle', steps: 100, optimizerIds: ['gd'] }),
    );
    const rows = exportCsv(saddle, 100)
      .split('\n')
      .slice(1)
      .map((line) => line.split(','));
    expect(rows.some((row) => Number(row[5]) < 0)).toBe(true);
    expect(Number(rows.at(-1)![5])).toBe(saddle.runs[0].points.at(-1)!.loss);
  });

  it('exports finite history without fabricating trailing points for divergence', () => {
    const divergent = runExperiment(
      normalizeConfig({ learningRate: 2, optimizerIds: ['gd'], steps: 200 }),
    );
    expect(divergent.runs[0].status).toBe('diverged');
    const rows = exportCsv(divergent, 200).split('\n').slice(1);
    expect(rows).toHaveLength(divergent.runs[0].points.length);
    expect(
      rows.every((row) =>
        row
          .split(',')
          .slice(2)
          .every((value) => Number.isFinite(Number(value))),
      ),
    ).toBe(true);
  });
});

describe('shared experiment links', () => {
  it('round-trips settings and iteration on a repository subpath', () => {
    vi.stubGlobal('window', {
      location: { href: 'https://example.test/idp-optimizer-visual-lab/?view=lab#old-fragment' },
    });
    const url = new URL(shareUrl(configuration, 7));
    expect(url.origin).toBe('https://example.test');
    expect(url.pathname).toBe('/idp-optimizer-visual-lab/');
    expect(url.search).toBe('?view=lab');
    expect(sharedExperiment(url.hash)).toEqual({ config: configuration, iteration: 7 });
  });

  it.each(['', '#', '#main-content', '#experiments', '#experiment'])(
    'ignores an unrelated anchor: %s',
    (hash) => {
      expect(sharedExperiment(hash)).toBeNull();
    },
  );

  it.each(['#experiment=', '#experiment=%E0%A4%A', '#experiment=not-json', '#experiment=%7B%7D'])(
    'rejects a malformed experiment payload: %s',
    (hash) => {
      expect(() => sharedExperiment(hash)).toThrow();
    },
  );

  it('limits payload size before parsing', () => {
    expect(() => sharedExperiment(`#experiment=${'a'.repeat(12000)}`)).toThrow('too large');
  });

  it('validates shared numeric settings before starting a computation', () => {
    const hash = `#experiment=${encodeURIComponent(JSON.stringify(envelope({ config: { steps: 1e9 } })))}`;
    expect(() => sharedExperiment(hash)).toThrow('Iteration budget');
  });
});
