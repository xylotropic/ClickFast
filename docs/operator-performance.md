# Operator: physical-phone measurements

Operator completed ten matched tasks on a wired iPhone16ProMax/iOS26.5. Ordinary Apple iPhone Mirroring, controlled through CUA, completed the same ten. Both received known short action plans. Every confirmed result has a recorded screen sequence and an independent result check.

[Ten paired recordings and full table](../benchmarks/runs/2026-11-11-operator-vs-mirroring/comparison.md) · [Video viewer](../benchmarks/runs/2026-11-11-operator-vs-mirroring/comparison.html) · [Metrics and video hashes](../benchmarks/runs/2026-11-11-operator-vs-mirroring/results.json)

Total warm time was7.46s for Operator and30.53s for Mirroring/CUA:4.09×. Individual ratios ranged from1.14× for opening General to5.81× for chained arithmetic. This compares the complete automated paths, including their observation and verification costs. It is one confirmed pair per task, with the native suite before the Mirroring suite. It is not a human speed test, a randomized planner trial, a latency distribution, or evidence that every app works.

## What made it faster

Individual synthesized taps spend about225ms beyond their50ms touch duration waiting on Apple's test service. A numeric burst submits2–8 currently observed keys in one event record. It keeps50ms holds and30ms gaps, validates each live key's identity/frame/bounds before dispatch, and reads the result afterward. Non-key controls, Send/Delete keys, secure fields, explicit transition checks and per-step deadlines are excluded. Unknown delivery stops the remaining steps without replay.

The paired on/off run used the same compiled native runner, inputs and verifier, alternating mode order. It passed20/20. The seven calculations fell from16.307s to5.713s, a2.85× improvement. One-tap navigation did not materially change. [Results](../benchmarks/runs/2026-11-11T23-48-27-389Z/comparison.md).

The first prototype only grouped digits. Real Calculator uses labels such as Add/Equals/Point, which the original eligibility check excluded. Physical recordings exposed that mistake; admission now checks the observed identifier plus expected semantic label. Seven native admission checks and three controller checks cover grouping, exclusions and uncertain delivery.

No saved routine is installed. The caller still builds a new short plan from current controls; grouping is a general numeric-key optimization. This does not make an unknown navigation sequence safe to batch.

## JEV findings

JEV remains an optional one-action-at-a-time chooser. Its Choice and companion Noul questions now share the executable controls in their state, as required by the [companion Noul pattern](https://docs.typesafe.ai/patterns/companion-noul). Choice descriptions are shorter, reducing repeated payload. The0.9 gates were not lowered.

The strict physical suite passed4/10: multiplication, both Clock transitions and General. The other six handed back at the decision gates. Narrowing each arithmetic task's candidate set did not make sequential entry reliable. [Actual run](../benchmarks/runs/2026-11-11T23-49-23-694Z/comparison.md). Do not replace these results with the earlier3/3 simple-task sample or synthetic-choice accuracy.

A result-only predicate caused one false positive: entering the first5 of50×10% matched the requested final5. The original record is retained with an explicit [audit correction](../benchmarks/runs/2026-11-11T23-45-27-851Z/audit.json). `until.after_action` now also requires the specified last submitted tap, such as Equals. The strict suite uses it for every calculation. Regression checks cover both premature matching values and proper action-plus-result completion.

A five-state replay used real failed phone AX captures, without sending phone input. It improved expected next-choice selection from4/5 to5/5, but current median API time was69ms versus56ms before, and only3/5 current decisions cleared execution gates. This is not a request-latency improvement or a phone completion result. [Replay](../benchmarks/runs/2026-11-11T23-30-16-677Z-real-state-replay/results.json).

Use JEV for bounded uncertain choices, and direct plans for already-known input. Broader autonomous control needs more real navigation cases, calibrated confidence/abstention and recovery evaluation. Repeated model calls for known arithmetic currently add latency and failures.

## Recordings, failures and privacy

Native screenshots run on a separate connection at up to3fps. Mirroring screenshots follow each click, with fresh Mac AX checks between input actions; phone controls are found from the screenshot. Apple Vision plus Tesseract checks the result. A real visually verified zero capture covers Vision's single-zero miss. Clock trials verify the starting tab and then Lap or the World Clock heading; merely seeing a persistent tab label does not count.

Earlier Mirroring attempts include a native-pipe interruption, single-glyph OCR misses, a missing keypad anchor, a search setup that did not focus the field, and clicks on Clock labels below the effective icon hit area. One early World Clock result lacked a verified starting tab and is explicitly excluded. [All retained attempt outcomes](../benchmarks/runs/2026-11-11-operator-vs-mirroring/mirroring-attempts.json). The confirmed seven calculations use one unchanged harness; the three navigation confirmations use a later harness that validates starting state and clicks the observed tab icon above its label. Harness hashes are in the final results.

An extra UI-preview handoff reset timed out while Calculator still showed12+. It was not a timed benchmark result. The separate fresh read prevented claiming a reset, and native lock was verified before stopping the runner and starting Mirroring. No input with unknown delivery was replayed.

Public videos mask Clock detail rows and Settings account/network regions. Raw frames, OCR, final AX and individual native videos remain in ignored `benchmarks/private/`. The public side-by-side videos preserve capture timestamps, resample at10fps, and add a0.75s final hold outside the timer. Full ffmpeg decoding, stream inspection and SHA-256 checks passed for all ten. They have no audio streams. A10fps encoded file is not10fps capture.

Media volume was read from the active system Audio/Video category and verified0 before native trials; the public audio receipts retain the value. AVAudioSession's background value was stale, so it no longer supplies the mute check. Mac output mute was verified before every Mirroring trial. Neither volume was restored. Native XCTest and Mirroring never controlled the phone concurrently.

## Next useful tests

- Twenty repeated trials per task, balanced AB/BA order, cold launch separated from warm control, and median/p95 plus confidence intervals.
- A consented human baseline with identical starting states and completion rules, timed from the same signal.
- Long-list scrolling, keyboard entry/autocorrection, app switching, custom canvas fallback, rotation and animation transitions in several apps.
- Wi-Fi latency/dropout and reconnect recovery using the same physical tasks; the previous wireless Spotlight results have different boundaries and cannot be compared directly.
- JEV choice quality, abstention rate and task completion on genuine unfamiliar navigation. Retain uncertain outcomes and recovery time; do not count handbacks as fast successes.
