import { useState } from 'react';
import { Braces, ChevronDown, ExternalLink } from 'lucide-react';
import {
  getSurface,
  OPTIMIZERS,
  type ExperimentResult,
  type OptimizerId,
  type Point,
  type StepUpdateDetails,
} from '../lib/engine';
import '../styles/inspector.css';

const EXPLANATIONS: Record<OptimizerId, { title: string; text: string; source: string }> = {
  gd: {
    title: 'One slope, one step.',
    text: 'Each coordinate moves opposite its gradient, multiplied by the same learning rate. A steeper coordinate gets a larger update; no memory is carried forward.',
    source: 'https://distill.pub/2017/momentum/',
  },
  momentum: {
    title: 'The last step still has a say.',
    text: 'The update combines a fraction of the previous velocity with a fresh gradient correction. This memory can carry the optimizer forward even when the current slope changes direction.',
    source: 'https://distill.pub/2017/momentum/',
  },
  nesterov: {
    title: 'Look ahead before correcting course.',
    text: 'The gradient is evaluated at the current position plus the retained velocity. The resulting velocity is still added to the original position, not to the look-ahead point.',
    source: 'https://cs231n.github.io/neural-networks-3/#sgd',
  },
  adagrad: {
    title: 'Every squared gradient leaves a trace.',
    text: 'The denominator uses the accumulated sum of squared gradients for each coordinate. A coordinate with a larger history receives a smaller multiplier. The sum never forgets earlier gradients.',
    source: 'https://jmlr.org/papers/v12/duchi11a.html',
  },
  rmsprop: {
    title: 'Keep a fading memory of scale.',
    text: 'The squared-gradient average retains 90% of its previous value and adds 10% of the new square. This controls each coordinate’s multiplier while gradually forgetting old gradients.',
    source: 'https://www.cs.toronto.edu/~tijmen/csc321/slides/lecture_slides_lec6.pdf',
  },
  adam: {
    title: 'Remember direction and scale.',
    text: 'The first moment tracks direction; the second tracks squared magnitude. Both start at zero, so Adam corrects their initialization bias before dividing the first by the square root of the second.',
    source: 'https://arxiv.org/abs/1412.6980',
  },
};

function value(number: number): string {
  if (number === 0) return '0';
  return Math.abs(number) < 0.0001 || Math.abs(number) >= 10000
    ? number.toExponential(5)
    : Number(number.toPrecision(6)).toString();
}

function Vector({ point }: { point: Point }) {
  return (
    <code title={`x = ${point.x}; y = ${point.y}`}>
      ({value(point.x)}, {value(point.y)})
    </code>
  );
}

function Row({ label, symbol, point }: { label: string; symbol: string; point: Point }) {
  return (
    <tr>
      <th scope="row">
        {label}
        <span>{symbol}</span>
      </th>
      <td>
        <Vector point={point} />
      </td>
    </tr>
  );
}

function MemoryRows({
  update,
  id,
  momentum,
}: {
  update: StepUpdateDetails;
  id: OptimizerId;
  momentum: number;
}) {
  const { memoryBefore: before, memoryAfter: after } = update;
  return (
    <>
      {before.velocity && after.velocity && (
        <>
          <Row label="Previous velocity" symbol="vₜ₋₁" point={before.velocity} />
          <Row
            label="Retained velocity"
            symbol="βvₜ₋₁"
            point={{ x: momentum * before.velocity.x, y: momentum * before.velocity.y }}
          />
          <Row label="New velocity" symbol="vₜ = Δθₜ" point={after.velocity} />
        </>
      )}
      {before.firstMoment && after.firstMoment && (
        <>
          <Row label="Previous first moment" symbol="mₜ₋₁" point={before.firstMoment} />
          <Row
            label="New first moment"
            symbol="mₜ = β₁mₜ₋₁ + (1 − β₁)gₜ"
            point={after.firstMoment}
          />
        </>
      )}
      {before.secondMoment && after.secondMoment && (
        <>
          <Row
            label={id === 'adagrad' ? 'Previous accumulated squares' : 'Previous second moment'}
            symbol={id === 'adam' ? 'vₜ₋₁' : 'sₜ₋₁'}
            point={before.secondMoment}
          />
          <Row
            label={id === 'adagrad' ? 'New accumulated squares' : 'New second moment'}
            symbol={
              id === 'adagrad'
                ? 'sₜ = sₜ₋₁ + gₜ²'
                : id === 'rmsprop'
                  ? 'sₜ = 0.9sₜ₋₁ + 0.1gₜ²'
                  : 'vₜ = 0.999vₜ₋₁ + 0.001gₜ²'
            }
            point={after.secondMoment}
          />
        </>
      )}
      {update.correctedFirstMoment && (
        <Row
          label="Corrected first moment"
          symbol="m̂ₜ = mₜ / (1 − β₁ᵗ)"
          point={update.correctedFirstMoment}
        />
      )}
      {update.correctedSecondMoment && (
        <Row
          label="Corrected second moment"
          symbol="v̂ₜ = vₜ / (1 − β₂ᵗ)"
          point={update.correctedSecondMoment}
        />
      )}
      {update.denominator && (
        <Row
          label="Adaptive denominator"
          symbol={id === 'adam' ? '√v̂ₜ + ε' : '√sₜ + ε'}
          point={update.denominator}
        />
      )}
    </>
  );
}

export default function StepInspector({
  result,
  step,
}: {
  result: ExperimentResult;
  step: number;
}) {
  const [selection, setSelection] = useState<OptimizerId>('gd');
  const run = result.runs.find(({ id }) => id === selection) ?? result.runs[0];
  if (!run) return null;
  const point = run.points[Math.min(Math.max(0, Math.floor(step)), run.points.length - 1)];
  const update = point.update;
  const optimizer = OPTIMIZERS.find(({ id }) => id === run.id)!;
  const explanation = EXPLANATIONS[run.id];
  const surface = getSurface(result.config.surfaceId);
  const memoryExists = update && Object.keys(update.memoryAfter).length > 0;

  return (
    <details className="step-inspector panel" open>
      <summary>
        <span className="inspector-title">
          <Braces size={18} />
          <span>
            <strong>Inside one step</strong>
            <small>Turn a trajectory into an equation you can inspect.</small>
          </span>
        </span>
        <span className="inspector-summary-end">
          ITERATION {point.step}
          <ChevronDown size={16} />
        </span>
      </summary>
      <div className="inspector-body">
        <div className="inspector-intro">
          <div>
            <h3>{explanation.title}</h3>
            <p>{explanation.text}</p>
          </div>
          <label className="inspector-picker">
            <span>Inspect optimizer</span>
            <select
              aria-label="Inspect optimizer"
              value={run.id}
              onChange={(event) => setSelection(event.target.value as OptimizerId)}
            >
              {result.runs.map((item) => (
                <option key={item.id} value={item.id}>
                  {OPTIMIZERS.find(({ id }) => id === item.id)!.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {step > point.step && (
          <p className="inspector-stopped" role="status">
            This run{' '}
            {run.status === 'diverged'
              ? 'stopped before an unsafe update'
              : run.status === 'converged'
                ? 'met the convergence criteria'
                : 'reached its budget'}{' '}
            after iteration {point.step}. Showing its last accepted state; no later movement is
            invented.
          </p>
        )}
        {!update ? (
          <div className="inspector-initial">
            <div>
              <span>{point.step === 0 ? 'STARTING POSITION θ₀' : 'CURRENT POSITION θₜ'}</span>
              <Vector point={point} />
            </div>
            <div>
              <span>
                {point.step === 0 ? 'TRUE GRADIENT AT THE START' : 'TRUE GRADIENT AT THIS POSITION'}
              </span>
              <Vector point={surface.gradient(point.x, point.y)} />
            </div>
            <p>
              {point.step === 0
                ? 'No update has happened yet. Advance one iteration or move the playback slider to reveal the gradient, memory, and exact displacement used by this optimizer.'
                : 'Detailed state was not captured for this batch result. Open the experiment in the laboratory to inspect its updates.'}
            </p>
          </div>
        ) : (
          <>
            <div
              className="inspector-equation"
              aria-label="Before position plus update equals after position"
            >
              <div>
                <span>BEFORE · θₜ₋₁</span>
                <Vector point={update.before} />
              </div>
              <b aria-hidden="true">+</b>
              <div className="inspector-delta">
                <span>UPDATE · Δθₜ</span>
                <Vector point={update.delta} />
              </div>
              <b aria-hidden="true">=</b>
              <div>
                <span>AFTER · θₜ</span>
                <Vector point={point} />
              </div>
            </div>
            <div className="inspector-columns">
              <div>
                <h4>Read the slope</h4>
                <div className="inspector-table-wrap">
                  <table>
                    <caption className="visually-hidden">
                      Gradient and update inputs for {optimizer.name} at iteration {point.step}
                    </caption>
                    <tbody>
                      <Row
                        label={
                          run.id === 'nesterov'
                            ? 'Look-ahead evaluation point'
                            : 'Gradient evaluation point'
                        }
                        symbol={run.id === 'nesterov' ? 'θₜ₋₁ + βvₜ₋₁' : 'θₜ₋₁'}
                        point={update.evaluation}
                      />
                      <Row
                        label="True gradient at that point"
                        symbol="∇f(evaluation)"
                        point={update.trueGradient}
                      />
                      <Row label="Shared seeded noise" symbol="ξₜ" point={update.noise} />
                      <Row
                        label="Gradient used by the update"
                        symbol="gₜ = ∇f + ξₜ"
                        point={update.gradient}
                      />
                      <Row
                        label={
                          run.id === 'adam'
                            ? 'Multiplier applied to m̂ₜ'
                            : 'Multiplier for the fresh gradient'
                        }
                        symbol={
                          update.denominator ? 'η / adaptive denominator' : 'η for both coordinates'
                        }
                        point={update.scaling}
                      />
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4>{memoryExists ? 'Read the memory' : 'Apply the rule'}</h4>
                {memoryExists ? (
                  <div className="inspector-table-wrap">
                    <table>
                      <caption className="visually-hidden">
                        Optimizer memory before and after iteration {point.step}
                      </caption>
                      <tbody>
                        <MemoryRows update={update} id={run.id} momentum={result.config.momentum} />
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="inspector-rule">
                    <code>Δθₜ = −ηgₜ</code>
                    <p>
                      For this update, η = {value(result.config.learningRate)}. Multiply each
                      component of the used gradient by −η, then add that displacement to the
                      previous position.
                    </p>
                    <p>
                      Gradient Descent has no velocity or moment accumulator. Changing the learning
                      rate changes the size of its next correction.
                    </p>
                  </div>
                )}
              </div>
            </div>
            {update.biasCorrection && (
              <div className="inspector-bias">
                <span>Adam’s bias-correction divisors at t = {point.step}</span>
                <code>1 − β₁ᵗ = {value(update.biasCorrection.first)}</code>
                <code>1 − β₂ᵗ = {value(update.biasCorrection.second)}</code>
              </div>
            )}
            <div className="inspector-footer">
              <span>
                {update.denominator ? 'ε = 10⁻⁸ is outside the square root. ' : ''}Values shown to
                six significant digits. Importing an experiment recomputes this state at full
                precision.
              </span>
              <a href={explanation.source} target="_blank" rel="noreferrer">
                Read the underlying method <ExternalLink size={12} />
              </a>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
