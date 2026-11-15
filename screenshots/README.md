# Application screenshots

`lab-desktop.png` is an actual capture of the current laboratory, used in the repository README. Screenshots show an example configuration rather than a benchmark claim.

- `lab-desktop.png`: the full laboratory at desktop width, paused at iteration 150.
- `lab-contour.png`: the same experiment in contour view.
- `field-guide.png`: optimizer explanations and methodology.
- `lab-mobile.png`: the responsive laboratory at 390 pixels wide.

Run `npm run build` and `npm run preview -- --port 4173`, then `npm run screenshots` in another terminal to refresh all four captures.

When refreshing a capture, use the running application, wait for fonts and the canvas to render, and include enough of the controls to explain the experiment. Keep generated browser test artifacts in the ignored `test-results/` or `playwright-report/` directories.
