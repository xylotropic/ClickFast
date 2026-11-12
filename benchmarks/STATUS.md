# Measurement status

**Latest:** [Ten matched Operator/Mirroring recordings](runs/2026-11-11-operator-vs-mirroring/comparison.md),10/10 on both paths;7.46s versus30.53s total warm time. Controlled native burst comparison20/20,2.85× less total time across seven calculations. Strict JEV suite4/10. [Method and failure audit](../docs/operator-performance.md). Earlier sections below are historical and use different boundaries.

A physical iPhone 16 Pro Max running iOS26.5 was tested with Xcode26.5. Mirroring and the native controller were isolated for valid measurements. These are small exploratory samples, not a universal performance claim.

## Active benchmark: Calculator

The user replaced publishing acceptance with the easiest verifiable speed test. All modes calculate `7 + 8 =15` and verify the displayed result; reset and launch are outside warm task timers.

| Mode | Time | Correct results |
| --- | --- | --- |
| Four separate coding-agent/tool turns |19.15 s, one sample|1/1|
| One newly generated local batch |1.47 s median|5/5|
| Bounded local JEV loop |1.91 s median|3/3|
| Actual configured Node24 stdio MCP + live JEV |1.93 s|1/1|

Only1.49 s of the interactive trial was in driver operations; approximately17.66 s was between them. That is why the local modes are much faster in this small experiment. This was a familiar warm Calculator task, with one interactive sample and no counterbalanced agent-level repeats. The observed10–13x ratios describe this experiment, not raw tap speed, unknown-screen accuracy or all-app performance. A known-action batch is faster than JEV when no decision is needed.

Live model: `jev-1.14.0`;12 decisions across the three repeated trials, median89.74 ms. All actions were chosen from four explicitly permitted current keys.13 initial experiment requests included one failed adapter attempt that sent no input; it exposed a fractional timeout bug, now fixed and regression-tested. Successful repeated trials used10,689 input and996 output tokens; the separate live MCP verification has its own recorded usage. Costs are not estimated without a verified price schedule. See `calculator-task.json` and `mcp-live.json`.

The phone's Control Center showed Volume0% and Mute on. Native output-volume readback verified0 before the silent benchmark. MCP and CLI now enforce verified media volume0 before control, sending only the needed volume-down presses and stopping if verification fails.

## Other actual results

| Test | Result | Boundary |
| --- | --- | --- |
| Fresh source → locator → tap → verified Calculator display |462ms median,6/6 successful|Driver only; reset and model inference excluded|
| Sprint fresh observation → guarded tap → verified display |417ms median,6/6 successful|Same phone/backend/task; alternating order;9.8% less time|
| Direct AX reading |45ms Sprint median;44ms source median,10 each|Sprint's benefit is registered handles and smaller payload, not a faster raw read|
| Direct app launch from Home |Calculator92ms; Clock530ms; Settings201ms medians,3 each|App/AX presence, not a full settled user task; first Clock/Settings launches took1.57s/1.30s|
| Snapshot expiry |Passed|A31-second-old target was refused before input; Calculator display unchanged|
| TikTok |One publication, verified in owner-only grid|Correct generated clip, exact Unicode/multiline caption, **Only you**. Reopened playback still unverified|
| Instagram Reel |Private draft saved and reopened; zero shares|Correct clip/caption. Observed audience choices include other people, so publication was stopped to meet the user's owner-only requirement|
| Orb |Centered,12 distinct captured frames|Official ThinkingOrbsKit `.working`,64pt, dark theme,#121212 background|
| Node tests / native host checks |30/30 and247/247|Contract/correctness checks, not app-performance evidence|

See `selection-cycle.json`, `direct.json`, `snapshot-expiry.json`, `posting-stages.json`, `orb-ui.json`, and `acceptance.json`. The first A/B attempt failed during reset because Calculator changes AllClear to Clear; that failure remains in `selection-cycle-attempt1.json`. The corrected harness reads the actual reset key before every trial.

## AXe comparison on this phone

AXe v2.0.2 was downloaded from its official release and checked against its published SHA-256. Its documented Homebrew post-install signing was applied locally. XCTest was shut down and its Xcode process exit confirmed before AXe tests; Mirroring remained quit.

Three physical AX reads succeeded:1.713s,1.400s,1.418s. The device did not advertise AXe's screenshot or supported `com.apple.coredevice.hid.indigo` input service. Doctor, screenshot and coordinate-tap attempts therefore failed. No AXe tap speedup was measured. This is a compatibility finding for this phone/Xcode setup, not proof AXe is generally slow or broken. Its AX and Sprint AX read interfaces also differ, so their ratio is not a complete-task speed ratio. See `axe-device.json` and [source review](../docs/axe-review.md).

## Publishing findings worth preserving

The generated six-second title-card video imported successfully through an optional add-only Photos route. Import is disabled by default and never reads/removes existing assets. The initial fade made black picker thumbnails; a better fixture starts with a visible frame. TikTok saved another six-second copy after publishing, so Instagram's newest tile was not the original. Preview, duration and watermark checks caught that distinction.

Both apps retained exact punctuation, emoji and newline input. Keyboard dismissal required a separate verified action. Instagram's caption expansion pushed Audience below the fold; blindly reusing its earlier location was ineffective. A first-use Close Friends notice interrupted the expected state. Close Friends includes other users and was rejected after the user's owner-only clarification; Share was never dispatched. The saved draft was reopened and its caption verified.

TikTok's private grid contained the uniquely matching published object. An attempt to open it coincided with the runner exiting before its test completed; xcresult reports exit code0, not a proven crash cause. Recovery did not replay Post. A later point tap was acknowledged but did not visibly open playback. Dispatch success and independently verified task success remain separate.

These exploratory flows include development pauses, recovery and changing UI/account state. Their event timings cannot be presented as clean posting-task runtimes. Those historical publication tests remain incomplete, and the user has explicitly replaced them as the active benchmark; no further posting work is being attempted.

## Optional JEV local navigation

A zero-dependency optional chooser now runs a bounded fresh-screen loop through TypeSafe Choice plus candidate-presence Noul. It has explicit app/selector scope, a visible completion predicate, no-progress/budget handoff, and no mutation replay. Sensitive/publication targets hand back to the caller. It requires per-goal external UI opt-in and a locally configured TypeSafe key. The live Calculator and stdio-MCP measurements above now exercise this path. API-contract tests are separate from that physical evidence. No universal accuracy or latency claim follows from the small sample.

The9.8% driver-cycle improvement is modest. The larger measured difference comes from reducing coding-agent round trips. JEV thresholds are conservative experimental gates, not calibrated accuracy guarantees.

## Earlier evidence and limits

`transport.json`:20 signed health and20 lock reads, medians2.94/3.06ms; transport only. `resources.json` and `setup-cleanup.json`:single historical host samples, not current peak CPU/phone memory. They include Xcode runtime overhead and the removed legacy daemon; current UI/runtime size can differ.

`mirroring-isolated.json`:three successful exploratory app opens with XCTest stopped,13.287s/13.858s/19.659s including agent/tool/screenshot recovery. Coordinate clicks failed even in isolation; keyboard activation worked after recovery. These boundaries differ from direct driver timings, so no speed ratio is justified. `mirroring-attempts.json` retains earlier invalid mixed-controller attempts. Concurrent Mirroring caused AX to describe a different surface from the screenshot; the MCP front end now refuses direct control while Mirroring runs.

No result here establishes all-app correctness, a whole-posting-task speedup, JEV performance beyond this small Calculator test, battery impact, or sustained/peak resource usage. Private account evidence remains outside Git.

## Additional comparison suite — November 11

- [Ten live synthetic-state JEV decisions](runs/2026-11-11T21-17-39-491Z-decisions/comparison.md): 10/10 correct choices, 9/10 accepted by the existing 0.9 gate. Median API latency 101.8 ms. Full fixture/response logs and CSV saved. No phone input or real-device speed claim.
- Ten physical task pairs with video were prepared. Two setup sessions failed before any timed task completed. The user confirmed the cable is unavailable; paired wireless discovery remains unreachable. No new phone videos or completed task measurements are claimed.
- Recorder/encoder fixture check: two videos and one paired comparison produced and decoded; this is pipeline validation with an old public image, not a fresh device recording.
- Historical repository brand: flick; current name is Operator. original monochrome SVG mark and wordmark in docs/brand. Stable sprint APIs and native runner identifiers retained.

## Real wireless phone confirmation

[Ten real tasks and recordings](runs/2026-11-11-wireless-phone/comparison.md): physical iPhone over Apple Mirroring, 10/10 confirmation, 0.921 s median warm input/verification, 3.596 s median reset plus task. Ten full private videos and ten public paired comparisons were decoded successfully. Original errors remain in the logs. The first completed round is compared with one pinned final controller. This validates Spotlight text entry, calculations/conversions and result verification; it does not establish arbitrary-app tap control, JEV performance or native XCTest Wi-Fi connectivity. [Scope, failures and wired comparison plan](../docs/wireless.md).
