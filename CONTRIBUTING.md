# Contributing

The lab is an educational application. Changes should make an optimization behavior easier to explore while keeping the mathematical result reproducible and honest.

## Development

Use Node.js 22.12+ and npm. Install the locked dependencies with `npm ci`, then run `npm run dev`. Keep the lockfile with dependency changes.

Before submitting a change, run:

```bash
npm run typecheck
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests run headlessly. Use the Playwright report or traces to investigate failures. Do not commit `dist/`, dependency folders, test reports, local environment files, or credentials.

Use `npm run format` before committing source changes. The archived 1D simulator is excluded from formatting so its original source remains intact.

## Numerical changes

- Include the objective and its analytic gradient when adding a surface. Check the gradient against central finite differences at several ordinary points.
- State the update convention and constants when adding an optimizer. Test at least one hand-computed step and behavior on a known minimum.
- Keep numerical state independent from animation timing and camera state.
- Preserve deterministic behavior for a fixed configuration and seed. Selecting another optimizer must not change an existing optimizer's noise sequence.
- Detect non-finite updates and divergence explicitly. Do not clamp an optimizer back into the visible surface and call that convergence.
- Update [methodology.md](docs/methodology.md) when changing equations, stopping criteria, noise, or exported fields.

## Interface changes

Check the workspace at desktop and narrow mobile widths. Controls need visible labels, keyboard focus, usable touch targets, and meaningful disabled states. Do not use color as the sole way to identify a run. Keep numerical values available alongside canvas graphics.

Prefer small components and pure utilities over adding another dependency. Preserve the original file in `v1-1d-diagnostics/` as a record of the first-year project.

## Issues and pull requests

For a numerical bug, attach an exported configuration or list the exact inputs and expected behavior. For an interface bug, include the browser, viewport, and steps to reproduce it. Describe the final behavior in a pull request and list the checks actually performed; do not claim a check passed if it was not run.
