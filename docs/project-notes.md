# Project history

## First-year foundation: 1D diagnostics

The original project, _A Visual and Empirical Study of Gradient Descent Optimization Variants on Benchmark Loss Surfaces_, compared six optimization algorithms on one-dimensional loss curves.

The standalone HTML dashboard included canvas animation, learning-rate and noise controls, optimizer toggles, telemetry cards, sparklines, diagnostic messages, presentation presets, pause-on-alert behavior, and PNG export. That original implementation remains unchanged in [`v1-1d-diagnostics/idp_master_final.html`](../v1-1d-diagnostics/idp_master_final.html).

## Mentor feedback and the 3D prototype

The original project notes recorded positive mentor feedback and a request to extend the visualization to two optimization parameters:

```text
z = L(x, y)
```

The `feature/3d-foundation` branch subsequently explored a Three.js-based surface lab with quadratic, Rosenbrock, Himmelblau, and Rastrigin landscapes. It included coordinate picking, optimizer comparisons, and explanatory panels. Its branch history remains available; the earlier statement on `main` that development had not started no longer described that work accurately.

## The current laboratory

The application at the repository root develops that idea into a modular workspace:

- React and TypeScript separate the interface from the numerical model.
- A pure optimization engine supports all six original optimizer families in two dimensions.
- Seeded shared noise allows a configuration to be repeated and compared.
- Interactive projected surfaces, contour views, playback, and loss diagnostics explain the same experiment.
- Configuration sharing, trace exports, and local saved experiments support demonstrations and reports.
- Tests and GitHub Actions make numerical behavior and production builds checkable.

The quartic saddle was selected instead of the unbounded function `x² − y²`, so the lab can show a saddle and meaningful finite minima in one experiment. The educational narrative avoids declaring a universally best optimizer: performance depends on the landscape, starting point, tuning, noise, and stopping rule.

For the current mathematics and implementation decisions, use [methodology](methodology.md) and [architecture](architecture.md). These notes describe provenance rather than an unfinished feature roadmap.
