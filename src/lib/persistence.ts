import { normalizeConfig, type ExperimentConfig, type ExperimentResult } from './engine';

const STORAGE_KEY = 'optimizer-lab.experiments.v2';
export interface SavedExperiment {
  id: string;
  name: string;
  createdAt: string;
  config: ExperimentConfig;
  iteration: number;
}

export function loadExperiments(): SavedExperiment[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 20).flatMap((item) => {
      try {
        if (
          !item ||
          typeof item.id !== 'string' ||
          typeof item.name !== 'string' ||
          typeof item.createdAt !== 'string'
        )
          return [];
        const config = normalizeConfig(item.config);
        return [
          {
            id: item.id,
            name: item.name.slice(0, 100),
            createdAt: item.createdAt,
            config,
            iteration: validIteration(item.iteration, config.steps),
          },
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function storeExperiments(experiments: SavedExperiment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(experiments.slice(0, 20)));
}

function validIteration(value: unknown, budget: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(budget, Math.floor(value)))
    : 0;
}

export function parseExperiment(input: unknown): { config: ExperimentConfig; iteration: number } {
  if (!input || typeof input !== 'object') throw new Error('Choose an Optimizer Lab JSON export.');
  const data = input as Record<string, unknown>;
  if (data.format !== 'optimizer-lab/v2')
    throw new Error('This file is not a supported Optimizer Lab v2 experiment.');
  const config = normalizeConfig(data.config);
  return { config, iteration: validIteration(data.iteration, config.steps) };
}

export function sharedExperiment(
  hash: string,
): { config: ExperimentConfig; iteration: number } | null {
  if (!hash.startsWith('#experiment=')) return null;
  if (hash.length > 12000) throw new Error('This shared experiment is too large.');
  return parseExperiment(JSON.parse(decodeURIComponent(hash.slice(12))));
}

export function shareUrl(config: ExperimentConfig, iteration: number): string {
  const url = new URL(window.location.href);
  url.hash = `experiment=${encodeURIComponent(JSON.stringify({ format: 'optimizer-lab/v2', config, iteration }))}`;
  return url.toString();
}

export function exportJson(result: ExperimentResult, iteration: number): string {
  return JSON.stringify(
    {
      format: 'optimizer-lab/v2',
      config: result.config,
      iteration,
      note: 'Traces contain only steps up to the exported playback iteration. Import recomputes from the configuration.',
      runs: result.runs.map((run) => ({
        id: run.id,
        points: run.points.filter((point) => point.step <= iteration),
      })),
    },
    null,
    2,
  );
}

export function exportCsv(result: ExperimentResult, iteration: number): string {
  const header =
    'surface,optimizer,step,x,y,loss,gradient_norm,step_norm,learning_rate,momentum,noise,seed';
  const { config } = result;
  return [
    header,
    ...result.runs.flatMap((run) =>
      run.points
        .filter((point) => point.step <= iteration)
        .map((point) =>
          [
            config.surfaceId,
            run.id,
            point.step,
            point.x,
            point.y,
            point.loss,
            point.gradientNorm,
            point.stepNorm,
            config.learningRate,
            config.momentum,
            config.noise,
            config.seed,
          ].join(','),
        ),
    ),
  ].join('\n');
}

export function downloadFile(filename: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
