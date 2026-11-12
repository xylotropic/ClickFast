# General control: current work

ClickFast does not yet have a verified speed advantage for general phone tasks. The older Mirroring comparison covers mostly Calculator and a few navigation tasks. It does not establish general control.

## Recorded phone results

The physical run `2026-11-12T04-20-02-130Z-general` completed 24 attempts across 12 tasks. The hybrid controller passed 9/12; JEV-only passed 10/12. Those tasks include folders, several search fields, and Shortcuts tabs. Most app launches were outside the task timer. There is no matched Mirroring run for these tasks.

The Home-to-result run `2026-11-12T04-32-14-593Z-general` exposed additional failures. Three of its 16 completed attempts passed before the run was stopped. A YouTube accessibility request blocked the native input queue. The runner retried the read at several depths, each capable of waiting 60 seconds. Later attempts could not capture or control the phone. The incomplete run and its failures are retained.

## Changes awaiting the next phone run

- Use CoreDevice to launch an explicitly named app. A real X launch took about 0.1 seconds through this path after the XCTest launch path timed out. The controller still checks the foreground app. A failed launch is never replayed automatically.
- Enter a caller-supplied string directly when one native, empty, nonsecure field matches the destination and completion predicate. Native app, snapshot, identity and focus checks remain in force.
- Re-observe and ask JEV again after one native stale-snapshot refusal that explicitly confirms no input was sent. Unknown delivery still stops immediately.
- Ask for a fresh accessibility observation when a newly opened app initially exposes only a pixel frame. If accessibility remains unavailable, return a screenshot for the caller to inspect.
- Request a two-second native AX timeout and stop depth retries after a timeout or missing-server error. The timeout control exists in the installed XCTest framework and the signed build succeeds. Its effect on the physical stall still needs verification.
- Capture the result before cleanup, including that screenshot in elapsed task time. Recording stops on lock. Cleanup clears only a known benchmark string in a unique field.

The JEV probability gates remain at 0.9. `direct_text:false` and `direct_launch:false` require JEV choices for those operations. The app launch command uses Xcode's existing `devicectl`; no package or service was added.

The current branch passes 72 host checks and 264 native guard checks. These checks are not physical speed measurements.

## Next run

```sh
node scripts/benchmark-general.mjs benchmarks/fixtures/general-v4.json 1 hybrid
```

The manifest contains 20 distinct tasks, starting at Home. It includes app and folder navigation, varied text, TikTok, Instagram, X, YouTube, and scrolling. App launch, navigation, decisions and independent result checks are inside the timer. Scrolling also requires changed visible content; an input acknowledgment alone does not pass.

After these work, add opening a known test file and sending a test message and file to the verified self contact. Then run the same tasks through ordinary iPhone Mirroring. The native runner and Mirroring must run separately. Keep setup, failures, recoveries and recording costs in the report. Do not describe the result as a human or market-wide speed comparison.

The updated signed runner is installed. Its first relaunch failed before the server started. Restarting the stalled Mac CoreDeviceService restored developer-service access: a fresh lock-state read succeeded, and Xcode reached the physical-unlock preflight. The current launch is waiting for that unlock. No recording runs during passcode entry.

Mirroring connected after the phone was locked. The recorded baseline session `2026-11-12T05-04-53-190Z-mirroring-general` has no completed tasks. CUA coordinate taps failed with `noWindowsAvailable` despite a live screenshot and a standard window in the accessibility tree. Raising the window and resizing it did not resolve the failure. Mac menu actions worked; Return did not open the observed Spotlight result. These attempts cannot supply a speed baseline. Mirroring was returned to Home, restored to its original size, and closed before the native relaunch.

The baseline recorder now distinguishes an input error from a later screenshot error. A failed capture keeps the submitted action's receipt and blocks further input until a new screen has been captured and inspected. The regression test reproduces the earlier duplicate event and verifies that it cannot be reported as a successful task.
