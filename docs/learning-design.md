# Learning design

The platform is intended for learners who can read coordinates and simple derivatives but may not yet connect an optimizer equation to its behavior. Its purpose is to make a claim, inspect evidence, and explain what changes—not to declare one optimizer universally best.

## Why these features

[PhET's teaching guidance](https://phet.colorado.edu/en/teaching-resources/teaching-with-phet/whole-class) describes prediction, discussion, observation, and reflection around simulations. [Freeman et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC4060654/) found broad benefits from active learning across undergraduate STEM studies. These sources motivate the design; they do **not** establish that this application improves learning or that its particular interface has been evaluated.

The implemented sequence is **predict → run → inspect measured evidence → explain → check understanding**. Predictions are not graded. A correct concept check marks a lesson complete locally, with explanatory feedback available after an incorrect attempt. Completion is a practice record, not a score, certificate, or validated assessment. All lessons remain available so a learner can revisit a misconception or choose a relevant starting point.

| Feature                      | Learning objective                                       | Evidence the learner inspects                                                    |
| ---------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Turn a slope into a step     | Separate gradient direction from learning-rate magnitude | Hand-calculable first updates at two rates                                       |
| Find the stability boundary  | Separate shrinking oscillation from divergence           | GD at rates below and above the quadratic's stability boundary                   |
| Give an optimizer a memory   | Explain why history affects the next move                | Matching first updates, then different GD/Momentum/Nesterov paths                |
| Look inside an adaptive step | Distinguish gradient magnitude from applied movement     | GD's coordinate ratio versus AdaGrad/Adam's first-step scaling                   |
| Question a flat gradient     | Avoid treating stationarity as a global solution         | An exact saddle, a seeded perturbation, and a Rastrigin local basin              |
| Inside one step              | Translate an equation into the state actually used       | Evaluation point, gradient, noise, memory, denominator, and displacement         |
| Fit a Line                   | Connect parameter-space loss to model predictions        | Slope/intercept, predicted line, individual residuals, and split MSE             |
| Parameter study              | Design a controlled comparison and recognize sensitivity | Rate/seed cells, valid counts, divergent trials, medians, and individual replays |

The optimization content follows [Stanford CS231n](https://cs231n.github.io/optimization-1/), [Distill's momentum analysis](https://distill.pub/2017/momentum/), and the original [AdaGrad](https://jmlr.org/papers/v12/duchi11a.html) and [Adam](https://arxiv.org/abs/1412.6980) papers. The app's exact conventions and numerical safeguards are documented in [methodology](methodology.md); they matter when reproducing a result in another implementation.

## A suggested 40-minute classroom sequence

This is an instructor-planned activity, not a measured completion-time claim. Use pairs or a projected demonstration. Ask learners to record a prediction before showing a result; alternate who explains the reasoning. For 30 minutes, assign the final comparison as follow-up. For 45 minutes, add a second seed or rate-range revision.

| Time      | Activity                           | Worksheet prompt                                                                                                                                                                              |
| --------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–5 min   | Lesson 1: one GD step              | At `(2,1)` on the quadratic, write the gradient and the update for `η=0.1`. Which coordinate moves farther, and why?                                                                          |
| 5–12 min  | Lesson 2: stability                | Predict which of `η=0.1, 0.3, 0.4` will diverge. Use `yₜ₊₁=(1−6η)yₜ` to explain a result. Does zigzagging alone imply divergence?                                                             |
| 12–20 min | Lessons 3–4 and the step inspector | Why do zero-velocity methods begin with the same first update? At a later step, identify the memory term. Explain why equal nominal rates need not produce equal update lengths.              |
| 20–27 min | Fit a Line                         | Pause at two iterations. Record `w`, `b`, one prediction, and its squared error. Why is training MSE twice the surface loss? Which observations influence the gradient?                       |
| 27–35 min | Parameter study                    | Choose a rate range and one fixed starting point. Repeat with noise and three seeds. Report both the median and the number of failures. Is the lowest fully valid median at a range boundary? |
| 35–40 min | Lesson 5 and an exit explanation   | Give one example where a tiny gradient is not a global solution. State one claim supported by your runs and one claim they cannot support.                                                    |

For a reproducible submission, collect one experiment JSON or share link, the study CSV if used, and a short explanation containing: **prediction, controlled settings, observation, reasoning, limitation**. Avoid grading students on which optimizer happened to finish with the lowest loss.

## Misconceptions to discuss explicitly

- **“A large gradient always means a large update.”** This holds for the raw GD rule at a fixed rate, but adaptive denominators and velocity change the applied step.
- **“Momentum automatically escapes a saddle.”** With exactly zero gradient and zero initial velocity, the implemented methods can remain stationary. A perturbation changes the experiment.
- **“A flat trace proves convergence.”** It may be a local minimum, saddle, or small update. The lab uses reference minima as part of its explicit convergence rule.
- **“The lowest median wins.”** A survivor median can exclude failed trials. Read valid and divergent counts, then replay individual seeds.
- **“More seeds always add evidence.”** At zero noise, seeds produce identical runs here. With noise, a few seeds give a descriptive sample, not a confidence interval.
- **“A low training loss proves generalization.”** The regression example uses only 25 fixed synthetic training observations and 12 held-out observations. Its small evaluation split is a teaching device, not a real-world test.
- **“The plotted height is the raw loss.”** Surface height is compressed with `asinh`. Numerical readouts and exports retain original values.

## Evaluation boundaries

The simulation uses smooth objectives, analytic gradients, and two parameters. Its synthetic gradient noise does not reproduce minibatch data sampling. The regression updates use the full training set, and there is no neural network, classification accuracy, or data-upload pipeline hidden behind the examples.

Numerical tests verify the behaviors stated in lessons, and browser tests verify interaction contracts. Neither is a learning-outcome study. A future educational evaluation would need concept questions beyond these practiced examples, a pre/post design, appropriate comparison conditions, and learner feedback. The current app deliberately makes no efficacy claim beyond its implemented, testable functionality.
