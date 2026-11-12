# Recorded comparison

One pair per task. Alternate mode order; recording on both sides. Setup excluded, fresh result verification included. See results.json for the mode definitions and experiment limits.

| Task | batch | jev |
|---|---:|---:|
| add | 0.645s ✓ | 0.800s FAILED |
| subtract | 0.757s ✓ | 1.161s FAILED |
| multiply | 0.654s ✓ | 2.020s ✓ |
| divide | 0.651s ✓ | 0.662s FAILED |
| decimal | 1.239s ✓ | 0.655s FAILED |
| percent | 0.836s ✓ | 0.187s FAILED |
| chain | 0.898s ✓ | 1.561s FAILED |
| clock-stopwatch | 0.477s ✓ | 0.594s ✓ |
| clock-world-clock | 0.491s ✓ | 0.577s ✓ |
| settings-general | 0.774s ✓ | 0.869s ✓ |

Raw videos, originals and frame timestamps are in the local ignored private session directory. Video resamples the ~3 fps capture; the final 0.75 second hold is outside the timer. Failed decisions and inputs are retained in results.json.
