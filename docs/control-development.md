# General phone control

ClickFast has no verified speed advantage over Mirroring for general phone tasks yet. The earlier Calculator comparison does not establish one.

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

All attempts remain in `benchmarks/runs/`. Original phone frames and JEV traces stay in ignored `benchmarks/private/`; they can contain private screen content and must not be published. Local playback exports preserve the entire captured phone frame and measured wall time. They add no bars, overlays, fabricated UI or speed changes. Native black areas remain visible. A missing task timing remains incomplete even when the available failure footage can be exported.

## Controller changes

- CoreDevice launches an explicitly named app; launch, foreground checks and result verification stay inside task time.
- An exact supplied literal can enter one observed empty nonsecure field directly. Native app, snapshot, identity and focus checks remain in force.
- A successful input followed by an unavailable AX read retains its delivery receipt and obtains a fresh pixel context. It does not repeat the input. Unknown delivery still stops.
- One explicitly unsent stale-snapshot or moved-target refusal can re-observe and ask JEV again. Unknown delivery and unrelated refusals still stop.
- Loading screens and empty transition trees are re-observed before selecting another navigation action. An empty tree cannot prove that a control disappeared. A field transition waits for the requested field rather than treating an unrelated clock update as progress.
- Back controls retain their native back meaning when their visible label names the destination. Empty unlabeled containers are excluded from model choices. Search prerequisites are expressed as the next navigation step; JEV still chooses the control at the same 0.9 gates.
- Native AX reads request a two-second timeout and do not retry at several depths after a timeout or missing server. The subsequent suites completed without the earlier sixty-second queue stall.

The hybrid benchmark admits caller-supplied app names, exact text and swipe primitives directly. JEV chooses navigation controls. A known swipe is not a JEV decision, and benchmark plans are not saved product routines. These results measure bounded tasks, not unattended control of every app.

## Verification findings

The X recording shows that an input receipt can precede visible movement. Scroll verification now waits for changed readable body content without repeating input. A 300 ms X gesture passed three focused recorded runs, but then failed in a broader suite. That is not sufficient evidence to change the product default. The next probe uses the visible feed gutter and checks an actual X control before input.

TikTok can take more than three seconds to render after launch. Its next visual deadline is eight seconds, all included in elapsed time. A splash logo alone does not pass. YouTube can hide its bottom bar while scrolling; its feed check now uses its visible header and readable content, followed by required body movement.

A controlled file opened successfully and displayed the expected phrase. A self-only text matched Contacts My Card and showed Delivered. Those manually directed recordings include agent deliberation and cannot be compared to unattended microtask timing. Sending the controlled file did not finish: the Messages share composer exposes no usable fields through the host app AX tree. Explicitly targeting its system view service did not fix the physical read, so that native experiment was reverted. AXe reported the same local share-sheet coordinates; it is not a verified workaround.

The transition changes passed six focused phone attempts in `2026-11-12T06-24-15-805Z-general` across Contacts, Files and Books. Those warm app states did not reproduce every earlier failing state. The regression checks reproduce the empty-tree and moved-target refusals directly. The subsequent full suite passed those three task intents and finished 17/20. App state differences still prevent attributing the whole score change to one fix.

The agent then verified X opening and scrolling through fresh screenshots while AX remained unavailable. JEV selected the permitted X swipe. These assisted tasks took 18.7 and 29.7 seconds, including agent deliberation, and remain separate from the automated score. TikTok stayed on the same video after two inspected swipes, so its assisted attempt also failed. The auto-download banner was not accepted.

## Mirroring baseline

The real Mirroring session `2026-11-12T05-04-53-190Z-mirroring-general` completed zero tasks. Coordinate clicks fail with `noWindowsAvailable` across both Mirroring and System Settings, despite live screenshots and valid AX windows. Raising and resizing the window, reacquiring app handles and resetting the CUA runtime did not fix the failure. The user confirmed that the Mac is awake and unlocked; IOKit also reported it unlocked. Existing Codex Computer Use Accessibility and Screen & System Audio Recording permissions were verified on without changing them.

A fresh Mac computer-control connection is required before running the same twenty tasks through ordinary Mirroring. Native API calls must not stand in for that baseline. The phone stays at media volume zero. Mirroring and the native runner run separately; the Mac is muted during Mirroring and its prior sound state is restored afterward.

The Mirroring recorder preserves an input receipt when a later screenshot fails. It requires a new inspected observation before further input; it never treats the capture failure as permission to replay the action.

## Reproduce

```sh
node --test test/*.test.mjs
node scripts/benchmark-general.mjs benchmarks/fixtures/general-v9.json 1 hybrid
python3 scripts/export-general.py SESSION --output ../clickfast-general-benchmark/SESSION
```

The branch passes 89 host checks. The unchanged native guard suite has 264 checks; the temporary view-service experiment passed two additional host checks but failed its physical test and was reverted. A signed build of the restored runner is installed and responding. Main remains unchanged; development work stays in the draft pull request.
