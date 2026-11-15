import { getSurface, OPTIMIZERS, type ExperimentConfig } from './engine';

/** Render a self-contained figure while preserving the current camera and plotted traces. */
export async function exportLandscapePng(
  source: HTMLCanvasElement,
  config: ExperimentConfig,
  iteration: number,
): Promise<Blob> {
  const width = Math.max(1200, source.width);
  const plotHeight = Math.round((source.height / source.width) * width);
  const header = 150;
  const footer = 145;
  const output = document.createElement('canvas');
  output.width = width;
  output.height = header + plotHeight + footer;
  const context = output.getContext('2d');
  if (!context) throw new Error('Image export is not supported in this browser.');
  const surface = getSurface(config.surfaceId);
  context.fillStyle = '#102d29';
  context.fillRect(0, 0, width, output.height);
  context.fillStyle = '#d7e7c7';
  context.font = '500 30px "DM Sans Variable", sans-serif';
  context.fillText(`DescentLab / ${surface.name}`, 38, 49);
  context.fillStyle = '#b5cfbc';
  context.font = '18px "DM Sans Variable", sans-serif';
  context.fillText(surface.formula, 38, 88);
  context.font = '15px "DM Sans Variable", sans-serif';
  context.fillText(
    `Iteration ${iteration} / ${config.steps}   ·   η ${config.learningRate}   ·   Momentum ${config.momentum}   ·   Noise ${config.noise}   ·   Seed ${config.seed}`,
    38,
    122,
  );
  context.drawImage(source, 0, header, width, plotHeight);
  const optimizers = OPTIMIZERS.filter(({ id }) => config.optimizerIds.includes(id));
  const columnWidth = (width - 76) / optimizers.length;
  const legendY = header + plotHeight + 35;
  optimizers.forEach((optimizer, index) => {
    const x = 38 + index * columnWidth;
    context.beginPath();
    context.arc(x + 5, legendY - 5, 4, 0, 2 * Math.PI);
    context.fillStyle = optimizer.color;
    context.fill();
    context.fillStyle = '#d7e7c7';
    context.font = '16px "DM Sans Variable", sans-serif';
    context.fillText(optimizer.shortName, x + 19, legendY);
  });
  context.fillStyle = '#b5cfbc';
  context.font = '14px "DM Sans Variable", sans-serif';
  context.fillText(
    `Start (${config.start.x}, ${config.start.y})  ·  Height: normalized asinh scale  ·  Paths overlaid for readability`,
    38,
    legendY + 37,
  );
  context.fillText(
    'Educational comparison with shared settings; optimizer-specific tuning may change the result.',
    38,
    legendY + 64,
  );
  return new Promise((resolve, reject) =>
    output.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The image could not be exported.'))),
      'image/png',
    ),
  );
}
