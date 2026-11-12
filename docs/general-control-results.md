# General control on a physical iPhone

The latest broader run verified seven of 12 attempted tasks on the wired iPhone. Four tasks stopped at JEV decision gates without sending input; one failed setup before a timed phase. This is not reliable enough for unattended general control. The earlier 4/10 Calculator/navigation suite used different tasks and cannot serve as a paired baseline.

The runner was muted before each trial. Each timed task used live JEV decisions and a fresh independent accessibility check. Setup, app launch and reset were excluded from the reported warm phase time. Source hashes, the complete task definitions, decisions and failures are in the [run record](../benchmarks/runs/2026-11-12T01-30-09-852Z-general/results.json). Raw phone frames and full private model traces stay in ignored `benchmarks/private/`.

| Task | Outcome | Warm task time | Actions |
| --- | --- | ---: | ---: |
| folder-clock-home | Setup failed | — | 0 |
| folder-media-youtube-home | Verified | 3.565 s | 4 |
| contacts-text | Verified | 0.553 s | 1 |
| shortcuts-gallery | Verified | 0.860 s | 1 |
| calendar-date-text | Verified | 0.619 s | 1 |
| files-document-find | Decision handback | 0.155 s | 0 |
| app-store-multiword | Decision handback | 0.500 s | 0 |
| reminders-punctuation | Verified | 0.645 s | 1 |
| weather-city-unicode | Verified | 0.969 s | 1 |
| books-title-query | Verified | 0.596 s | 1 |
| settings-search | Decision handback | 0.276 s | 0 |
| youtube-query | Decision handback | 0.284 s | 0 |

## What changed

The chooser now sees a flat set of executable actions: tap, text, Home, permitted app launch and bounded swipe. Text is an exact caller-provided literal, not model-generated content. It binds the target field to the observed app, snapshot and native element identity, then revalidates after focus. Folder closing requires the folder title to disappear before another decision. Candidate controls are deduplicated by native identity; distinct controls with similar labels remain distinct.

Choice and its companion Noul question use the same permitted actions. Neither DONE nor a model verdict substitutes for the completion predicate. The confidence, selected-probability and availability gates remain at 0.9. The remaining Files, App Store, Settings and YouTube decisions failed these gates; reporting them as quick successes would be wrong.

## Limits and retained attempts

The folder/Clock case had an incorrect ready-state fixture and never entered its timed phase. It counts against completion and has no action recording. The remaining 11 cases have timestamped phone frame sequences. A YouTube cleanup request was aborted after its decision handback; that result remains a failure.

Earlier pilots and both broader suites are retained under `benchmarks/runs/2026-11-12*general/`, including an audit of an earlier misleading zero-action error label. No failed outcome was changed to success. These single attempts do not estimate p95 latency, human performance, arbitrary-app coverage or superiority over other products.

Host checks: 46 passed. Native admission checks: 264 passed. These checks support implementation correctness; they do not replace the physical trials.
