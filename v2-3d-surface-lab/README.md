# 3D lab migration

The active 3D loss-surface laboratory now lives in the repository root. Run it with `npm ci` and `npm run dev`; its implementation is in [`src/`](../src/).

This directory records the project's original plan to extend the 1D dashboard into two-parameter optimization. A standalone Three.js prototype remains in the history of the `feature/3d-foundation` branch. The current application implements all six optimizer families, five surfaces, reproducible experiments, and a shared diagnostics workspace.

See the [main README](../README.md), [project history](../docs/project-notes.md), and [methodology](../docs/methodology.md). The original 1D dashboard remains in [`v1-1d-diagnostics/`](../v1-1d-diagnostics/).
