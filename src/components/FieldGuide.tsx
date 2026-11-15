import { ArrowRight, BookOpen, ExternalLink } from 'lucide-react';
import { OPTIMIZERS, getSurface } from '../lib/engine';
import LandscapeGlyph from './LandscapeGlyph';

interface FieldGuideProps {
  onStart: () => void;
}

export default function FieldGuide({ onStart }: FieldGuideProps) {
  return (
    <div className="guide-page">
      <section className="guide-intro">
        <div>
          <div className="section-eyebrow">THE BIG IDEA</div>
          <h2>
            A landscape. A direction.
            <br />A better set of parameters.
          </h2>
          <p>
            Imagine standing on a landscape where height is your model’s loss. An optimizer decides
            how to move downhill. The gradient tells it the local slope; its memory and learning
            rate decide the next step.
          </p>
          <button className="button primary" onClick={onStart}>
            See it on the bowl <ArrowRight size={16} />
          </button>
        </div>
        <LandscapeGlyph surface={getSurface('quadratic')} large />
      </section>
      <div className="section-title-row">
        <h2>Six approaches to the next step</h2>
        <span className="muted">No universal winner. Context matters.</span>
      </div>
      <div className="algorithm-grid">
        {OPTIMIZERS.map((optimizer, i) => (
          <article className="algorithm-card panel" key={optimizer.id}>
            <div className="algorithm-heading">
              <span style={{ background: optimizer.color }}>
                {(i + 1).toString().padStart(2, '0')}
              </span>
              <h3>{optimizer.name}</h3>
            </div>
            <code>{optimizer.formula}</code>
            <p>{optimizer.description}</p>
          </article>
        ))}
      </div>
      <section className="methodology panel">
        <div className="panel-heading">
          <div>
            <h2>Read the results with context</h2>
            <p>A transparent experiment makes a better learning tool.</p>
          </div>
          <BookOpen size={22} />
        </div>
        <div className="method-grid">
          <div>
            <h3>Equal settings ≠ optimal tuning</h3>
            <p>
              All selected algorithms receive the same starting point, learning rate, and shared
              seeded gradient noise. This is a controlled comparison, but each algorithm may need a
              different learning rate to perform well.
            </p>
          </div>
          <div>
            <h3>Height is a visual aid</h3>
            <p>
              The 3D surface uses a normalized asinh height scale to make steep valleys readable.
              The table and exports always use original, unscaled loss values. Paths are drawn over
              the surface for readability.
            </p>
          </div>
          <div>
            <h3>Convergence is checked</h3>
            <p>
              A small true gradient and proximity to a known minimum are required. A stationary
              saddle is not a solution. Divergent runs stop; their last valid state remains visible.
              A finished budget does not imply convergence.
            </p>
          </div>
          <div>
            <h3>Noise is an experiment, too</h3>
            <p>
              Noise is shared uniform additive jitter in gradient coordinates, reproduced from the
              seed. It illustrates stochastic behavior; it does not model a real mini-batch dataset.
            </p>
          </div>
          <div>
            <h3>Understand the chart</h3>
            <p>
              Signed log scale maps loss to sign(L) × log₁₀(1 + |L|), preserving zero and negative
              losses. Switch to a linear scale to compare absolute magnitudes. Both plots use the
              same underlying traces.
            </p>
          </div>
          <div>
            <h3>Where this began</h3>
            <p>
              This laboratory grew from a first-year 1D optimization project. The original
              diagnostics dashboard is preserved alongside the new modular application.
            </p>
            <a href={`${import.meta.env.BASE_URL}legacy/`} target="_blank" rel="noreferrer">
              Open the original 1D lab <ExternalLink size={13} />
            </a>
          </div>
        </div>
        <div className="references">
          <span>FURTHER READING</span>
          <a href="https://arxiv.org/abs/1412.6980" target="_blank" rel="noreferrer">
            Adam paper <ExternalLink size={12} />
          </a>
          <a href="https://jmlr.org/papers/v12/duchi11a.html" target="_blank" rel="noreferrer">
            AdaGrad paper <ExternalLink size={12} />
          </a>
          <a
            href="https://github.com/guptavernit2-afk/descent-lab/blob/main/docs/methodology.md"
            target="_blank"
            rel="noreferrer"
          >
            Full methodology <ExternalLink size={12} />
          </a>
        </div>
      </section>
    </div>
  );
}
