# Recorded comparison

One pair per task. Alternate mode order; recording on both sides. Setup excluded, fresh result verification included. See results.json for the mode definitions and experiment limits.

| Task | Batch | JEV |
|---|---:|---:|
| add | 1.531s ✓ | 1.981s ✓ |
| subtract | 2.279s ✓ | 0.650s FAILED |
| multiply | 1.707s ✓ | 2.161s ✓ |
| divide | 1.936s ✓ | 0.186s FAILED |
| decimal | 3.366s ✓ | 3.049s FAILED |
| percent | 2.683s ✓ | 0.206s FAILED |
| chain | 3.014s ✓ | 0.709s FAILED |
| clock-stopwatch | 0.485s ✓ | 0.613s ✓ |
| clock-world-clock | 0.504s ✓ | 0.658s ✓ |
| settings-general | 0.247s FAILED | 0.301s FAILED |

Raw videos, originals and frame timestamps are in the local ignored private session directory. Video resamples the ~3 fps capture; the final 0.75 second hold is outside the timer. Failed decisions and inputs are retained in results.json.
