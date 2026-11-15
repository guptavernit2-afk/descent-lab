import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FlaskConical,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import LossChart, { formatNumber } from './LossChart';
import { OPTIMIZERS, getSurface, type ExperimentConfig, type OptimizerRun } from '../lib/engine';
import {
  LESSONS,
  loadLessonProgress,
  runLesson,
  saveLessonProgress,
  type LessonQuestion,
} from '../lib/lessons';
import '../styles/learning.css';

function Choices({
  question,
  value,
  onChange,
  name,
  disabled = false,
}: {
  question: LessonQuestion;
  value: number | null;
  onChange: (value: number) => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <fieldset className="learning-choices" disabled={disabled}>
      <legend>{question.prompt}</legend>
      {question.options.map((option, index) => (
        <label key={option} className={value === index ? 'chosen' : ''}>
          <input
            type="radio"
            name={name}
            checked={value === index}
            onChange={() => onChange(index)}
          />
          <span>{option}</span>
        </label>
      ))}
    </fieldset>
  );
}

function runStatus(run: OptimizerRun) {
  return run.status === 'converged'
    ? 'Known minimum reached'
    : run.status === 'diverged'
      ? 'Diverged · last valid state'
      : 'Budget used';
}

export default function LearningPath({
  onOpenExperiment,
}: {
  onOpenExperiment: (config: ExperimentConfig) => void;
}) {
  const [selected, setSelected] = useState(0);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [progress, setProgress] = useState(loadLessonProgress);
  const [notice, setNotice] = useState('');
  const lesson = LESSONS[selected];
  const results = useMemo(() => (hasRun ? runLesson(lesson) : []), [hasRun, lesson]);
  const completed = progress.includes(lesson.id);
  const correct = answer === lesson.check.answer;

  function selectLesson(index: number) {
    setSelected(index);
    setPrediction(null);
    setHasRun(false);
    setAnswer(null);
    setChecked(false);
    setNotice('');
  }

  function checkUnderstanding() {
    setChecked(true);
    if (correct) {
      const next = [...new Set([...progress, lesson.id])];
      setProgress(next);
      setNotice(
        saveLessonProgress(next)
          ? 'Your progress is saved in this browser.'
          : 'Lesson completed for this session. Browser storage is unavailable.',
      );
    }
  }

  return (
    <div className="learning-page">
      <section className="learning-overview" aria-label="Learning path progress">
        <div>
          <span className="section-eyebrow">A PATH FROM INTUITION TO EVIDENCE</span>
          <h2>Make a prediction. Put it to the test.</h2>
          <p>
            Five guided experiments connect the equations to the paths. Choose any lesson, explain
            what you expect, and use the measured result to check your understanding.
          </p>
        </div>
        <div className="learning-progress">
          <strong>
            {progress.length}
            <span> / {LESSONS.length}</span>
          </strong>
          <span>lessons completed</span>
          <progress value={progress.length} max={LESSONS.length} aria-label="Completed lessons" />
          <button
            onClick={() => {
              setProgress([]);
              setChecked(false);
              setNotice(
                saveLessonProgress([])
                  ? 'Learning progress reset.'
                  : 'Progress reset for this session. Browser storage is unavailable.',
              );
            }}
          >
            <RotateCcw size={12} />
            Reset progress
          </button>
        </div>
      </section>
      <div className="learning-layout">
        <nav className="lesson-navigation" aria-label="Learning lessons">
          {LESSONS.map((item, index) => (
            <button
              key={item.id}
              aria-current={index === selected ? 'step' : undefined}
              onClick={() => selectLesson(index)}
            >
              <span className={`lesson-number ${progress.includes(item.id) ? 'done' : ''}`}>
                {progress.includes(item.id) ? (
                  <Check size={14} />
                ) : (
                  String(index + 1).padStart(2, '0')
                )}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>
                  <Clock3 size={11} />
                  {item.duration}
                  {progress.includes(item.id) && ' · Completed'}
                </small>
              </span>
              {index === selected && <ArrowRight size={14} />}
            </button>
          ))}
          <div className="learning-nav-note">
            <BookOpen size={18} />
            <p>
              Each example changes a specific condition. Carry the question into the full lab when
              you are ready to explore further.
            </p>
          </div>
        </nav>
        <article className="lesson-workspace" aria-labelledby="lesson-title">
          <section className="lesson-intro panel">
            <div className="lesson-kicker">
              <span>LESSON {String(selected + 1).padStart(2, '0')}</span>
              <span>
                <Clock3 size={12} />
                {lesson.duration}
                {completed && (
                  <>
                    <CheckCircle2 size={13} />
                    Completed
                  </>
                )}
              </span>
            </div>
            <h2 id="lesson-title">{lesson.title}</h2>
            <p className="lesson-goal">{lesson.goal}</p>
            <div className="lesson-concept">
              <Lightbulb size={18} />
              <p>{lesson.concept}</p>
            </div>
            <code className="lesson-formula">{lesson.formula}</code>
          </section>

          <section className="lesson-phase panel">
            <div className="lesson-phase-heading">
              <span>01</span>
              <div>
                <h3>Predict before you press play</h3>
                <p>A prediction is a starting point, not a grade.</p>
              </div>
            </div>
            <Choices
              name={`prediction-${lesson.id}`}
              question={lesson.prediction}
              value={prediction}
              onChange={setPrediction}
              disabled={hasRun}
            />
            <button
              className="button primary"
              disabled={prediction === null || hasRun}
              onClick={() => setHasRun(true)}
            >
              {hasRun ? <Check size={15} /> : <Play size={15} />}
              {hasRun ? 'Experiment complete' : 'Run lesson experiment'}
            </button>
            {hasRun && (
              <div
                className={`learning-feedback ${prediction === lesson.prediction.answer ? 'correct' : 'reflect'}`}
                role="status"
              >
                <strong>
                  {prediction === lesson.prediction.answer
                    ? 'Your prediction matches the result.'
                    : 'A useful surprise. Compare your prediction with the evidence.'}
                </strong>
                <p>{lesson.prediction.explanation}</p>
              </div>
            )}
          </section>

          <section
            className={`lesson-phase panel ${!hasRun ? 'lesson-awaiting' : ''}`}
            aria-labelledby="lesson-evidence-title"
          >
            <div className="lesson-phase-heading">
              <span>02</span>
              <div>
                <h3 id="lesson-evidence-title">Read the evidence</h3>
                <p>Measurements from the experiment. Loss values use the original scale.</p>
              </div>
            </div>
            {!hasRun ? (
              <div className="lesson-placeholder">
                <FlaskConical size={25} />
                <p>Make a prediction and run the experiment to reveal the measurements.</p>
              </div>
            ) : (
              <>
                <p className="lesson-observation">{lesson.observation}</p>
                <div className="lesson-experiments">
                  {lesson.experiments.map((experiment, index) => {
                    const result = results[index];
                    return (
                      <section
                        className="lesson-experiment"
                        key={experiment.id}
                        aria-labelledby={`experiment-${experiment.id}`}
                      >
                        <div className="lesson-experiment-heading">
                          <div>
                            <h4 id={`experiment-${experiment.id}`}>{experiment.name}</h4>
                            <p>{experiment.purpose}</p>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => onOpenExperiment(experiment.config)}
                          >
                            Open in lab <ArrowRight size={13} />
                          </button>
                        </div>
                        <div className="lesson-settings">
                          <span>{getSurface(experiment.config.surfaceId).shortName}</span>
                          <span>
                            Start ({experiment.config.start.x}, {experiment.config.start.y})
                          </span>
                          <span>η {experiment.config.learningRate}</span>
                          <span>Noise {experiment.config.noise}</span>
                          <span>Seed {experiment.config.seed}</span>
                        </div>
                        {experiment.config.steps > 1 && (
                          <LossChart
                            runs={result.runs}
                            step={experiment.config.steps}
                            budget={experiment.config.steps}
                            logarithmic
                          />
                        )}
                        {experiment.config.steps > 1 && (
                          <p className="lesson-chart-note">
                            Signed log loss scale · iterations on the horizontal axis · colors match
                            the rows below
                          </p>
                        )}
                        <div className="table-scroll">
                          <table>
                            <caption className="visually-hidden">
                              {experiment.name}: first updates and final valid measurements
                            </caption>
                            <thead>
                              <tr>
                                <th scope="col">Optimizer</th>
                                <th scope="col">First (Δx, Δy)</th>
                                <th scope="col">Final loss</th>
                                <th scope="col">Final ‖∇f‖</th>
                                <th scope="col">Steps</th>
                                <th scope="col">Outcome</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.runs.map((run) => {
                                const optimizer = OPTIMIZERS.find(({ id }) => id === run.id)!;
                                const initial = run.points[0],
                                  first = run.points[1] || initial,
                                  last = run.points.at(-1)!;
                                return (
                                  <tr key={run.id}>
                                    <th scope="row">
                                      <i style={{ background: optimizer.color }} />
                                      {optimizer.shortName}
                                    </th>
                                    <td className="numeric">
                                      ({formatNumber(first.x - initial.x)},{' '}
                                      {formatNumber(first.y - initial.y)})
                                    </td>
                                    <td className="numeric">{formatNumber(last.loss)}</td>
                                    <td className="numeric">{formatNumber(last.gradientNorm)}</td>
                                    <td className="numeric">{last.step}</td>
                                    <td>{runStatus(run)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    );
                  })}
                </div>
                <div className="lesson-reflection">
                  <Sparkles size={16} />
                  <p>
                    <strong>One more question to investigate</strong>
                    {lesson.reflection}
                  </p>
                </div>
              </>
            )}
          </section>

          <section className={`lesson-phase panel ${!hasRun ? 'lesson-awaiting' : ''}`}>
            <div className="lesson-phase-heading">
              <span>03</span>
              <div>
                <h3>Check your understanding</h3>
                <p>Apply the idea to a new question.</p>
              </div>
            </div>
            {!hasRun ? (
              <p className="lesson-lock-note">
                Run the experiment first. The check will use what you observed.
              </p>
            ) : (
              <>
                <Choices
                  question={lesson.check}
                  name={`check-${lesson.id}`}
                  value={answer}
                  onChange={(value) => {
                    setAnswer(value);
                    setChecked(false);
                    setNotice('');
                  }}
                />
                <button
                  className="button primary"
                  disabled={answer === null || (checked && correct)}
                  onClick={checkUnderstanding}
                >
                  {checked && correct ? <CheckCircle2 size={15} /> : <Check size={15} />}
                  {checked && correct ? 'Understanding checked' : 'Check answer'}
                </button>
                {checked && (
                  <div
                    className={`learning-feedback ${correct ? 'correct' : 'reflect'}`}
                    role="status"
                  >
                    <strong>
                      {correct ? 'You have the idea.' : 'Revisit the evidence, then try again.'}
                    </strong>
                    <p>{lesson.check.explanation}</p>
                  </div>
                )}
              </>
            )}
          </section>
          {notice && (
            <p className="learning-storage-notice" role="status">
              {notice}
            </p>
          )}
          <div className="lesson-bottom">
            <div className="lesson-sources">
              <span>EXPLORE THE SOURCES</span>
              {lesson.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                  <ExternalLink size={11} />
                </a>
              ))}
            </div>
            {completed && selected < LESSONS.length - 1 && (
              <button className="button secondary" onClick={() => selectLesson(selected + 1)}>
                Next lesson <ArrowRight size={15} />
              </button>
            )}
            {completed && selected === LESSONS.length - 1 && (
              <button
                className="button secondary"
                onClick={() => onOpenExperiment(lesson.experiments[0].config)}
              >
                Continue exploring <ArrowRight size={15} />
              </button>
            )}
          </div>
        </article>
      </div>
      <p className="learning-method-note">
        Learning design: predict, observe, and explain. Inspired by{' '}
        <a
          href="https://phet.colorado.edu/en/teaching-resources/teaching-with-phet/whole-class"
          target="_blank"
          rel="noreferrer"
        >
          PhET’s inquiry guidance
        </a>
        . Progress records completed checks in this browser; it is not a graded assessment or
        certification.
      </p>
    </div>
  );
}
