# Methodology

The lab studies unconstrained optimization of a scalar objective `f(x, y)` using analytic gradients. It computes an experiment independently of playback, then displays its stored trajectory. Camera movement and animation speed never alter the numerical result.

## Loss surfaces

| Surface           | Objective                        | Analytic gradient `(∂f/∂x, ∂f/∂y)`               | Known global minima                                          |
| ----------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| Quadratic         | `½(x² + 6y²)`                    | `(x, 6y)`                                        | `(0, 0)`, loss `0`                                           |
| Quartic saddle    | `x² − y² + 0.15y⁴`               | `(2x, −2y + 0.6y³)`                              | `(0, ±√(10/3))`, loss `−5/3`                                 |
| Rosenbrock        | `(1−x)² + 100(y−x²)²`            | `(2(x−1) − 400x(y−x²), 200(y−x²))`               | `(1, 1)`, loss `0`                                           |
| Himmelblau        | `(x²+y−11)² + (x+y²−7)²`         | `(4x(x²+y−11)+2(x+y²−7), 2(x²+y−11)+4y(x+y²−7))` | Four points with loss `0`; see below                         |
| Rastrigin         | `20+x²+y²−10[cos(2πx)+cos(2πy)]` | `(2x+20πsin(2πx), 2y+20πsin(2πy))`               | `(0, 0)`, loss `0`                                           |
| Linear regression | `L(w,b) = Σ(wuᵢ+b−tᵢ)²/(2n)`     | `(Σrᵢuᵢ/n, Σrᵢ/n)`, where `rᵢ = wuᵢ+b−tᵢ`        | Training-data least-squares solution; generally nonzero loss |

Himmelblau's stored minima are `(3, 2)`, `(-2.805118, 3.131312)`, `(-3.779310, -3.283186)`, and `(3.584428, -1.848126)`. Three are rounded coordinates, so their computed loss need not be exactly zero.

The quartic saddle is bounded below and has a stationary saddle at `(0, 0)`. It is deliberately different from the unbounded surface `x² − y²`. With zero gradient, zero velocity, and no noise, all six methods can remain at the exact saddle; momentum is not a guaranteed escape mechanism.

### From a surface to a fitted model

For **Fit a Line**, the surface coordinates are parameters: `x = w` is slope and `y = b` is intercept. They are different from the plotted observation feature `u` and target `t`. A point on the loss surface therefore specifies the entire prediction rule `t̂ = wu + b`.

[`src/lib/regression.ts`](../src/lib/regression.ts) supplies a fixed synthetic dataset: 25 training observations and 12 separate held-out observations, generated around `t = 1.4u + 0.65` with deterministic sinusoidal residuals. The data are reproducible teaching examples, not real measurements, and do not change with the experiment seed. The reference minimum is computed by closed-form least squares using **training data only**. Residual variation means even the optimal training line has nonzero error.

The surface objective is **half the training mean squared error**. Its derivative is simpler because the factor of two from differentiating the square cancels the one-half. The model panel reports ordinary MSE for both splits, so `training MSE = 2L`. [Google's regression-loss lesson](https://developers.google.com/machine-learning/crash-course/linear-regression/loss) explains the prediction-to-squared-error connection.

Every optimizer update uses all 25 training observations: this is full-batch optimization. The 12 held-out observations are used only to display evaluation error, never to calculate an update or the reference minimum. Their small, synthetic split cannot establish real-world generalization. Repeatedly choosing settings while watching held-out error also makes it a tuning signal, not an untouched final test. The noise control perturbs gradients; it does not resample observations or form minibatches.

## Update rules

Let `θ = (x, y)`, learning rate be `η`, and the momentum control be `β`. All velocity and accumulator vectors begin at zero. Squares, square roots, and divisions below operate per coordinate. Adaptive denominators use `ε = 10⁻⁸` **outside** the square root.

| Method           | Update at step `t`                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Gradient Descent | `θ ← θ − ηg`                                                                                         |
| Momentum         | `v ← βv − ηg`; `θ ← θ + v`                                                                           |
| Nesterov         | Evaluate `g` at `θ + βv`, then `v ← βv − ηg`; `θ ← θ + v`                                            |
| AdaGrad          | `s ← s + g²`; `θ ← θ − ηg/(√s + ε)`                                                                  |
| RMSProp          | `s ← ρs + (1−ρ)g²`; `θ ← θ − ηg/(√s + ε)`, with `ρ = 0.9`                                            |
| Adam             | `m ← βm + (1−β)g`; `s ← β₂s + (1−β₂)g²`; `θ ← θ − η[m/(1−βᵗ)]/[√(s/(1−β₂ᵗ)) + ε]`, with `β₂ = 0.999` |

The momentum control affects Momentum, Nesterov, and Adam's first-moment decay. It does not change RMSProp's decay or AdaGrad. RMSProp here is the uncentered variant without additional momentum; AdaGrad has a zero initial accumulator; Adam has no weight decay or AMSGrad. These explicit conventions matter when reproducing the experiment in a machine-learning library.

The adaptive rules follow the [AdaGrad paper](https://jmlr.org/papers/v12/duchi11a.html), [Hinton's RMSProp lecture notes](https://www.cs.toronto.edu/~tijmen/csc321/slides/lecture_slides_lec6.pdf), and [Adam paper](https://arxiv.org/abs/1412.6980). Those sources explain the broader methods; the equations above specify this implementation.

## Noise and reproducibility

With noise amplitude `a`, each update uses the analytic gradient plus one sampled vector whose two coordinates are uniform in `[-a, a]`. The implementation uses a seeded Mulberry32 generator, with a fixed sequence prepared for the full iteration budget.

Every enabled optimizer receives the same additive vector at the same iteration. Each method still evaluates its gradient at its own position; Nesterov evaluates at its look-ahead position. Adding, removing, or reordering optimizers does not change another optimizer's noise. A repeated configuration and seed reproduces the run within the same JavaScript numerical environment. Floating-point transcendental calculations can vary slightly across engines.

This is synthetic additive noise, not stochastic minibatch sampling from a dataset. Sharing the random sequence reduces one source of comparison variation; it does not make a single run statistically conclusive. For empirical conclusions, repeat across seeds and starting points and report the entire tuning procedure.

## Termination and diagnostics

Every trace includes the starting point at step `0`. Each later point records actual position, objective loss, the norm of the **true** analytic gradient at the new position, and the Euclidean length of the update. The displayed gradient norm does not include synthetic noise.

A run is **converged** only when noise is zero and all three conditions hold:

1. True gradient norm is at most `10⁻⁵`.
2. Update length is at most `10⁻⁵`.
3. Distance to a stored known global minimum is at most `10⁻³`.

An initial point can meet these conditions at step `0`. The rule deliberately distinguishes a known global minimum from a flat saddle or a stationary local minimum. Runs with persistent noise do not use this early-stop rule.

**Completed** means the iteration budget was exhausted. It does not mean the objective was minimized, and it can include a run resting in a local minimum. **Diverged** means a proposed point failed a numerical safety check: a non-finite value, an absolute coordinate over `10⁶`, absolute loss over `10¹⁴`, or gradient norm over `10¹²`. The invalid update is not appended; the last valid point remains available. These limits are pragmatic numerical guards, not a mathematical proof of divergence.

The engine never clips an optimizer's position to the displayed domain. Trajectories may leave the plot, and hiding an off-screen point does not change its computation. `bestLoss` is the smallest loss among recorded valid points, which can differ from the final loss.

### Inspecting the actual update

Each accepted non-initial point can include a `StepUpdateDetails` snapshot: the previous position, gradient-evaluation position, true gradient there, sampled noise, gradient used by the optimizer, displacement, coordinate multipliers, and memory before and after the step. AdaGrad/RMSProp/Adam record their denominators; Adam also records bias corrections and corrected moments. Snapshots are copied from the computation rather than reconstructed from the drawn path.

Nesterov's evaluation position can differ from its previous position. The inspector's true gradient is evaluated there, while the comparison table's gradient norm is evaluated at the **new** position. These are different quantities. Adam's coordinate multiplier acts on its corrected first moment; it should not be read as a scalar multiplier of the current raw gradient. Step zero has no update, and an unsafe rejected step produces no accepted snapshot.

`runExperiment(config, { captureUpdates: false })` omits those detailed snapshots for batch studies. It leaves positions, losses, stopping behavior, and random-number generation unchanged.

## Learning-rate studies

[`src/lib/study.ts`](../src/lib/study.ts) evaluates all six optimizers over 3–7 logarithmically spaced rates and 1–5 seeds, at most 210 trials. Rates have equal ratios rather than equal differences. Each trial uses the same surface, starting point, momentum setting, noise amplitude, and maximum budget; only its optimizer, rate, and seed vary. Seeds are consecutive unsigned 32-bit integers, wrapping at the integer limit. Study budgets are 200–1000 iterations and noise is bounded to `0–2`.

With zero noise, changing the seed changes nothing; repeats are identical. With noise enabled, shared seeds give each method the same perturbation sequence at each iteration, while its own position still determines the gradient. These studies demonstrate sensitivity to a small sampled range, not statistically conclusive rankings. Log-scale exploration follows the practical tuning guidance in [Stanford CS231n](https://cs231n.github.io/neural-networks-3/#hyperparameter-optimization) and [Bengio's recommendations](https://arxiv.org/abs/1206.5533); this one-dimensional grid is not claimed to be an optimal search strategy for many hyperparameters.

For each optimizer/rate cell, the median and minimum–maximum range include **only non-divergent terminal losses**. The valid-count denominator and divergent count are explicit. If every trial diverges, the median is absent. A divergent trial retains its last finite loss and best recorded loss separately; neither is substituted for a completed result. Read the failure counts before comparing a favorable survivor median. A run reaching its budget is valid for aggregation even if it has not met convergence criteria.

The reported range describes these samples, not a confidence interval. A lowest fully valid median at the edge of the tested rate range is a reason to investigate the boundary, not evidence that the optimum was found. Heatmap coloring uses an `asinh` transform across the displayed medians; text and exported values remain unscaled.

Study CSV and `optimizer-lab/study-v1` JSON reports retain every trial summary. They are distinct from single-experiment JSON imports. **Replay seed** reconstructs one exact experiment for the full laboratory. Cancellation discards a partial study so it cannot be mistaken for the planned complete sample.

## Input limits

Imported configurations are validated as data; formulas are not evaluated from input text.

| Field            | Accepted values                                             |
| ---------------- | ----------------------------------------------------------- |
| Learning rate    | Finite number from `0.000001` to `2`                        |
| Momentum         | Finite number from `0` to `0.999`                           |
| Noise amplitude  | Finite number from `0` to `5`                               |
| Seed             | Integer from `0` to `4294967295`                            |
| Iteration budget | Integer from `1` to `3000`                                  |
| Start            | Finite x and y within the selected surface's display domain |
| Optimizers       | One to six distinct recognized identifiers                  |

The display domains are `[-4, 4]` for the quadratic bowl, `[-3, 3]` for the saddle and linear-regression parameters, `[-2.5, 2.5]` for Rosenbrock, `[-5, 5]` for Himmelblau, and `[-5.12, 5.12]` for Rastrigin. Omitted settings use defaults; a selected surface supplies its own default start and learning rate.

## Visualization and comparison limits

Surface height is transformed with `asinh` and normalized to the sampled surface range to make steep functions readable. Mesh resolution, perspective, and height compression are display choices. Use the numerical readouts and exported data for actual objective values, not apparent vertical distances in the 3D view.

The common learning rate in the laboratory is useful for showing mechanisms under a controlled setup. It is not a per-method hyperparameter search. A learning rate well suited to Gradient Descent may be poor for Adam, and the reverse can also occur. The rate study broadens that one control but does not tune all other hyperparameters. Results on these six smooth, two-dimensional objectives do not establish an optimizer's performance on high-dimensional models or unseen data.

Tests in [`src/lib/engine.test.ts`](../src/lib/engine.test.ts) check analytic gradients against finite differences, independently calculated updates, repeatability, stopping rules, invalid configuration handling, and divergence. They verify these implementation contracts rather than proving general convergence.

Regression tests verify the least-squares reference and split isolation. Lesson tests verify the numerical comparisons used in the teaching content. Study tests cover logarithmic spacing, aggregation, reproducibility, cancellation, and report exports. See [learning design](learning-design.md) for the educational objectives and a classroom sequence.
