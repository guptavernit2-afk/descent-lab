# IDP Optimizer Visual Lab

## Project Title
**A Visual and Empirical Study of Gradient Descent Optimization Variants on Benchmark Loss Surfaces**

## Overview
IDP Optimizer Visual Lab is an interactive educational visualization project designed to demonstrate how gradient-based optimization algorithms behave on different mathematical loss landscapes.

The project is being developed in two stages:

### Version 1 -- 1D Live Diagnostics Dashboard
A completed interactive simulator that compares six optimization algorithms on one-dimensional loss curves.

Implemented optimizers:
- Vanilla Gradient Descent
- Momentum
- Nesterov Accelerated Gradient
- AdaGrad
- RMSProp
- Adam

Major features:
- Real-time canvas-based optimizer animation
- Multiple mathematical loss environments
- Learning-rate and stochastic-noise controls
- Optimizer toggle system
- Live telemetry cards and sparklines
- Conceptual diagnostics log
- Advisor and rescue recommendation panel
- Presentation preset scenarios
- Pause-on-alert functionality
- Export Canvas PNG option
- Premium presentation-ready dark UI

### Version 2 -- 3D Loss Surface Laboratory
A new advanced dashboard under development that will extend the optimizer comparison system to two-variable benchmark functions displayed as interactive 3D surfaces.

Planned benchmark surfaces:
- Quadratic Bowl
- Saddle Surface
- Rosenbrock Valley
- Himmelblau Function
- Rastrigin Function

Planned goal:
Visualize optimizer trajectories over real 3D loss landscapes and compare how different algorithms navigate valleys, saddle regions, oscillations and local minima.

## Technology Stack
- HTML5
- CSS3
- Vanilla JavaScript
- HTML Canvas for Version 1
- Interactive 3D plotting engine for Version 2

## Repository Structure

```text
v1-1d-diagnostics/     Stable completed 1D diagnostics dashboard
v2-3d-surface-lab/     New 3D dashboard development workspace
screenshots/           Demonstration images for report and presentation
docs/                  Project notes, methodology and mentor feedback
```