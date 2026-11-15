import { ArrowRight, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { getSurface } from '../lib/engine';
import { PRESETS, type ExperimentPreset } from '../lib/presets';
import type { SavedExperiment } from '../lib/persistence';
import LandscapeGlyph from './LandscapeGlyph';

interface ExperimentNotebookProps {
  saved: SavedExperiment[];
  onOpen: (experiment: SavedExperiment) => void;
  onDelete: (id: string) => void;
  onPreset: (preset: ExperimentPreset) => void;
  onCreate: () => void;
}

export default function ExperimentNotebook({
  saved,
  onOpen,
  onDelete,
  onPreset,
  onCreate,
}: ExperimentNotebookProps) {
  return (
    <div className="experiments-page">
      <div className="section-title-row">
        <h2>
          Your experiment notebook <span>{saved.length}</span>
        </h2>
        <span className="muted">Stored on this device · up to 20 experiments</span>
      </div>
      {saved.length === 0 ? (
        <div className="empty-state panel">
          <span className="empty-icon">
            <FolderOpen size={32} strokeWidth={1.2} />
          </span>
          <h2>A home for your discoveries.</h2>
          <p>
            Save an experiment from the lab to keep its settings and playback position. Export JSON
            to take it with you.
          </p>
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} />
            Create an experiment
          </button>
        </div>
      ) : (
        <div className="saved-grid">
          {saved.map((item) => (
            <article className="saved-card panel" key={item.id}>
              <div className="saved-card-art">
                <LandscapeGlyph surface={getSurface(item.config.surfaceId)} large />
                <span>{getSurface(item.config.surfaceId).shortName}</span>
              </div>
              <div className="saved-card-body">
                <h3>{item.name}</h3>
                <p>
                  {item.config.optimizerIds.length} optimizers · η {item.config.learningRate} ·{' '}
                  {item.config.steps} iterations
                </p>
                <span className="saved-date">
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  · seed {item.config.seed}
                </span>
                <div>
                  <button className="text-button" onClick={() => onOpen(item)}>
                    Open experiment <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button "
                    title={`Delete ${item.name}`}
                    aria-label={`Delete ${item.name}`}
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="section-title-row presets-title">
        <h2>Start with a question</h2>
        <span className="muted">Four small experiments. Plenty to discover.</span>
      </div>
      <div className="preset-grid">
        {PRESETS.map((preset, i) => (
          <button key={preset.name} className="preset-card" onClick={() => onPreset(preset)}>
            <div>
              <preset.icon size={22} strokeWidth={1.4} />
              <span>0{i + 1}</span>
            </div>
            <h3>{preset.name}</h3>
            <p>{preset.description}</p>
            <span className="text-button">
              Open exploration <ArrowRight size={14} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
