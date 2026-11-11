# Required real-world acceptance tests

TikTok posting and Instagram Reel posting are required. Launching apps, saving a draft, or passing host tests does not satisfy either requirement. Confirm the intended clip, account and visibility before publishing. Generate a neutral test clip only if the user chooses it. Do not publish repeated public posts merely to increase the sample count.

## Required publishing tests

Run each task on the physical iPhone with both the mirroring baseline and the direct controller when the baseline input route is functional. Use the same video, caption and visibility. Measure an actual final publication for each platform; use additional draft-only runs to profile editor navigation without creating duplicate public posts. Label draft-only timings separately.

| Stage | Evidence and timing |
| --- | --- |
| Open app and verify account | Exact intended destination account; no wrong-account actions |
| Open composer and choose media | Correct clip, duration, orientation and selection order |
| Wait for media preparation | Separate app processing from controller/model latency |
| Edit and caption | Exact caption retained; keyboard did not conceal required controls |
| Choose visibility | Actual selected audience and posting options |
| Preview | Correct clip/crop/audio and no unintended edits |
| Publish | Timestamp of dispatch and outcome; never repeat an uncertain publish |
| Verify destination | Post appears on the intended account, opens and plays; caption and visibility checked |

Success requires the correct published object with no duplicate, wrong account, wrong audience or corrupted caption. A badge or a successful tap is insufficient. If a post cannot be independently verified, mark the result uncertain and inspect it before retrying.

## Other valuable criteria

1. **Time to a correct completed task.** Record total wall time, model/tool turns, driver time, observation time, rendering/processing/upload waits, and human authentication time separately.
2. **First-attempt success and recovery cost.** Include failed attempts and their recovery time. Report an unusable baseline as a failure; never divide a timeout by a successful result to invent a speedup.
3. **Targeting correctness.** Count wrong taps, ambiguous selectors, stale handles, and actions refused before dispatch. Include label-poor custom controls and screenshot fallback.
4. **Text correctness.** Check punctuation, Unicode, emoji, multiline captions, autocorrect changes, focus, truncation, and accidental submission.
5. **Media picker robustness.** Correct video versus nearby look-alikes; nested scrolling; permission prompts; multiple selections; return to the composer.
6. **Keyboard and modal handling.** Covered buttons, back navigation, unexpected sheets, safe dismissal, and cancellation without losing unrelated drafts.
7. **Network and app waits.** Detect an enabled next action instead of using fixed sleeps. Distinguish uploaded, processed, published and verified.
8. **User takeover.** Stop promptly on cancellation. Never clear existing user drafts or replay uncertain input after reconnecting.
9. **Generalization.** Repeat fresh read-only navigation/search tasks in unrelated apps. Repeated execution of one taught screen is not proof of general control.
10. **Resource cost.** Resident memory/CPU, screenshot bytes, observation/schema size, and model/API usage. Record instrumentation overhead separately.

## Useful results, not just stopwatch numbers

For every failure, record the platform/app version, step, expected state, observed state summary, error class, whether input was sent, recovery taken, and effect on the final result. Capture a private checkpoint screenshot only when useful to explain a failure. Avoid continuous screenshots during latency profiling, since capture overhead changes the measurement.

Keep raw media, screenshots, captions, account names and post URLs in ignored `benchmarks/private/` unless the user explicitly chooses them for public release. Public results should contain redacted timing summaries, reproducible controller settings, source revision, sample counts, successes, failures and limits.

Current blockers and findings must remain visible. No claim that all apps work, that a post published, or that this is faster than every alternative is valid without evidence at that scope.
