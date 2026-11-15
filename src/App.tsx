import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2 as Github,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  FlaskConical,
  FolderOpen,
  Grid2X2,
  GraduationCap,
  SlidersHorizontal,
  Layers3,
  Menu,
  Mountain,
  MousePointer2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Share2,
  SkipForward,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import SurfaceCanvas from './components/SurfaceCanvas';
import LossChart, { formatNumber } from './components/LossChart';
import NumberInput from './components/NumberInput';
import LandscapeGlyph from './components/LandscapeGlyph';
import FieldGuide from './components/FieldGuide';
import ExperimentNotebook from './components/ExperimentNotebook';
import LearningPath from './components/LearningPath';
import ParameterStudy from './components/ParameterStudy';
import StepInspector from './components/StepInspector';
import RegressionPanel from './components/RegressionPanel';
import { PRESETS, type ExperimentPreset } from './lib/presets';
import { exportLandscapePng } from './lib/figure';
import {
  DEFAULT_CONFIG,
  OPTIMIZERS,
  SURFACES,
  getSurface,
  normalizeConfig,
  runExperiment,
  type ExperimentConfig,
  type OptimizerId,
  type OptimizerRun,
  type SurfaceId,
} from './lib/engine';
import {
  downloadFile,
  exportCsv,
  exportJson,
  loadExperiments,
  parseExperiment,
  shareUrl,
  sharedExperiment,
  storeExperiments,
} from './lib/persistence';

type Page = 'lab' | 'learn' | 'study' | 'experiments' | 'guide';
type Modal = 'export' | 'share' | 'save' | 'help' | null;
const REPO_URL = 'https://github.com/guptavernit2-afk/idp-optimizer-visual-lab';
const PAGE_META = {
  lab: {
    label: 'Laboratory',
    title: 'Every step tells a story.',
    description: 'Explore the landscape. Compare the paths. Understand the descent.',
  },
  learn: {
    label: 'Learning path',
    title: 'Turn a prediction into understanding.',
    description:
      'Five guided experiments. Predict, observe, explain—and take the idea into the lab.',
  },
  study: {
    label: 'Parameter studies',
    title: 'One run is a starting point.',
    description:
      'Investigate learning-rate sensitivity and repeat across seeds before drawing conclusions.',
  },
  experiments: {
    label: 'Experiments',
    title: 'Good questions. Saved.',
    description: 'Keep your discoveries close. Revisit, reproduce, and keep exploring.',
  },
  guide: {
    label: 'Field guide',
    title: 'A little theory. A lot of intuition.',
    description: 'Get to know the ideas behind the trajectories.',
  },
};
function pageFromUrl(): Page {
  if (window.location.hash.startsWith('#experiment=')) return 'lab';
  const requested = new URL(window.location.href).searchParams.get('page');
  return requested && Object.hasOwn(PAGE_META, requested) ? (requested as Page) : 'lab';
}
function initialState() {
  try {
    return {
      ...(sharedExperiment(window.location.hash) || { config: DEFAULT_CONFIG, iteration: 0 }),
      error: '',
    };
  } catch {
    return {
      config: DEFAULT_CONFIG,
      iteration: 0,
      error: 'That shared experiment could not be loaded. A fresh lab is ready.',
    };
  }
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {hint && <span>{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function ModalDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}

export default function App() {
  const [initial] = useState(initialState);
  const [config, setConfig] = useState<ExperimentConfig>(initial.config);
  const [step, setStep] = useState(initial.iteration);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState<Page>(pageFromUrl);
  const [mode, setMode] = useState<'surface' | 'contour'>('surface');
  const [showTrails, setShowTrails] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [logarithmic, setLogarithmic] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState(initial.error);
  const [saved, setSaved] = useState(loadExperiments);
  const [experimentName, setExperimentName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const result = useMemo(() => runExperiment(config), [config]);
  const surface = getSurface(config.surfaceId);
  const currentPoints = result.runs.map((run) => ({
    run,
    point: run.points[Math.min(step, run.points.length - 1)],
  }));
  const best = currentPoints.reduce<(typeof currentPoints)[number] | undefined>(
    (winner, item) => (!winner || item.point.loss < winner.point.loss ? item : winner),
    undefined,
  );
  const completed = step >= config.steps;
  const allStopped = currentPoints.every(
    ({ run }) => step >= run.points.at(-1)!.step + (run.status === 'diverged' ? 1 : 0),
  );
  const activeDiverged = currentPoints.filter(
    ({ run }) => run.status === 'diverged' && step > run.points.at(-1)!.step,
  );
  const currentBestLoss = currentPoints.length
    ? Math.min(...currentPoints.map(({ point }) => point.loss))
    : 0;
  const initialLoss = surface.value(config.start.x, config.start.y);
  const improvement =
    initialLoss !== 0 ? ((initialLoss - currentBestLoss) / Math.abs(initialLoss)) * 100 : null;

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    if (modal) setRunning(false);
  }, [modal]);
  useEffect(() => {
    const handler = () => {
      setPage(pageFromUrl());
      setRunning(false);
      setMenuOpen(false);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  useEffect(() => {
    if (!running) return;
    let id = 0,
      last = 0,
      fraction = 0;
    const animate = (now: number) => {
      if (!last) last = now;
      fraction += (Math.min(now - last, 100) / 1000) * 48 * speed;
      last = now;
      if (fraction >= 1) {
        const increment = Math.floor(fraction);
        fraction -= increment;
        setStep((value) => Math.min(config.steps, value + increment));
      }
      id = requestAnimationFrame(animate);
    };
    id = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(id);
  }, [running, speed, config.steps]);
  useEffect(() => {
    if (completed || (allStopped && step > 0)) setRunning(false);
  }, [completed, allStopped, step]);
  useEffect(() => {
    const handler = () => {
      try {
        const value = sharedExperiment(window.location.hash);
        if (value) {
          setConfig(value.config);
          setStep(value.iteration);
          setRunning(false);
          setPage('lab');
        }
      } catch {
        setToast('This shared experiment is invalid. Your current setup is unchanged.');
      }
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        modal ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'CANVAS', 'A'].includes(event.target.tagName))
      )
        return;
      if (page === 'lab' && event.code === 'Space') {
        event.preventDefault();
        toggleRun();
      }
      if (page === 'lab' && event.key.toLowerCase() === 'r') reset();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  function updateConfig(patch: Partial<ExperimentConfig>) {
    try {
      setConfig(normalizeConfig({ ...config, ...patch }));
      setStep(0);
      setRunning(false);
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Check your experiment settings.');
      return false;
    }
  }
  function changeSurface(id: SurfaceId) {
    const selected = getSurface(id);
    updateConfig({ surfaceId: id, start: selected.start, learningRate: selected.learningRate });
    setCameraKey((v) => v + 1);
  }
  function toggleRun() {
    if (completed || allStopped) setStep(0);
    setRunning((value) => !value);
  }
  function reset() {
    setRunning(false);
    setStep(0);
  }
  function navigate(next: Page) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', next);
    if (url.hash.startsWith('#experiment=')) url.hash = '';
    if (url.href !== window.location.href) window.history.pushState({}, '', url);
    setPage(next);
    setRunning(false);
    setMenuOpen(false);
  }
  function openInLab(nextConfig: ExperimentConfig) {
    setConfig(normalizeConfig(nextConfig));
    setStep(0);
    setCameraKey((value) => value + 1);
    navigate('lab');
    setToast('Experiment loaded. Inspect each update or run the full trajectory.');
  }
  function applyPreset(preset: ExperimentPreset) {
    const selected = getSurface(preset.surfaceId);
    setConfig(
      normalizeConfig({
        ...DEFAULT_CONFIG,
        surfaceId: preset.surfaceId,
        start: selected.start,
        learningRate: preset.learningRate,
        noise: preset.noise,
        steps: preset.steps,
      }),
    );
    setStep(0);
    setRunning(false);
    navigate('lab');
    setCameraKey((v) => v + 1);
    setToast(`“${preset.name}” is ready. Press Run experiment to begin.`);
  }
  function toggleOptimizer(id: OptimizerId) {
    const enabled = config.optimizerIds.includes(id);
    if (enabled && config.optimizerIds.length === 1) {
      setToast('Keep at least one optimizer in the experiment.');
      return;
    }
    updateConfig({
      optimizerIds: enabled
        ? config.optimizerIds.filter((value) => value !== id)
        : [...config.optimizerIds, id],
    });
  }
  function saveExperiment(event: React.FormEvent) {
    event.preventDefault();
    const next = [
      {
        id: crypto.randomUUID(),
        name: experimentName.trim() || `${surface.name} experiment`,
        createdAt: new Date().toISOString(),
        config: structuredClone(config),
        iteration: step,
      },
      ...saved,
    ].slice(0, 20);
    try {
      storeExperiments(next);
      setSaved(next);
      setModal(null);
      setToast('Experiment saved to this browser.');
    } catch {
      setToast('Browser storage is unavailable. Export JSON to keep this experiment.');
    }
  }
  function deleteExperiment(id: string) {
    const next = saved.filter((item) => item.id !== id);
    try {
      storeExperiments(next);
      setSaved(next);
      setToast('Saved experiment removed.');
    } catch {
      setToast('Browser storage is unavailable.');
    }
  }
  async function importExperiment(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error('Choose a JSON file smaller than 8 MB.');
      const imported = parseExperiment(JSON.parse(await file.text()));
      setConfig(imported.config);
      setStep(imported.iteration);
      setRunning(false);
      navigate('lab');
      setToast('Experiment imported. Results reproduced from its settings.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to read this experiment.');
    }
    if (importRef.current) importRef.current.value = '';
  }
  function statusFor(run: OptimizerRun): string {
    const lastStep = run.points.at(-1)!.step;
    if (run.status === 'diverged' && step > lastStep) return 'Diverged';
    if (run.status === 'converged' && step >= lastStep) return 'Converged';
    if (step >= config.steps) return 'Budget reached';
    return step === 0 ? 'Ready' : running ? 'Running' : 'Paused';
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to experiment
      </a>
      {menuOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            navigate('lab');
          }}
        >
          <span className="brand-mark">
            <Mountain size={25} strokeWidth={1.5} />
          </span>
          <span>
            optimizer
            <span className="brand-light">
              lab<span className="brand-dot">.</span>
            </span>
          </span>
        </a>
        <div className="workspace-label">
          THE LEARNING WORKSPACE <span>02</span>
        </div>
        <nav aria-label="Main navigation">
          <button
            className={page === 'lab' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('lab')}
          >
            <FlaskConical size={18} />
            Laboratory
            <span className="nav-dot" />
          </button>
          <button
            className={page === 'learn' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('learn')}
          >
            <GraduationCap size={18} />
            Learning path
            <span className="nav-dot" />
          </button>
          <button
            className={page === 'study' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('study')}
          >
            <SlidersHorizontal size={18} />
            Parameter studies
            <span className="nav-dot" />
          </button>
          <button
            className={page === 'experiments' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('experiments')}
          >
            <FolderOpen size={18} />
            Experiments<span className="nav-count">{saved.length.toString().padStart(2, '0')}</span>
          </button>
          <button
            className={page === 'guide' ? 'nav-item active' : 'nav-item'}
            onClick={() => navigate('guide')}
          >
            <BookOpen size={18} />
            Field guide
            <ChevronRight className="nav-end" size={14} />
          </button>
        </nav>
        <div className="sidebar-rule" />
        <div className="section-eyebrow sidebar-label">QUICK EXPLORATIONS</div>
        <div className="preset-nav">
          {PRESETS.slice(0, 3).map((preset, index) => (
            <button key={preset.name} onClick={() => applyPreset(preset)}>
              <span>0{index + 1}</span>
              {preset.name}
              <ArrowRight size={13} />
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="curiosity-card">
            <span className="small-orbit">
              <Sparkles size={19} />
            </span>
            <h3>Follow your curiosity.</h3>
            <p>
              Change one thing.
              <br />
              See what happens next.
            </p>
            <button
              onClick={() => {
                setModal('help');
              }}
            >
              A quick look around <ArrowRight size={14} />
            </button>
          </div>
          <a className="source-link" href={REPO_URL} target="_blank" rel="noreferrer">
            <Github size={16} />
            Open source project
            <ExternalLink size={12} />
          </a>
          <div className="sidebar-footer">
            <span className="online-dot" /> Runs entirely in your browser
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label="Open navigation"
              className="mobile-menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </IconButton>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{PAGE_META[page].label}</strong>
          </div>
          <div className="topbar-right">
            <span className="version-pill">VERSION 2.1</span>
            <IconButton label="Open help" onClick={() => setModal('help')}>
              <CircleHelp size={19} />
            </IconButton>
            <a
              className="avatar"
              href={REPO_URL}
              aria-label="Vernit Gupta's project on GitHub"
              target="_blank"
              rel="noreferrer"
            >
              VG
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> A VISUAL STUDY OF OPTIMIZATION
              </div>
              <h1>{PAGE_META[page].title}</h1>
              <p>{PAGE_META[page].description}</p>
            </div>
            {page === 'lab' ? (
              <div className="heading-actions">
                <button
                  className="button secondary"
                  onClick={() => {
                    setCopied(false);
                    setModal('share');
                  }}
                >
                  <Share2 size={15} />
                  Share
                </button>
                <button className="button secondary" onClick={() => setModal('export')}>
                  <ArrowDownToLine size={16} />
                  Export
                  <ChevronDown size={13} />
                </button>
              </div>
            ) : (
              <button className="button secondary" onClick={() => importRef.current?.click()}>
                <Upload size={16} />
                Import experiment
              </button>
            )}
          </div>
          {page === 'lab' && (
            <>
              <div className="learning-invitation">
                <GraduationCap size={20} />
                <div>
                  <strong>Start with a question.</strong>
                  <span>Predict a step, test it, then explain the result.</span>
                </div>
                <button className="text-button" onClick={() => navigate('learn')}>
                  Guided lessons <ArrowRight size={14} />
                </button>
                <button className="text-button" onClick={() => changeSurface('regression')}>
                  Fit a model <ArrowRight size={14} />
                </button>
              </div>
              <div className="lab-layout">
                <div className="visualization-column">
                  <section className="surface-panel" aria-labelledby="surface-heading">
                    <div className="surface-toolbar">
                      <div>
                        <span className="section-eyebrow">LOSS LANDSCAPE</span>
                        <h2 id="surface-heading">
                          {surface.name}
                          <span className="surface-tag">
                            {surface.id === 'quadratic' || surface.id === 'regression'
                              ? 'CONVEX'
                              : 'NON-CONVEX'}
                          </span>
                        </h2>
                      </div>
                      <div className="view-switch" role="group" aria-label="Visualization mode">
                        <button
                          aria-pressed={mode === 'surface'}
                          onClick={() => setMode('surface')}
                        >
                          <Box size={14} />
                          3D surface
                        </button>
                        <button
                          aria-pressed={mode === 'contour'}
                          onClick={() => setMode('contour')}
                        >
                          <Grid2X2 size={14} />
                          Contour
                        </button>
                      </div>
                    </div>
                    <div className="canvas-wrap">
                      <SurfaceCanvas
                        surface={surface}
                        runs={result.runs}
                        step={step}
                        mode={mode}
                        showTrails={showTrails}
                        showGrid={showGrid}
                        onStartChange={(start) => updateConfig({ start })}
                        resetKey={cameraKey}
                      />
                      <div className="canvas-topline">
                        <span className="formula-badge">{surface.formula}</span>
                        <span className="live-badge">
                          <span className={running ? 'pulse' : ''} />
                          {running
                            ? 'RUNNING'
                            : step === 0
                              ? 'READY TO EXPLORE'
                              : completed || allStopped
                                ? 'COMPLETE'
                                : 'PAUSED'}
                        </span>
                      </div>
                      <div className="canvas-actions">
                        <IconButton label="Reset camera" onClick={() => setCameraKey((v) => v + 1)}>
                          <RotateCcw size={16} />
                        </IconButton>
                        <button
                          title="Toggle grid"
                          aria-label="Toggle grid"
                          aria-pressed={showGrid}
                          onClick={() => setShowGrid((v) => !v)}
                        >
                          <Grid2X2 size={16} />
                        </button>
                        <button
                          title="Toggle trajectories"
                          aria-label="Toggle trajectories"
                          aria-pressed={showTrails}
                          onClick={() => setShowTrails((v) => !v)}
                        >
                          <Activity size={16} />
                        </button>
                      </div>
                      <div className="canvas-caption">
                        <span>
                          <MousePointer2 size={12} />
                          {mode === 'surface'
                            ? 'Drag to orbit · Scroll to zoom'
                            : 'Click the map to set a starting point'}
                        </span>
                        <span>Height: asinh scale</span>
                      </div>
                    </div>
                    <div className="plot-legend">
                      <div className="legend-items">
                        {OPTIMIZERS.filter((o) => config.optimizerIds.includes(o.id)).map((o) => (
                          <span key={o.id}>
                            <i style={{ backgroundColor: o.color }} />
                            {o.shortName}
                          </span>
                        ))}
                      </div>
                      <span className="minimum-key">
                        <Crosshair size={13} />
                        Known minimum
                      </span>
                    </div>
                    <div className="playback">
                      <button className="button run-button" onClick={toggleRun}>
                        {running ? (
                          <Pause size={16} fill="currentColor" />
                        ) : (
                          <Play size={16} fill="currentColor" />
                        )}
                        {running
                          ? 'Pause'
                          : completed || allStopped
                            ? 'Run again'
                            : step === 0
                              ? 'Run experiment'
                              : 'Resume'}
                      </button>
                      <IconButton label="Reset experiment" onClick={reset}>
                        <RotateCcw size={16} />
                      </IconButton>
                      <IconButton
                        label="Advance one iteration"
                        onClick={() => {
                          setRunning(false);
                          setStep((v) => Math.min(config.steps, v + 1));
                        }}
                        disabled={completed}
                      >
                        <SkipForward size={16} />
                      </IconButton>
                      <div className="playback-progress">
                        <label htmlFor="iteration">
                          Iteration{' '}
                          <strong data-testid="iteration-value">
                            {step.toString().padStart(3, '0')}
                          </strong>
                          <span>/ {config.steps}</span>
                        </label>
                        <input
                          id="iteration"
                          aria-label="Playback iteration"
                          type="range"
                          min="0"
                          max={config.steps}
                          value={step}
                          onChange={(event) => {
                            setRunning(false);
                            setStep(Number(event.target.value));
                          }}
                        />
                      </div>
                      <select
                        className="speed-select"
                        aria-label="Playback speed"
                        value={speed}
                        onChange={(event) => setSpeed(Number(event.target.value))}
                      >
                        <option value={0.5}>0.5×</option>
                        <option value={1}>1×</option>
                        <option value={2}>2×</option>
                        <option value={4}>4×</option>
                      </select>
                    </div>
                  </section>
                  <div className="metric-strip">
                    <div>
                      <span>
                        <Activity size={14} />
                        LOWEST CURRENT LOSS
                      </span>
                      <strong>
                        {formatNumber(currentBestLoss)}
                        <small>
                          {best ? OPTIMIZERS.find((o) => o.id === best.run.id)?.shortName : '—'}
                        </small>
                      </strong>
                    </div>
                    <div>
                      <span>
                        <ArrowDownToLine size={14} />
                        LOSS REDUCTION
                      </span>
                      <strong>
                        {improvement === null ? '—' : improvement.toFixed(1)}
                        {improvement !== null && <em>%</em>}
                        <small>
                          {improvement === null ? 'starting loss is zero' : 'from starting point'}
                        </small>
                      </strong>
                    </div>
                    <div>
                      <span>
                        <Layers3 size={14} />
                        IN THE RUNNING
                      </span>
                      <strong>
                        {config.optimizerIds.length.toString().padStart(2, '0')}
                        <small>optimizers compared</small>
                      </strong>
                    </div>
                  </div>
                  <section className="chart-panel panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Convergence, at a glance
                          <span className="heading-dot" />
                        </h2>
                        <p>Loss over iterations · lower is better</p>
                      </div>
                      <label className="compact-toggle">
                        <input
                          type="checkbox"
                          checked={logarithmic}
                          onChange={(event) => setLogarithmic(event.target.checked)}
                        />
                        Signed log scale
                      </label>
                    </div>
                    <LossChart
                      runs={result.runs}
                      step={step}
                      budget={config.steps}
                      logarithmic={logarithmic}
                    />
                  </section>
                </div>
                <aside className="config-panel panel" aria-label="Experiment configuration">
                  <div className="config-heading">
                    <h2>
                      <Settings2 size={17} />
                      The experiment
                    </h2>
                    <span>YOUR CONTROLS</span>
                  </div>
                  <div className="config-section">
                    <div className="config-section-title">
                      <span className="section-number">01</span>
                      <h3>Choose a landscape</h3>
                    </div>
                    <div className="landscape-picker">
                      {SURFACES.map((item) => (
                        <button
                          key={item.id}
                          className={
                            surface.id === item.id
                              ? 'landscape-option selected'
                              : 'landscape-option'
                          }
                          aria-pressed={surface.id === item.id}
                          onClick={() => changeSurface(item.id)}
                        >
                          <LandscapeGlyph surface={item} />
                          <span>{item.shortName}</span>
                          {surface.id === item.id ? (
                            <Check size={14} />
                          ) : (
                            <ChevronRight size={13} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="config-section">
                    <div className="config-section-title">
                      <span className="section-number">02</span>
                      <h3>Pick your optimizers</h3>
                      <span className="selection-count">{config.optimizerIds.length}/6</span>
                    </div>
                    <div className="optimizer-picker">
                      {OPTIMIZERS.map((optimizer) => (
                        <label
                          key={optimizer.id}
                          style={{ '--optimizer-color': optimizer.color } as CSSProperties}
                        >
                          <input
                            type="checkbox"
                            checked={config.optimizerIds.includes(optimizer.id)}
                            onChange={() => toggleOptimizer(optimizer.id)}
                          />
                          <span className="custom-check">
                            <Check size={10} />
                          </span>
                          <span className="optimizer-dot" />
                          {optimizer.shortName}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="config-section parameters">
                    <div className="config-section-title">
                      <span className="section-number">03</span>
                      <h3>Set the conditions</h3>
                    </div>
                    <Field label="Learning rate" hint="η">
                      <div className="range-with-value">
                        <input
                          aria-label="Learning rate slider"
                          type="range"
                          min="-6"
                          max={Math.log10(2)}
                          step="any"
                          value={Math.log10(config.learningRate)}
                          onChange={(event) =>
                            updateConfig({
                              learningRate: Number(
                                (10 ** Number(event.target.value)).toPrecision(3),
                              ),
                            })
                          }
                        />
                        <NumberInput
                          aria-label="Learning rate"
                          className="number-value"
                          min="0.000001"
                          max="2"
                          step="0.001"
                          value={config.learningRate}
                          onCommit={(learningRate) => updateConfig({ learningRate })}
                        />
                      </div>
                    </Field>
                    <div className="field-pair">
                      <Field label="Iterations">
                        <select
                          value={config.steps}
                          onChange={(event) => updateConfig({ steps: Number(event.target.value) })}
                        >
                          {[
                            200,
                            400,
                            600,
                            800,
                            1000,
                            2000,
                            3000,
                            ...(![200, 400, 600, 800, 1000, 2000, 3000].includes(config.steps)
                              ? [config.steps]
                              : []),
                          ]
                            .sort((a, b) => a - b)
                            .map((n) => (
                              <option key={n} value={n}>
                                {n.toLocaleString()}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Momentum">
                        <NumberInput
                          aria-label="Momentum"
                          min="0"
                          max="0.999"
                          step="0.05"
                          value={config.momentum}
                          onCommit={(momentum) => updateConfig({ momentum })}
                        />
                      </Field>
                    </div>
                    <button
                      className="advanced-toggle"
                      aria-expanded={advanced}
                      onClick={() => setAdvanced((v) => !v)}
                    >
                      <Plus size={13} className={advanced ? 'rotated' : ''} />
                      {advanced ? 'Fewer settings' : 'Noise, seed & starting point'}
                      <ChevronDown size={13} className={advanced ? 'flipped' : ''} />
                    </button>
                    {advanced && (
                      <div className="advanced-fields">
                        <div className="field-pair">
                          <Field label="Gradient noise">
                            <NumberInput
                              min="0"
                              max="5"
                              step="0.1"
                              value={config.noise}
                              onCommit={(noise) => updateConfig({ noise })}
                            />
                          </Field>
                          <Field label="Random seed">
                            <NumberInput
                              min="0"
                              max="4294967295"
                              step="1"
                              value={config.seed}
                              onCommit={(seed) => updateConfig({ seed })}
                            />
                          </Field>
                        </div>
                        <div className="field-pair">
                          <Field label="Start x">
                            <NumberInput
                              min={surface.domain[0]}
                              max={surface.domain[1]}
                              step="0.1"
                              value={config.start.x}
                              onCommit={(x) => updateConfig({ start: { ...config.start, x } })}
                            />
                          </Field>
                          <Field label="Start y">
                            <NumberInput
                              min={surface.domain[0]}
                              max={surface.domain[1]}
                              step="0.1"
                              value={config.start.y}
                              onCommit={(y) => updateConfig({ start: { ...config.start, y } })}
                            />
                          </Field>
                        </div>
                        <p className="field-note">
                          Same start, learning rate, and seeded noise for every optimizer. Changes
                          reset playback.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="landscape-note">
                    <span>
                      <Sparkles size={14} />
                      WHAT TO LOOK FOR
                    </span>
                    <p>{surface.description}</p>
                    <button onClick={() => navigate('guide')}>
                      Explore the field guide <ArrowRight size={13} />
                    </button>
                  </div>
                  <button
                    className="button save-button"
                    onClick={() => {
                      setExperimentName(`${surface.name} exploration`);
                      setModal('save');
                    }}
                  >
                    <Save size={15} />
                    Save experiment
                  </button>
                </aside>
              </div>
              <section className="comparison-panel panel">
                <div className="panel-heading">
                  <div>
                    <h2>The paths, side by side</h2>
                    <p>
                      Live measurements at iteration {step}. A smaller loss is one part of the
                      story.
                    </p>
                  </div>
                  <span className="table-badge">
                    <span className="online-dot" />
                    {running ? 'LIVE COMPARISON' : 'EXPERIMENT SNAPSHOT'}
                  </span>
                </div>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label="Optimizer measurements"
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Optimizer</th>
                        <th scope="col">Current loss</th>
                        <th scope="col">Gradient norm</th>
                        <th scope="col">Position (x, y)</th>
                        <th scope="col">Step size</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPoints.map(({ run, point }) => {
                        const optimizer = OPTIMIZERS.find((o) => o.id === run.id)!;
                        const status = statusFor(run);
                        return (
                          <tr key={run.id}>
                            <th scope="row">
                              <i style={{ background: optimizer.color }} />
                              {optimizer.name}
                              {step > 0 && best?.run.id === run.id && (
                                <span className="best-badge">LOWEST</span>
                              )}
                            </th>
                            <td className="numeric">{formatNumber(point.loss)}</td>
                            <td className="numeric">{formatNumber(point.gradientNorm)}</td>
                            <td className="numeric coordinates">
                              ({formatNumber(point.x)}, {formatNumber(point.y)})
                            </td>
                            <td className="numeric">{formatNumber(point.stepNorm)}</td>
                            <td>
                              <span
                                className={`status status-${status.toLowerCase().replace(' ', '-')}`}
                              >
                                <span />
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {activeDiverged.length > 0 && (
                  <div className="diagnostic-note">
                    {activeDiverged.length} optimizer{activeDiverged.length > 1 ? 's' : ''}{' '}
                    diverged. The table shows the last finite state. Try a smaller learning rate to
                    investigate stability.
                  </div>
                )}
              </section>
              <StepInspector result={result} step={step} />
              {surface.id === 'regression' && <RegressionPanel result={result} step={step} />}
              <div className="lab-footnote">
                <span>
                  <CheckCheck size={14} />
                  Deterministic by design. Reproducible by seed.
                </span>
                <button onClick={() => navigate('guide')}>
                  How this lab works <ArrowRight size={13} />
                </button>
              </div>
            </>
          )}
          {page === 'learn' && <LearningPath onOpenExperiment={openInLab} />}
          {page === 'study' && (
            <ParameterStudy initialConfig={config} onOpenExperiment={openInLab} />
          )}
          {page === 'experiments' && (
            <ExperimentNotebook
              saved={saved}
              onOpen={(experiment) => {
                setConfig(experiment.config);
                setStep(experiment.iteration);
                navigate('lab');
              }}
              onDelete={deleteExperiment}
              onPreset={applyPreset}
              onCreate={() => navigate('lab')}
            />
          )}
          {page === 'guide' && <FieldGuide onStart={() => applyPreset(PRESETS[0])} />}
          <footer className="page-footer">
            <span>
              optimizerlab<span className="brand-dot">.</span>{' '}
              <span className="footer-separator">/</span> Made for the art of understanding.
            </span>
            <span>
              IDP PROJECT <span className="footer-separator">·</span> EST. 2026
            </span>
          </footer>
        </main>
      </div>
      <input
        ref={importRef}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="Import experiment JSON"
        onChange={(event) => {
          void importExperiment(event.target.files?.[0]);
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <IconButton label="Dismiss notification" onClick={() => setToast('')}>
            <X size={16} />
          </IconButton>
        </div>
      )}
      {modal === 'save' && (
        <ModalDialog title="Keep this discovery" onClose={() => setModal(null)}>
          <p className="modal-description">
            Save the settings and current iteration to your browser. Export JSON for a portable
            copy.
          </p>
          <form onSubmit={saveExperiment}>
            <Field label="Experiment name">
              <input
                autoFocus
                maxLength={100}
                value={experimentName}
                onChange={(event) => setExperimentName(event.target.value)}
                placeholder="A name for your experiment"
                required
              />
            </Field>
            <button className="button primary modal-submit" type="submit">
              <Save size={16} />
              Save to notebook
            </button>
          </form>
        </ModalDialog>
      )}
      {modal === 'export' && (
        <ModalDialog title="Take your findings with you" onClose={() => setModal(null)}>
          <p className="modal-description">
            Export the experiment through iteration {step}. Full precision, original loss values,
            and reproducible settings.
          </p>
          <div className="export-options">
            <button
              onClick={() => {
                downloadFile(
                  `optimizer-lab-${surface.id}.csv`,
                  exportCsv(result, step),
                  'text/csv;charset=utf-8',
                );
                setToast('CSV exported.');
                setModal(null);
              }}
            >
              <Download size={22} />
              <span>
                <strong>Measurements as CSV</strong>
                <small>Every recorded step. Ready for a spreadsheet.</small>
              </span>
              <ArrowRight size={17} />
            </button>
            <button
              onClick={() => {
                downloadFile(
                  `optimizer-lab-${surface.id}.json`,
                  exportJson(result, step),
                  'application/json',
                );
                setToast('Experiment JSON exported.');
                setModal(null);
              }}
            >
              <FlaskConical size={22} />
              <span>
                <strong>Experiment as JSON</strong>
                <small>Settings and traces. Import to reproduce.</small>
              </span>
              <ArrowRight size={17} />
            </button>
            <button
              onClick={async () => {
                const canvas = document.querySelector<HTMLCanvasElement>('.canvas-wrap canvas');
                if (!canvas) return;
                try {
                  const blob = await exportLandscapePng(canvas, config, step);
                  downloadFile(`optimizer-lab-${surface.id}.png`, blob, 'image/png');
                  setToast('Landscape image exported.');
                  setModal(null);
                } catch {
                  setToast('The image could not be exported. Try again.');
                }
              }}
            >
              <Mountain size={22} />
              <span>
                <strong>Landscape as PNG</strong>
                <small>The current surface view for your notes.</small>
              </span>
              <ArrowRight size={17} />
            </button>
          </div>
        </ModalDialog>
      )}
      {modal === 'share' && (
        <ModalDialog title="Pass the curiosity on" onClose={() => setModal(null)}>
          <p className="modal-description">
            This link includes the landscape, algorithms, settings, and playback position. Anyone
            with the app can reproduce it.
          </p>
          <label className="field">
            <span className="field-label">Experiment link</span>
            <input
              readOnly
              value={shareUrl(config, step)}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <button
            className="button primary modal-submit"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl(config, step));
                setCopied(true);
              } catch {
                setToast('Select the experiment link and copy it manually.');
              }
            }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Link copied' : 'Copy experiment link'}
          </button>
          <p className="field-note">No account, upload, or server storage required.</p>
        </ModalDialog>
      )}
      {modal === 'help' && (
        <ModalDialog title="Welcome to your playground" onClose={() => setModal(null)}>
          <div className="help-steps">
            <div>
              <span>01</span>
              <p>
                <strong>Pick a landscape.</strong> Start with the quadratic bowl, then explore
                valleys, saddles, and local minima.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Set up a comparison.</strong> Select algorithms and a learning rate. Every
                optimizer starts at the same coordinates.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Follow the descent.</strong> Run, pause, or scrub the timeline. Rotate the
                surface, or click a new starting point in Contour view.
              </p>
            </div>
            <div>
              <span>04</span>
              <p>
                <strong>Keep what you learn.</strong> Save to your notebook, share a reproducible
                link, or export your data.
              </p>
            </div>
          </div>
          <div className="keyboard-hints">
            <span>
              <kbd>Space</kbd> Run / pause
            </span>
            <span>
              <kbd>R</kbd> Reset
            </span>
            <span>
              <kbd>↑ ↓ ← →</kbd> Orbit focused plot
            </span>
          </div>
          <button className="button primary modal-submit" onClick={() => setModal(null)}>
            Let's explore <ArrowRight size={16} />
          </button>
        </ModalDialog>
      )}
    </div>
  );
}
