# Recorded comparison suite

Run `npm run benchmark:suite` with the signed USB runner active, the phone unlocked, Mirroring closed, and the optional TypeSafe key configured as described in [JEV](jev.md).

Ten tasks cover multi-digit keys, subtraction, multiplication, division, decimals, percentages, chained calculations, two Clock tab transitions, and Settings navigation. Each task has one local batch run and one JEV run, alternating their order. These are fixed benchmark inputs; the controller still acts on fresh observations. No app-specific workflow is installed in the runner.

Every timed run includes a fresh initial accessibility read, its actions, and an independent fresh result check. Setup and reset are logged separately. A batch knows the correct steps. JEV chooses among currently visible permitted keys or tabs; it does not receive the benchmark step list. Both modes have the same screen recorder running. One pair per task is enough to expose failures and overhead, but does not establish a reliable per-task speed distribution.

Recordings use native screenshots on the separate capture lane, at up to three frames per second and a 1000 px long edge. Every frame retains its request/completion times; the image was captured somewhere inside that interval. No audio is captured. Encoding happens after timing. This is sampled screen video, not a 30 fps touch-event recording. The recordings and input journal together show what happened.

- `benchmarks/runs/<timestamp>/results.json`: source commit, harness digest, environment, task definitions, run order, setup and execution timings, dispatch targets, JEV decisions, verification, frame timings, audio state and failures.
- `benchmarks/runs/<timestamp>/journal.jsonl`: append-only completed run records.
- `benchmarks/private/<timestamp>/`: original frames and final accessibility reads. These can include personal information and stay out of Git.

Input failures stop the run without replay. The next named run starts with a fresh explicit reset. A setup failure stops the suite. Failed sessions are retained. Native transport failures, lock state, permission loss and blank captures are evidence, not successful timing samples.

Publish only inspected, nonpersonal recordings. Do not commit raw Clock/Settings screens or lock-screen notifications. Do not compare these recorded samples directly with older measurements made without recording.

Encode a completed session with `python3 scripts/render-comparison.py <timestamp>` (Pillow and ffmpeg required). This writes individual videos and paired comparisons in the ignored private session directory, plus a public CSV and Markdown timing table. Review every video before publishing it. Video hashes and frame counts are recorded locally.

The encoder was checked with an explicitly labeled, ignored fixture using an older public Calculator screenshot: two videos plus one paired video decoded successfully. That is pipeline validation, not a fresh phone recording.

## Current evidence

The wired suite is now complete. [Ten Operator/Mirroring pairs](../benchmarks/runs/2026-11-11-operator-vs-mirroring/comparison.md) passed on both paths, with recordings. The controlled numeric-burst on/off run passed20/20. The stricter JEV suite passed4/10 and handed back on six. [Findings, failures and exact boundaries](operator-performance.md).

`node scripts/benchmark-suite.mjs --ab-bursts` runs the native on/off comparison without a model key. `--scoped-jev` records a narrower task-specific candidate set; it is a different experiment and must be labeled. Arithmetic completion requires a visible result and the last submitted Equals tap.

`scripts/mirroring-app-benchmark.mjs` is a benchmark helper loaded inside an authorized CUA session with a supplied App handle. It does not provide an external UI driver. Setup must independently verify the ready state. The exporter writes inspected, masked public videos; originals remain local.

Earlier disconnected native attempts and later wireless Spotlight trials remain historical evidence with different tasks and timing boundaries. They do not override the current wired results.
