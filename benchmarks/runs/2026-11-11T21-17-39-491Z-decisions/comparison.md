# Live JEV decision trials

Ten synthetic state fixtures; live TypeSafe API. These are chooser decisions, not physical-phone task runs or video recordings. The phone disconnected before recorded task measurements could complete.

| State | Choice | API time | Correct | Controller gate |
|---|---|---:|---|---|
| first-digit | Seven | 154.7 ms | yes | pass |
| operator | Add | 51.4 ms | yes | hand back |
| second-operand | Eight | 139.0 ms | yes | pass |
| equals | Equals | 63.9 ms | yes | pass |
| multi-digit | Eight | 104.4 ms | yes | pass |
| decimal-point | Decimal | 156.6 ms | yes | pass |
| percent | Percent | 82.5 ms | yes | pass |
| chain | Multiply | 114.6 ms | yes | pass |
| clock-tab | Stopwatch | 99.2 ms | yes | pass |
| settings-navigation | com.apple.settings.general | 53.2 ms | yes | pass |

**10/10 expected choices; 9/10 accepted at the existing 0.9 gate.** Median 101.8 ms, range 51.4–156.6 ms. The first request includes a colder connection; one sample per state gives no reliable per-state latency estimate.

The Add choice was correct but its confidence was 0.830, selected probability 0.840, and action-presence score 0.970. The actual controller requires all three to reach 0.9. Keep the stop visible; do not count it as a completed task or lower the threshold from one sample.

The candidate order rotated across cases. Calculator fixtures offered 19 keys, Clock offered four tabs, and Settings offered three navigation controls. These fixtures use observed iOS vocabulary, but are constructed states rather than raw device captures. Candidate identifiers/labels and action history are preserved in results.json. Every response, model version, token count, elapsed time, expected target and outcome is saved.

What this establishes: JEV can choose the expected next control for these ten states with roughly 0.1 seconds of API overhead. What it does not establish: tap delivery, screen-transition reliability, real-device task completion, recording overhead, or a phone speedup.

Reproduce: `node scripts/benchmark-decisions.mjs`. Requires the configured TypeSafe key. No phone needed.
