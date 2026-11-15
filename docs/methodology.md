# Methodology

The lab studies unconstrained optimization of a scalar objective `f(x, y)` using analytic gradients. It computes an experiment independently of playback, then displays its stored trajectory. Camera movement and animation speed never alter the numerical result.

## Loss surfaces

| Surface        | Objective                        | Analytic gradient `(∂f/∂x, ∂f/∂y)`               | Known global minima                  |
| -------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------ |
| Quadratic      | `½(x² + 6y²)`                    | `(x, 6y)`                                        | `(0, 0)`, loss `0`                   |
| Quartic saddle | `x² − y² + 0.15y⁴`               | `(2x, −2y + 0.6y³)`                              | `(0, ±√(10/3))`, loss `−5/3`         |
| Rosenbrock     | `(1−x)² + 100(y−x²)²`            | `(2(x−1) − 400x(y−x²), 200(y−x²))`               | `(1, 1)`, loss `0`                   |
| Himmelblau     | `(x²+y−11)² + (x+y²−7)²`         | `(4x(x²+y−11)+2(x+y²−7), 2(x²+y−11)+4y(x+y²−7))` | Four points with loss `0`; see below |
| Rastrigin      | `20+x²+y²−10[cos(2πx)+cos(2πy)]` | `(2x+20πsin(2πx), 2y+20πsin(2πy))`               | `(0, 0)`, loss `0`                   |

Himmelblau's stored minima are `(3, 2)`, `(-2.805118, 3.131312)`, `(-3.779310, -3.283186)`, and `(3.584428, -1.848126)`. Three are rounded coordinates, so their computed loss need not be exactly zero.

The quartic saddle is bounded below and has a stationary saddle at `(0, 0)`. It is deliberately different from the unbounded surface `x² − y²`. With zero gradient, zero velocity, and no noise, all six methods can remain at the exact saddle; momentum is not a guaranteed escape mechanism.

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

The display domains are `[-4, 4]` for the quadratic bowl, `[-3, 3]` for the saddle, `[-2.5, 2.5]` for Rosenbrock, `[-5, 5]` for Himmelblau, and `[-5.12, 5.12]` for Rastrigin. Omitted settings use defaults; a selected surface supplies its own default start and learning rate.

## Visualization and comparison limits

Surface height is transformed with `asinh` and normalized to the sampled surface range to make steep functions readable. Mesh resolution, perspective, and height compression are display choices. Use the numerical readouts and exported data for actual objective values, not apparent vertical distances in the 3D view.

The common learning rate is useful for showing mechanisms under a controlled setup. It is not a per-method hyperparameter search. A learning rate well suited to Gradient Descent may be poor for Adam, and the reverse can also occur. Results on these five smooth, two-dimensional functions do not establish an optimizer's performance on high-dimensional models or unseen objectives.

Tests in [`src/lib/engine.test.ts`](../src/lib/engine.test.ts) check analytic gradients against finite differences, independently calculated updates, repeatability, stopping rules, invalid configuration handling, and divergence. They verify these implementation contracts rather than proving general convergence.
