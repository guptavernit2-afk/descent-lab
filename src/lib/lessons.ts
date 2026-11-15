import {
  normalizeConfig,
  runExperiment,
  type ExperimentConfig,
  type ExperimentResult,
} from './engine';

export interface LessonQuestion {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface LessonExperiment {
  id: string;
  name: string;
  purpose: string;
  config: ExperimentConfig;
}

export interface LearningLesson {
  id: string;
  title: string;
  duration: string;
  goal: string;
  concept: string;
  formula: string;
  prediction: LessonQuestion;
  experiments: LessonExperiment[];
  observation: string;
  reflection: string;
  check: LessonQuestion;
  sources: { title: string; url: string }[];
}

const bowl = (overrides: Partial<ExperimentConfig> = {}): ExperimentConfig =>
  normalizeConfig({ surfaceId: 'quadratic', optimizerIds: ['gd'], noise: 0, ...overrides });

const optimizationSource = {
  title: 'Stanford CS231n · Optimization',
  url: 'https://cs231n.github.io/optimization-1/',
};
const updatesSource = {
  title: 'Stanford CS231n · Parameter updates',
  url: 'https://cs231n.github.io/neural-networks-3/',
};

export const LESSONS: LearningLesson[] = [
  {
    id: 'gradient-direction',
    title: 'Turn a slope into a step',
    duration: '4 min',
    goal: 'Calculate a gradient-descent update and separate direction from step size.',
    concept:
      'For this bowl, the gradient is (x, 6y). At (2, 1), it is (2, 6): increasing y raises the loss more sharply. Gradient Descent subtracts the gradient multiplied by the learning rate. The gradient gives a local direction, not a destination.',
    formula: 'At (2, 1): ∇f = (2, 6), so Δθ = −η(2, 6)',
    prediction: {
      prompt: 'With η = 0.1, which coordinate moves farther on the first update?',
      options: [
        'x moves farther.',
        'y moves three times as far as x.',
        'Both coordinates move equally far.',
      ],
      answer: 1,
      explanation:
        'The update is (−0.2, −0.6). The y coordinate moves three times as far because its gradient component is three times larger. Both coordinates move toward lower loss in this example.',
    },
    experiments: [
      {
        id: 'small-step',
        name: 'A smaller step',
        purpose: 'One update with η = 0.05.',
        config: bowl({ start: { x: 2, y: 1 }, learningRate: 0.05, steps: 1 }),
      },
      {
        id: 'double-step',
        name: 'Double the learning rate',
        purpose: 'The same gradient with η = 0.1.',
        config: bowl({ start: { x: 2, y: 1 }, learningRate: 0.1, steps: 1 }),
      },
    ],
    observation:
      'Compare the first Δx and Δy columns. Doubling η doubles both update components, but the resulting loss does not have to change by a factor of two: loss is a function of the new position.',
    reflection:
      'In the full lab, try another starting point. Does the coordinate with the larger gradient still make the larger GD update?',
    check: {
      prompt: 'If the gradient is (4, −2) and η = 0.1, what is the GD update Δθ?',
      options: ['(+0.4, −0.2)', '(−0.4, +0.2)', '(−4, +2)'],
      answer: 1,
      explanation:
        'Multiply each gradient component by −0.1. The update is (−0.4, +0.2); add it to the current parameters to get the next position.',
    },
    sources: [optimizationSource],
  },
  {
    id: 'learning-rate',
    title: 'Find the stability boundary',
    duration: '5 min',
    goal: 'Distinguish slow progress, stable oscillation, and divergence.',
    concept:
      'On this bowl, a GD update multiplies y by (1 − 6η). Its magnitude shrinks only when |1 − 6η| < 1. Together with the x direction, this gives 0 < η < 1/3 for convergence from every starting direction. This exact bound belongs to this quadratic and this update rule.',
    formula: 'yₜ₊₁ = (1 − 6η)yₜ · stable magnitude when |1 − 6η| < 1',
    prediction: {
      prompt: 'Which learning rate will make GD diverge from the shared starting point?',
      options: ['η = 0.1', 'η = 0.3', 'η = 0.4'],
      answer: 2,
      explanation:
        'At η = 0.4, the y multiplier is −1.4: its sign flips and its magnitude grows. At η = 0.3, the multiplier is −0.8, so oscillations shrink instead.',
    },
    experiments: [
      {
        id: 'stable',
        name: 'Steady descent',
        purpose: 'η = 0.1; y multiplier 0.4.',
        config: bowl({ learningRate: 0.1, steps: 80 }),
      },
      {
        id: 'oscillatory',
        name: 'Oscillating, yet stable',
        purpose: 'η = 0.3; y multiplier −0.8.',
        config: bowl({ learningRate: 0.3, steps: 80 }),
      },
      {
        id: 'unstable',
        name: 'Beyond the boundary',
        purpose: 'η = 0.4; y multiplier −1.4.',
        config: bowl({ learningRate: 0.4, steps: 80 }),
      },
    ],
    observation:
      'Inspect the loss and the termination status. A sign change in the parameters does not by itself imply failure. The unstable run stops at a numerical guard, and its table reports the last finite point rather than a fabricated minimum.',
    reflection:
      'Try η = 1/3 in the full lab. At the boundary, the y magnitude can stay constant while its sign alternates.',
    check: {
      prompt: 'Does a zigzagging trajectory necessarily mean that gradient descent is diverging?',
      options: [
        'Yes. Every sign change is divergence.',
        'No. The oscillations can shrink toward the minimum.',
        'No. Oscillation proves it has already converged.',
      ],
      answer: 1,
      explanation:
        'Direction and magnitude are different. Here η = 0.3 flips y at every update but multiplies its magnitude by 0.8, so the oscillations decay.',
    },
    sources: [
      { title: 'Distill · Why Momentum Really Works', url: 'https://distill.pub/2017/momentum/' },
    ],
  },
  {
    id: 'momentum-memory',
    title: 'Give an optimizer a memory',
    duration: '5 min',
    goal: 'Explain how velocity and look-ahead alter an update.',
    concept:
      'Momentum carries a fraction of its previous velocity into the next move. Nesterov first evaluates the gradient at a projected position. At initialization, every velocity is zero, so all three methods below take the same first step; their histories separate them afterward.',
    formula: 'Momentum: vₜ₊₁ = βvₜ − η∇f(θₜ), then θₜ₊₁ = θₜ + vₜ₊₁',
    prediction: {
      prompt:
        'Starting with zero velocity, how do the first GD, Momentum, and Nesterov updates compare?',
      options: [
        'Momentum immediately takes a larger first step.',
        'All three take the same first step.',
        'Nesterov starts at the known minimum.',
      ],
      answer: 1,
      explanation:
        'The memory term is zero initially, and Nesterov’s look-ahead position equals the current position. Each first update is −η∇f(θ₀).',
    },
    experiments: [
      {
        id: 'with-memory',
        name: 'Same start, different histories',
        purpose: 'η = 0.05, β = 0.9, and 80 updates.',
        config: bowl({
          learningRate: 0.05,
          momentum: 0.9,
          steps: 80,
          optimizerIds: ['gd', 'momentum', 'nesterov'],
        }),
      },
    ],
    observation:
      'Confirm the matching first updates in the table, then compare the three loss traces. A method with velocity can briefly increase loss or cross a valley. Its final ranking here is evidence about these settings, not proof that one method always wins.',
    reflection:
      'Open this run in the lab and set momentum to zero. Compare the resulting paths with GD.',
    check: {
      prompt:
        'Two momentum runs reach the same position with different velocities. Must their next updates be identical?',
      options: [
        'Yes. Position is the entire optimizer state.',
        'No. Stored velocity also contributes to the next update.',
        'Yes, unless random noise is enabled.',
      ],
      answer: 1,
      explanation:
        'The next velocity includes βv. Two histories can therefore produce different steps even when the current position, gradient, and learning rate match.',
    },
    sources: [
      updatesSource,
      { title: 'Distill · Momentum and curvature', url: 'https://distill.pub/2017/momentum/' },
    ],
  },
  {
    id: 'adaptive-scaling',
    title: 'Look inside an adaptive step',
    duration: '5 min',
    goal: 'Distinguish a raw gradient from the update an optimizer applies.',
    concept:
      'AdaGrad divides each gradient coordinate by its accumulated squared-gradient scale. Adam combines moments and corrects their initialization bias. In their first update here, both nearly normalize each nonzero gradient component to its sign. That changes the relation between gradient size and movement.',
    formula: 'First AdaGrad step: Δθᵢ = −ηgᵢ / (|gᵢ| + ε)',
    prediction: {
      prompt: 'At (2, 1), |gᵧ| is three times |gₓ|. What happens in AdaGrad’s first update?',
      options: [
        'Its y movement must be three times its x movement.',
        'The two movement magnitudes are nearly equal.',
        'It cannot move until several gradients have accumulated.',
      ],
      answer: 1,
      explanation:
        'With a zero accumulator, the denominator is approximately |gᵢ|. Each nonzero coordinate therefore moves by approximately η. Epsilon makes the equality approximate.',
    },
    experiments: [
      {
        id: 'coordinate-scaling',
        name: 'One gradient, three update rules',
        purpose: 'Start (2, 1); η = 0.1; 80 updates.',
        config: bowl({
          start: { x: 2, y: 1 },
          learningRate: 0.1,
          steps: 80,
          optimizerIds: ['gd', 'adagrad', 'adam'],
        }),
      },
    ],
    observation:
      'Compare the first Δx and Δy columns. GD preserves their 1:3 magnitude ratio; AdaGrad and Adam have nearly equal first-step magnitudes. Later updates depend on their accumulated history. A shared η does not mean equal update lengths.',
    reflection:
      'Open the experiment and compare several learning rates. Avoid drawing a universal ranking from one shared rate.',
    check: {
      prompt: 'Why is one shared learning rate insufficient to establish the best optimizer?',
      options: [
        'Adaptive methods do not have learning rates.',
        'Each method turns that rate into a different update and may need different tuning.',
        'The method with the smallest first update always wins.',
      ],
      answer: 1,
      explanation:
        'The update rule matters. Velocity and coordinate-wise scaling change the effective movement, so an equal nominal learning rate is a controlled demonstration, not a complete tuning study.',
    },
    sources: [
      updatesSource,
      { title: 'Duchi et al. · AdaGrad', url: 'https://jmlr.org/papers/v12/duchi11a.html' },
      { title: 'Kingma & Ba · Adam', url: 'https://arxiv.org/abs/1412.6980' },
    ],
  },
  {
    id: 'stationary-points',
    title: 'Question a flat gradient',
    duration: '6 min',
    goal: 'Distinguish a stationary point from a known global minimum.',
    concept:
      'A zero gradient is a local statement. It can occur at a minimum, maximum, or saddle. At the exact saddle in this lab, zero velocity and zero gradient leave both GD and Momentum motionless. Noise can perturb that state, but perturbing a run does not guarantee a global solution.',
    formula: '∇f(θ) = 0 does not imply “global minimum”',
    prediction: {
      prompt:
        'At the exact saddle (0, 0), with zero velocity and no noise, what will GD and Momentum do?',
      options: [
        'Both stay at the saddle.',
        'Momentum always escapes on its own.',
        'Both identify the saddle as the global minimum.',
      ],
      answer: 0,
      explanation:
        'Neither rule has a nonzero update to apply. The engine keeps them stationary and does not label that state converged to a known minimum.',
    },
    experiments: [
      {
        id: 'exact-saddle',
        name: 'An exact stationary saddle',
        purpose: 'Zero noise; zero initial velocity.',
        config: normalizeConfig({
          surfaceId: 'saddle',
          start: { x: 0, y: 0 },
          noise: 0,
          steps: 250,
          optimizerIds: ['gd', 'momentum'],
        }),
      },
      {
        id: 'perturbed-saddle',
        name: 'A reproducible perturbation',
        purpose: 'Uniform gradient noise 0.25; seed 42.',
        config: normalizeConfig({
          surfaceId: 'saddle',
          start: { x: 0, y: 0 },
          noise: 0.25,
          seed: 42,
          steps: 250,
          optimizerIds: ['gd'],
        }),
      },
      {
        id: 'local-basin',
        name: 'A stationary local basin',
        purpose: 'GD on Rastrigin; 600 updates.',
        config: normalizeConfig({ surfaceId: 'rastrigin', steps: 600, optimizerIds: ['gd'] }),
      },
    ],
    observation:
      'The exact-saddle run has zero gradient and zero movement but is not globally converged. The noisy run moves away for this seed. In the Rastrigin run, inspect the tiny final gradient alongside its positive loss: the known global minimum has loss zero.',
    reflection:
      'Try other seeds and starting points. Separate evidence from one run from a claim about the optimizer in general.',
    check: {
      prompt: 'A run has a tiny gradient. What can you conclude from that fact alone?',
      options: [
        'It has found the global minimum.',
        'It is near a stationary region; more evidence is needed to classify it.',
        'Its learning rate must be too large.',
      ],
      answer: 1,
      explanation:
        'A gradient describes local slope. To classify a stationary region, inspect the surrounding objective, curvature, or known reference solutions. A flat gradient alone cannot certify a global minimum.',
    },
    sources: [
      optimizationSource,
      {
        title: 'Dauphin et al. · Saddle points in non-convex optimization',
        url: 'https://arxiv.org/abs/1406.2572',
      },
    ],
  },
];

export function runLesson(lesson: LearningLesson): ExperimentResult[] {
  return lesson.experiments.map(({ config }) => runExperiment(config));
}

// Preserve progress saved before the DescentLab rebrand.
export const LEARNING_PROGRESS_KEY = 'optimizer-lab.learning.v1';

export function validLessonProgress(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set(LESSONS.map(({ id }) => id));
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && valid.has(id)))];
}

export function loadLessonProgress(): string[] {
  try {
    return validLessonProgress(JSON.parse(localStorage.getItem(LEARNING_PROGRESS_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function saveLessonProgress(progress: string[]): boolean {
  try {
    localStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(validLessonProgress(progress)));
    return true;
  } catch {
    return false;
  }
}
