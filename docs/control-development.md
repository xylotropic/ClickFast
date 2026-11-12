# General phone control

The latest full suite verified 16/20 bounded tasks with ClickFast and 14/20 through ordinary Mirroring. Twelve tasks passed on both paths: median elapsed time was 2.040 s for ClickFast and 16.547 s for Mirroring. The median per-task ratio was 7.59×. These are complete workflows with different decision and observation paths, not a pure driver benchmark. [Individual outcomes](../benchmarks/runs/2026-11-12-general-v10-vs-mirroring/comparison.md).

Reliability remains incomplete. The latest full run failed Books text entry, TikTok scrolling, X readiness and X scrolling. Passing app-opening checks does not establish control of everything inside those apps.

## Recorded iterations

These are real, recorded Home-to-result tasks on an iPhone 16 Pro Max running iOS 26.5 over USB. Each suite attempts twenty distinct intents across folders, Contacts, Calendar, Shortcuts, Files, App Store, Weather, Reminders, Books, Settings, TikTok, Instagram, X and YouTube. Repeated suites are development iterations, not additional distinct tasks.

| Session | Verified | What changed or failed |
| --- | --- | --- |
| `2026-11-12T05-23-10-976Z-general` | 8/20 | Launch transitions, incomplete AX reads and broad JEV goals failed. |
| `2026-11-12T05-33-38-293Z-general` | 9/20 | Added visual checks; fast OCR missed real labels. |
| `2026-11-12T05-46-00-324Z-general` | 16/20 | Accurate OCR and conditional field readiness checks. |
| `2026-11-12T05-51-37-972Z-general` | 17/20 | Files and Weather navigation repaired; TikTok startup, X scroll and YouTube readiness still failed. |
| `2026-11-12T06-08-36-149Z-general` | 15/20 | TikTok and YouTube passed; changed app states exposed Contacts, Files and Books navigation failures, plus X failures. |
| `2026-11-12T06-21-40-447Z-general` | 16/20 | Books and the X gutter swipe passed. Contacts field motion, an empty Files transition, TikTok scroll verification and X AX readiness failed. |
| `2026-11-12T06-25-53-384Z-general` | 17/20 | Contacts, Files and Books passed. TikTok content and two X AX-readiness checks failed. |
| `2026-11-12T07-13-52-498Z-general` | 15/20 | Stricter scroll verification requires two body-text anchors to move together. TikTok, Instagram, X and YouTube scrolls did not satisfy it; X readiness failed. |
| `2026-11-12T07-26-20-589Z-general` | 16/20 | Guarded slow-release scrolls verified real movement in Instagram and YouTube. Books encountered a changed target; TikTok and X still failed. |

All attempts remain in `benchmarks/runs/`. Original phone frames and JEV traces stay in ignored `benchmarks/private/`; they can contain private screen content and must not be published. Local playback exports preserve the entire captured phone frame and measured wall time. They add no bars, overlays, fabricated UI or speed changes. Native black areas remain visible. A missing task timing remains incomplete even when the available failure footage can be exported.

## Controller changes

- CoreDevice launches an explicitly named app; launch, foreground checks and result verification stay inside task time.
- An exact supplied literal can enter one observed empty nonsecure field directly. Native app, snapshot, identity and focus checks remain in force.
- A successful input followed by an unavailable AX read retains its delivery receipt and obtains a fresh pixel context. It does not repeat the input. Unknown delivery still stops.
- One explicitly unsent stale-snapshot, moved-target or changed-target refusal can re-observe and ask JEV again. Unknown delivery and unrelated refusals still stop.
- Loading screens and empty transition trees are re-observed before selecting another navigation action. An empty tree cannot prove that a control disappeared. A field transition waits for the requested field rather than treating an unrelated clock update as progress.
- Back controls retain their native back meaning when their visible label names the destination. Empty unlabeled containers are excluded from model choices. Search prerequisites are expressed as the next navigation step; JEV still chooses the control at the same 0.9 gates.
- Native AX reads request a two-second timeout and do not retry at several depths after a timeout or missing server. The subsequent suites completed without the earlier sixty-second queue stall.

The hybrid benchmark admits caller-supplied app names, exact text and swipe primitives directly. JEV chooses navigation controls. A known swipe is not a JEV decision, and benchmark plans are not saved product routines. These results measure bounded tasks, not unattended control of every app.

## Verification findings

An input receipt can precede visible movement. Scroll verification now requires at least two unique readable body-text anchors to move together by at least 2.5% of the frame. A clock update, changing caption or video playback cannot pass. Full-feed replacement without shared text needs separate visual review and remains an automatic failure. The historical seventh suite's Instagram and YouTube replacements were visually checked against the saved original frames; the stricter eighth suite keeps its automatic 15/20 score.

The raw pointer probe moved Instagram, YouTube and X content in about 0.72–0.74 s of input time using a slow final release. The general controller now exposes that gesture as `scroll`, behind the existing app/snapshot admission checks, with no second-gesture fallback after uncertain delivery. The next full run verified Instagram and YouTube movement. X still could not reach its strict AX precondition; the focused raw probe does not count as a passing general X task.

TikTok's real feed is visible in the failed recording, but the same creator, caption and engagement controls remain after input. That is a real failed scroll, not just an OCR miss. Loading/error overlays are now explicit visual blockers; a splash or navigation bar alone does not prove the feed is ready.

A controlled file opened successfully and displayed the expected phrase. A self-only text matched Contacts My Card and showed Delivered. Those manually directed recordings include agent deliberation and cannot be compared to unattended microtask timing. Sending the controlled file did not finish: the Messages share composer exposes no usable fields through the host app AX tree. Explicitly targeting its system view service did not fix the physical read, so that native experiment was reverted. AXe reported the same local share-sheet coordinates; it is not a verified workaround.

The transition changes passed six focused phone attempts in `2026-11-12T06-24-15-805Z-general` across Contacts, Files and Books. Those warm app states did not reproduce every earlier failing state. The regression checks reproduce the empty-tree and moved-target refusals directly. The subsequent full suite passed those three task intents and finished 17/20. App state differences still prevent attributing the whole score change to one fix.

The agent then verified X opening and scrolling through fresh screenshots while AX remained unavailable. JEV selected the permitted X swipe. These assisted tasks took 18.7 and 29.7 seconds, including agent deliberation, and remain separate from the automated score. TikTok stayed on the same video after two inspected swipes, so its assisted attempt also failed. The auto-download banner was not accepted.

## Mirroring baseline

Restarting the computer-control client restored Mac clicks. Twenty ordinary Mirroring attempts are now recorded in two sessions: `2026-11-12T06-48-52-248Z-mirroring-general` and `2026-11-12T07-01-06-649Z-mirroring-general`. The user requested an app-opening showcase between those segments. The [combined numeric record](../benchmarks/runs/2026-11-12-mirroring-twenty/results.json) retains all twenty attempts, fourteen verified results and six failures.

Mirroring could not verify exact text in two clipped fields, dropped the accented character in São Paulo, and failed three feed-movement checks. The X opening result was checked against its saved frame after OCR missed the header. Failed attempts and recovery time remain included in their own records. Ratios use only pairs verified on both paths.

Mirroring timing includes the outer agent's screenshots, OCR, decisions and recovery. ClickFast uses bounded local JEV and exact caller-provided primitives. Both begin from Home, but app state and gesture paths differ. The comparison establishes a faster workflow for those successful pairs, not a driver-only result, human comparison, all-app guarantee or market ranking. The phone's media volume and Mac output were muted. The two transports ran separately.

## Measured operation experiments

- Foreground-only checks: 16/16 app-open/Home trials verified the same foreground predicate. Median cycle time was 1.122 s with `observe:false`, versus 1.687 s with AX. This does not measure content readiness. [Record](../benchmarks/runs/2026-11-12T06-59-39-471Z-app-switch/results.json).
- Activation: 16/16 trials passed. Native activation/Home median was 1.103 s; CoreDevice was 1.076 s. Native activation was very fast once warm but had 1.27–1.44 s first-use outliers. CoreDevice remains the default. [Record](../benchmarks/runs/2026-11-12T07-12-27-274Z-activation/results.json).
- AXe input: the real device returned `deviceOperationFailed` because it does not advertise `com.apple.coredevice.hid.indigo`. No successful input or speed claim follows from that probe. [Record](../benchmarks/runs/2026-11-12T07-12-00-030Z-axe-input-probe/results.json).

The showcase ended at the user's request. It opened 50 apps with verified foreground/Home transitions out of 52 attempted; it did not complete every installed app. Matching demo processes were terminated through CoreDevice, and none of the 58 recorded process IDs remained afterward. This was process termination, not a verified swipe of every switcher card. The device connection then recovered after a runner restart. Host logs show device/tunnel disconnection; they do not establish that memory pressure caused it.

## Reproduce

```sh
node --test test/*.test.mjs
node scripts/benchmark-general.mjs benchmarks/fixtures/general-v11.json 1 hybrid
python3 scripts/export-general.py SESSION --output ../clickfast-general-benchmark/SESSION
```

The current host suite passes 98 checks; the native guard suite passes 264. The signed runner advertises `preciseScroll` and responded on the physical phone before the latest run. A startup attempt timed out enabling automation mode; a subsequent launch recovered without another user unlock. These checks do not certify all iPhone models. See [hardware coverage](compatibility.md) and the [latency research](latency-research.md).

## Focused checks after the latest full run

Books passed two recorded retests in `2026-11-12T07-28-32-772Z-general` (2.262 s and 1.478 s). A new regression test reproduces the exact changed-target refusal; the recovery observes fresh refs and asks JEV to choose again once. The physical retests did not reproduce that refusal, so they do not by themselves prove the recovery caused the passes. Unknown delivery and repeated refusals still stop.

Both TikTok retests stopped before scrolling because the visual Home choice failed the unchanged 0.9 JEV presence gate. A separately recorded, caller-directed guarded drag on the visibly ready feed took 0.730 s of input but left the same creator, caption and counters on screen. It remains a failed scroll. These focused results do not replace the full suite's 16/20 score.

The final recorded transition check `2026-11-12T07-32-10-854Z-general` passed both folder/app round trips and Books (3/3) after empty AX observations were also excluded from absence checks. These are focused regressions, not another twenty-task score.

## Visual-mode work after the disconnect

The developer connection disappeared at 07:36 UTC after the completed phone tests. CoreDevice no longer lists an available tunnel. The user has been asked to reconnect the cable; no passcode or security setting is being changed.

An explicit local OCR/JEV mode is implemented for screens whose AX tree is unavailable. It rechecks app, geometry, readiness and target text after the decision, then uses the native guarded point/scroll path. Its host checks cover ambiguity, moving targets, low confidence, cancellation, stale worker replies and Unicode IPC. A ten-image OCR ablation and two model decisions use the original recorded phone frames; these are offline evidence and do not count as live phone successes. The physical visual-mode suite is still unrun. [Interface and limits](control-reference.md#local-visual-navigation-experimental).

The existing wireless Mirroring route briefly reconnected during a read-only check. It then reported “iPhone in Use” after owner takeover, and Mirroring was closed. No new live visual-task result follows from that connection check. Mac output mute was verified before the check. The host suite now passes 120 checks; the twenty-task physical score remains unchanged.
