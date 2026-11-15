import { Activity, Layers3, Mountain, Sparkles, type LucideIcon } from 'lucide-react';
import type { SurfaceId } from './engine';

export interface ExperimentPreset {
  name: string;
  description: string;
  icon: LucideIcon;
  surfaceId: SurfaceId;
  learningRate: number;
  noise: number;
  steps: number;
}

export const PRESETS: ExperimentPreset[] = [
  {
    name: 'The first descent',
    description: 'A gentle start on a quadratic bowl.',
    icon: Mountain,
    surfaceId: 'quadratic',
    learningRate: 0.08,
    noise: 0,
    steps: 400,
  },
  {
    name: 'Around the bend',
    description: 'Navigate the narrow Rosenbrock valley.',
    icon: Activity,
    surfaceId: 'rosenbrock',
    learningRate: 0.002,
    noise: 0,
    steps: 1000,
  },
  {
    name: 'A little turbulence',
    description: 'See how memory handles noisy gradients.',
    icon: Sparkles,
    surfaceId: 'quadratic',
    learningRate: 0.04,
    noise: 0.7,
    steps: 600,
  },
  {
    name: 'Many ways down',
    description: 'Explore competing local minima.',
    icon: Layers3,
    surfaceId: 'rastrigin',
    learningRate: 0.005,
    noise: 0,
    steps: 800,
  },
];
