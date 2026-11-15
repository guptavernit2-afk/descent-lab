import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ArrowRight,
  Download,
  FlaskConical,
  Info,
  Play,
  SlidersHorizontal,
  Square,
  TrendingDown,
} from 'lucide-react';
import {
  OPTIMIZERS,
  SURFACES,
  getSurface,
  type ExperimentConfig,
  type OptimizerId,
  type SurfaceId,
} from '../lib/engine';
import {
  createStudyConfig,
  logarithmicRates,
  normalizeStudyConfig,
  runStudy,
  StudyCancelledError,
  studyCsv,
  studyJson,
  trialExperiment,
  type StudyCell,
  type StudyConfig,
  type StudyResult,
} from '../lib/study';
import { downloadFile } from '../lib/persistence';
import NumberInput from './NumberInput';
import { formatNumber } from './LossChart';
import '../styles/study.css';

const formatRate = (value: number) =>
  value < 0.001 ? value.toExponential(2) : Number(value.toPrecision(3)).toString();
const cellKey = (cell: Pick<StudyCell, 'optimizerId' | 'learningRate'>) =>
  `${cell.optimizerId}:${cell.learningRate}`;

export default function ParameterStudy({
  initialConfig,
  onOpenExperiment,
}: {
  initialConfig: ExperimentConfig;
  onOpenExperiment: (config: ExperimentConfig) => void;
}) {
  const [settings, setSettings] = useState(() => createStudyConfig(initialConfig));
  const [result, setResult] = useState<StudyResult | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  useEffect(
    () => () => {
      generationRef.current += 1;
      controllerRef.current?.abort();
    },
    [],
  );

  const plannedRates = logarithmicRates(settings.rateMin, settings.rateMax, settings.rateCount);
  const plannedRuns = settings.rateCount * settings.repetitions * OPTIMIZERS.length;
  const selected = result?.cells.find((cell) => cellKey(cell) === selectedKey) ?? result?.cells[0];
  const surface = getSurface(settings.surfaceId);
  const selectedOptimizer = selected && OPTIMIZERS.find(({ id }) => id === selected.optimizerId);
  const resultSurface = result && getSurface(result.config.surfaceId);
  const changedSettings = result && JSON.stringify(settings) !== JSON.stringify(result.config);
  const lossRange = useMemo(() => {
    const values =
      result?.cells.flatMap(({ medianFinalLoss }) =>
        medianFinalLoss === null ? [] : [Math.asinh(medianFinalLoss)],
      ) ?? [];
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [result]);
  const boundaryCount = useMemo(() => {
    if (!result) return 0;
    return OPTIMIZERS.filter(({ id }) => {
      const valid = result.cells.filter(
        (cell) =>
          cell.optimizerId === id &&
          cell.validCount === result.config.repetitions &&
          cell.medianFinalLoss !== null,
      );
      if (
        valid.length < 2 ||
        Math.max(...valid.map((cell) => cell.medianFinalLoss!)) -
          Math.min(...valid.map((cell) => cell.medianFinalLoss!)) <
          1e-12
      )
        return false;
      const best = [...valid].sort((a, b) => a.medianFinalLoss! - b.medianFinalLoss!)[0];
      return best.learningRate === result.rates[0] || best.learningRate === result.rates.at(-1);
    }).length;
  }, [result]);

  function update(patch: Partial<StudyConfig>) {
    try {
      setSettings(normalizeStudyConfig({ ...settings, ...patch }));
      setError('');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Check the study settings.');
      return false;
    }
  }

  function changeSurface(surfaceId: SurfaceId) {
    const nextSurface = getSurface(surfaceId);
    setSettings(
      createStudyConfig({
        ...initialConfig,
        surfaceId,
        start: nextSurface.start,
        learningRate: nextSurface.learningRate,
        steps: settings.steps,
        noise: settings.noise,
        seed: settings.seed,
        momentum: settings.momentum,
      }),
    );
    setError('');
  }

  async function beginStudy(event: FormEvent) {
    event.preventDefault();
    const generation = ++generationRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setResult(null);
    setSelectedKey('');
    setError('');
    setMessage('');
    setRunning(true);
    try {
      const completed = await runStudy(settings, {
        signal: controller.signal,
        onProgress: (completed, total) => {
          if (generationRef.current === generation) setProgress({ completed, total });
        },
      });
      if (generationRef.current !== generation) return;
      setResult(completed);
      setSelectedKey(
        cellKey(
          completed.cells.find((cell) => cell.medianFinalLoss !== null) ?? completed.cells[0],
        ),
      );
      setMessage(
        `Study complete. ${completed.trials.length} trials evaluated; every outcome is included in the report.`,
      );
    } catch (reason) {
      if (generationRef.current !== generation) return;
      if (reason instanceof StudyCancelledError) setMessage(reason.message);
      else setError(reason instanceof Error ? reason.message : 'The study could not finish.');
    } finally {
      if (generationRef.current === generation) setRunning(false);
    }
  }

  function cancelStudy() {
    generationRef.current += 1;
    controllerRef.current?.abort();
    setRunning(false);
    setMessage(
      'Study cancelled. Partial results were discarded; adjust the settings and run again.',
    );
  }

  function heatColor(cell: StudyCell): CSSProperties {
    if (cell.medianFinalLoss === null)
      return { '--study-cell-background': '#fff1e8' } as CSSProperties;
    const ratio =
      lossRange.max > lossRange.min
        ? (Math.asinh(cell.medianFinalLoss) - lossRange.min) / (lossRange.max - lossRange.min)
        : 0.5;
    return { '--study-cell-background': `hsl(87 25% ${87 + ratio * 11}%)` } as CSSProperties;
  }

  function openTrial(
    optimizerId: OptimizerId,
    learningRate: number,
    seed: number,
    allOptimizers = false,
  ) {
    if (result)
      onOpenExperiment(
        trialExperiment(result.config, { optimizerId, learningRate, seed }, allOptimizers),
      );
  }

  return (
    <div className="parameter-study">
      <section className="study-intro panel">
        <span className="study-intro-icon">
          <SlidersHorizontal size={25} strokeWidth={1.5} />
        </span>
        <div>
          <div className="section-eyebrow">ASK A BETTER QUESTION</div>
          <h2>What changes when the learning rate changes?</h2>
          <p>
            Give every optimizer a range of step sizes, then repeat the comparison with shared
            random seeds. Look for stable regions and variability—not a universal winner.
          </p>
        </div>
      </section>

      <form
        className="study-settings panel"
        onSubmit={(event) => {
          void beginStudy(event);
        }}
      >
        <div className="panel-heading">
          <div>
            <h2>Design a controlled study</h2>
            <p>
              One landscape, the same start, and the same maximum iteration budget for every trial.
            </p>
          </div>
          <span className="study-run-count">{plannedRuns} trials</span>
        </div>
        <fieldset disabled={running} className="study-fields">
          <legend className="visually-hidden">Study conditions</legend>
          <label className="field study-surface-field">
            <span className="field-label">Study landscape</span>
            <select
              value={settings.surfaceId}
              onChange={(event) => changeSurface(event.target.value as SurfaceId)}
            >
              {SURFACES.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Minimum learning rate</span>
            <NumberInput
              min={0.000001}
              max={2}
              step="any"
              value={settings.rateMin}
              onCommit={(rateMin) => update({ rateMin })}
            />
          </label>
          <label className="field">
            <span className="field-label">Maximum learning rate</span>
            <NumberInput
              min={0.000001}
              max={2}
              step="any"
              value={settings.rateMax}
              onCommit={(rateMax) => update({ rateMax })}
            />
          </label>
          <label className="field">
            <span className="field-label">Log-spaced rates</span>
            <select
              value={settings.rateCount}
              onChange={(event) => update({ rateCount: Number(event.target.value) })}
            >
              {[3, 4, 5, 6, 7].map((count) => (
                <option key={count}>{count}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Seed repetitions</span>
            <select
              value={settings.repetitions}
              onChange={(event) => update({ repetitions: Number(event.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((count) => (
                <option key={count}>{count}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Study iterations</span>
            <select
              value={settings.steps}
              onChange={(event) => update({ steps: Number(event.target.value) })}
            >
              {[
                200,
                500,
                1000,
                ...(![200, 500, 1000].includes(settings.steps) ? [settings.steps] : []),
              ]
                .sort((a, b) => a - b)
                .map((count) => (
                  <option key={count}>{count}</option>
                ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Study gradient noise</span>
            <NumberInput
              min={0}
              max={2}
              step={0.1}
              value={settings.noise}
              onCommit={(noise) => update({ noise })}
            />
          </label>
          <label className="field">
            <span className="field-label">First random seed</span>
            <NumberInput
              min={0}
              max={4294967295}
              step={1}
              value={settings.seed}
              onCommit={(seed) => update({ seed })}
            />
          </label>
          <label className="field">
            <span className="field-label">Study momentum</span>
            <NumberInput
              min={0}
              max={0.999}
              step="any"
              value={settings.momentum}
              onCommit={(momentum) => update({ momentum })}
            />
          </label>
          <label className="field">
            <span className="field-label">Study start x</span>
            <NumberInput
              min={surface.domain[0]}
              max={surface.domain[1]}
              step="any"
              value={settings.start.x}
              onCommit={(x) => update({ start: { ...settings.start, x } })}
            />
          </label>
          <label className="field">
            <span className="field-label">Study start y</span>
            <NumberInput
              min={surface.domain[0]}
              max={surface.domain[1]}
              step="any"
              value={settings.start.y}
              onCommit={(y) => update({ start: { ...settings.start, y } })}
            />
          </label>
        </fieldset>
        <div className="study-design-note">
          <Info size={15} />
          <p>
            {settings.noise === 0
              ? 'Noise is zero: different seeds reproduce the same trace. Add gradient noise to investigate variation across seeds.'
              : `Each rate and optimizer receives the same ${settings.repetitions} seeded noise streams. Persistent noise disables the engine’s early convergence stop.`}
          </p>
        </div>
        <div className="study-rate-preview">
          <span>RATES TO TEST</span>
          {plannedRates.map((rate) => (
            <code key={rate} title={String(rate)}>
              {formatRate(rate)}
            </code>
          ))}
        </div>
        <div className="study-form-footer">
          <p>
            {OPTIMIZERS.length} optimizers × {settings.rateCount} rates × {settings.repetitions}{' '}
            seeds. All computation stays in this browser.
          </p>
          {running ? (
            <button
              key="cancel-study"
              className="button secondary"
              type="button"
              onClick={(event) => {
                // React may replace the form action during this click. Prevent its native submit.
                event.preventDefault();
                cancelStudy();
              }}
            >
              <Square size={13} />
              Cancel study
            </button>
          ) : (
            <button key="run-study" className="button primary" type="submit">
              <Play size={14} />
              Run parameter study
            </button>
          )}
        </div>
        {running && (
          <div className="study-progress">
            <label htmlFor="study-progress">
              Evaluating trial {progress.completed} of {progress.total}
            </label>
            <progress
              id="study-progress"
              max={progress.total || plannedRuns}
              value={progress.completed}
            />
          </div>
        )}
        {error && (
          <p className="study-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="study-message" role="status">
            {message}
          </p>
        )}
      </form>

      {result && (
        <>
          <section className="study-results panel" aria-labelledby="study-results-title">
            <div className="panel-heading">
              <div>
                <h2 id="study-results-title">A map of sensitivity</h2>
                <p>
                  {resultSurface?.name} · {result.config.steps} iteration budget · seeds{' '}
                  {result.seeds.join(', ')} · noise {result.config.noise}
                </p>
              </div>
              <div className="study-downloads">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    downloadFile(
                      `descent-lab-study-${result.config.surfaceId}.csv`,
                      studyCsv(result),
                      'text/csv;charset=utf-8',
                    )
                  }
                >
                  <Download size={14} />
                  Trial CSV
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    downloadFile(
                      `descent-lab-study-${result.config.surfaceId}.json`,
                      studyJson(result),
                      'application/json',
                    )
                  }
                >
                  <Download size={14} />
                  Study JSON
                </button>
              </div>
            </div>
            {changedSettings && (
              <div className="study-snapshot-note">
                The setup has changed. These results describe the completed study above; run again
                to apply your new settings.
              </div>
            )}
            <p className="study-matrix-explainer">
              Each cell shows median terminal loss among non-divergent trials. Darker sage means
              lower loss within this study; failure counts are shown separately. Select a cell to
              inspect every seed.
            </p>
            <div
              className="study-matrix-scroll"
              role="region"
              aria-label="Optimizer and learning rate results, scroll horizontally if needed"
              tabIndex={0}
            >
              <table className="study-matrix">
                <caption className="visually-hidden">
                  Median loss by optimizer and learning rate, with surviving and divergent trial
                  counts.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Optimizer / η</th>
                    {result.rates.map((rate) => (
                      <th scope="col" key={rate} title={String(rate)}>
                        {formatRate(rate)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OPTIMIZERS.map((optimizer) => (
                    <tr key={optimizer.id}>
                      <th scope="row">
                        <i style={{ background: optimizer.color }} />
                        {optimizer.shortName}
                      </th>
                      {result.rates.map((rate) => {
                        const cell = result.cells.find(
                          (item) => item.optimizerId === optimizer.id && item.learningRate === rate,
                        )!;
                        return (
                          <td key={rate}>
                            <button
                              type="button"
                              className={`study-cell ${cellKey(cell) === selectedKey ? 'selected' : ''}`}
                              style={heatColor(cell)}
                              aria-pressed={cellKey(cell) === selectedKey}
                              aria-label={`Inspect ${optimizer.name} at learning rate ${formatRate(rate)}: ${cell.medianFinalLoss === null ? 'all trials diverged' : `median loss ${formatNumber(cell.medianFinalLoss)}`}, ${cell.divergedCount} divergent trials`}
                              onClick={() => setSelectedKey(cellKey(cell))}
                            >
                              <strong>
                                {cell.medianFinalLoss === null
                                  ? 'Diverged'
                                  : formatNumber(cell.medianFinalLoss)}
                              </strong>
                              <span>
                                {cell.validCount}/{result.config.repetitions} valid outcomes
                              </span>
                              {cell.divergedCount > 0 && <em>{cell.divergedCount} diverged</em>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="study-results-footnote">
              <TrendingDown size={15} />
              <p>
                Converged runs can stop early. “Valid” only means the numerical safety guard did not
                stop the run. Low loss, reaching a known minimum, and avoiding divergence are
                different observations.
              </p>
            </div>
          </section>

          {selected && (
            <section className="study-details panel" aria-labelledby="study-details-title">
              <div className="panel-heading">
                <div>
                  <h2 id="study-details-title">
                    {selectedOptimizer?.name} · η {formatRate(selected.learningRate)}
                  </h2>
                  <p>Inspect the full seed sample before interpreting the median.</p>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    openTrial(
                      selected.optimizerId,
                      selected.learningRate,
                      selected.trials[0].seed,
                      true,
                    )
                  }
                >
                  Compare this rate in the lab <ArrowRight size={14} />
                </button>
              </div>
              <div className="study-summary">
                <div>
                  <span>MEDIAN TERMINAL LOSS</span>
                  <strong>
                    {selected.medianFinalLoss === null
                      ? 'No valid result'
                      : formatNumber(selected.medianFinalLoss)}
                  </strong>
                  <small>
                    {selected.validCount} of {result.config.repetitions} trials included
                  </small>
                </div>
                <div>
                  <span>OBSERVED LOSS RANGE</span>
                  <strong>
                    {selected.minFinalLoss === null
                      ? '—'
                      : `${formatNumber(selected.minFinalLoss)} to ${formatNumber(selected.maxFinalLoss!)}`}
                  </strong>
                  <small>Minimum–maximum, not a confidence interval</small>
                </div>
                <div>
                  <span>REACHED KNOWN MINIMUM</span>
                  <strong>
                    {selected.convergedCount} / {result.config.repetitions}
                  </strong>
                  <small>{selected.divergedCount} divergent trials</small>
                </div>
              </div>
              <div className="table-scroll">
                <table className="study-trial-table">
                  <caption className="visually-hidden">
                    Individual seed outcomes for the selected optimizer and learning rate
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Seed</th>
                      <th scope="col">Outcome</th>
                      <th scope="col">Terminal loss</th>
                      <th scope="col">Best recorded loss</th>
                      <th scope="col">Accepted steps</th>
                      <th scope="col">Investigate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.trials.map((trial) => (
                      <tr key={trial.seed}>
                        <th scope="row">{trial.seed}</th>
                        <td>
                          {trial.status === 'completed'
                            ? 'Budget reached'
                            : trial.status === 'converged'
                              ? 'Known minimum'
                              : 'Diverged'}
                        </td>
                        <td className="numeric">
                          {trial.finalLoss === null ? '—' : formatNumber(trial.finalLoss)}
                          {trial.status === 'diverged' && (
                            <span className="study-last-finite">
                              Last finite: {formatNumber(trial.lastFiniteLoss)}
                            </span>
                          )}
                        </td>
                        <td className="numeric">{formatNumber(trial.bestRecordedLoss)}</td>
                        <td>{trial.completedSteps}</td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              openTrial(trial.optimizerId, trial.learningRate, trial.seed)
                            }
                          >
                            Replay seed {trial.seed}
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="study-detail-note">
                A divergent trial has no terminal loss. Its last finite value and best recorded loss
                remain visible so an early low value cannot hide a later failure. Replay opens that
                exact configuration at iteration zero.
              </p>
            </section>
          )}

          <section className="study-interpretation panel">
            <div>
              <FlaskConical size={20} />
              <h2>Turn the result into a question</h2>
            </div>
            <ul>
              <li>
                Compare rates within one algorithm before comparing algorithms. A shared rate is a
                control, not necessarily good tuning for each method.
              </li>
              <li>
                {boundaryCount > 0
                  ? `${boundaryCount} algorithm${boundaryCount > 1 ? 's have' : ' has'} its lowest fully valid median at a boundary of this range. Try a wider or finer range before choosing a rate.`
                  : 'A narrow range can miss a useful region. Change one condition at a time and check whether your observation survives.'}
              </li>
              <li>
                {result.config.noise === 0
                  ? 'With zero noise, repeated seeds are identical. Add noise and repeat to ask whether your conclusion is robust to this synthetic variation.'
                  : 'These few seeds describe this sample only. Their minimum–maximum range is not a confidence interval or evidence about all possible runs.'}
              </li>
              <li>
                These two-parameter surfaces illustrate optimization mechanics. They do not measure
                validation accuracy or establish performance on neural-network training.
              </li>
            </ul>
          </section>
        </>
      )}

      {!result && !running && (
        <section className="study-empty panel">
          <SlidersHorizontal size={30} strokeWidth={1.4} />
          <h2>One run is a starting point.</h2>
          <p>
            A rate sweep reveals where progress is slow, where updates become unstable, and where a
            method is sensitive to noise. Set your conditions, then let the evidence guide the next
            experiment.
          </p>
        </section>
      )}
      <div className="study-sources">
        <span>WHY LOG-SPACED RATES?</span>
        <p>
          Learning rates act multiplicatively. This small grid makes one-dimensional sensitivity
          visible; it is not a claim that grids are the best strategy for broad hyperparameter
          searches.
        </p>
        <a
          href="https://cs231n.github.io/neural-networks-3/#hyperparameter-optimization"
          target="_blank"
          rel="noreferrer"
        >
          Stanford CS231n: hyperparameter optimization <ArrowRight size={12} />
        </a>
        <a href="https://arxiv.org/abs/1206.5533" target="_blank" rel="noreferrer">
          Bengio: practical training recommendations <ArrowRight size={12} />
        </a>
        <p>
          Study JSON is a report containing every trial summary. Use “Replay seed” to open a single
          experiment; report files are not accepted by the laboratory’s experiment importer.
        </p>
      </div>
    </div>
  );
}
