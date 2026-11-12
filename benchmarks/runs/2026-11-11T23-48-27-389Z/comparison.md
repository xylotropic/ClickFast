# Recorded comparison

One pair per task. Alternate mode order; recording on both sides. Setup excluded, fresh result verification included. See results.json for the mode definitions and experiment limits.

| Task | single_tap | burst |
|---|---:|---:|
| add | 1.538s ✓ | 0.654s ✓ |
| subtract | 2.317s ✓ | 0.756s ✓ |
| multiply | 1.534s ✓ | 0.658s ✓ |
| divide | 1.901s ✓ | 0.690s ✓ |
| decimal | 3.363s ✓ | 1.230s ✓ |
| percent | 2.652s ✓ | 0.839s ✓ |
| chain | 3.002s ✓ | 0.886s ✓ |
| clock-stopwatch | 0.488s ✓ | 0.510s ✓ |
| clock-world-clock | 0.510s ✓ | 0.494s ✓ |
| settings-general | 0.753s ✓ | 0.741s ✓ |

Raw videos, originals and frame timestamps are in the local ignored private session directory. Video resamples the ~3 fps capture; the final 0.75 second hold is outside the timer. Failed decisions and inputs are retained in results.json.
