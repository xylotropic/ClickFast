# Measurement status

The signed MIT runner is installed and serves authenticated requests over USB on a physical iPhone 16 Pro Max, iOS 26.5. Its Sprint protocol is 1. The modified runner builds successfully with Xcode 26.5. The vendored host-side suite passed 240 checks; the current Node suite result is in `node-tests.txt`.

## Valid narrow measurements

`transport.json` contains 20 signed health requests and 20 signed lock-state requests. Median durations were 2.94 ms and 3.06 ms respectively. These measure inline device transport, not app control, model latency, or completed tasks.

`resources.json` records one Mac arm64 sample: three tools, 1,894 schema bytes, zero npm dependencies, 55.4 MiB idle MCP RSS and 1.84 MiB relay RSS. The Xcode process waiting for unlock used 187.4 MiB; it is part of setup/runtime overhead and must not be hidden. The local signed test app was 24.24 MiB including Apple test support. These are single samples, not peak memory or sustained CPU measurements; phone-process memory is unmeasured.

## Invalidated task attempts

`direct.json` is an aborted preflight with zero app trials: the locked-device guard stopped it before app input. Earlier informal app-observation attempts were invalidated because mirroring was simultaneously connected. Neither establishes a completed-task speedup.

`mirroring-attempts.json` records search/activation attempts, including coordinate-click errors and ineffective keyboard activation. The XCTest runner was still resident, so these are troubleshooting evidence, not a clean isolated baseline. No app-opening task completed successfully in these attempts.

The important finding was a surface mismatch: accessibility reported Calculator, while a native screenshot showed the physical lock screen with the mirroring-use notice. The controller now refuses direct control while the Mac Mirroring process is running. A private diagnostic screenshot is intentionally excluded from Git.

## Isolated Mirroring findings

`mirroring-isolated.json` records three completed exploratory tasks with XCTest stopped: two Calculator opens and one Clock open. Each needed recovery. Wall time to a visibly verified result was 13.287 s, 13.858 s and 19.659 s respectively; those boundaries include agent/tool turns, screenshots and diagnosis. They are not comparable to direct driver-only timings.

Coordinate clicks still failed with `noWindowsAvailable` in isolation. Keyboard activation worked. Two attempts lost search characters when entry immediately followed opening Spotlight or selecting all; separating focus/selection checks repaired the text. Command-1 could return to Spotlight, so a shortcut alone was insufficient proof of Home. These are useful compatibility findings, not a universal speed or reliability estimate.

`preflight-launch-window.json` records connection resets while the rebuilt runner was still waiting to launch. Xcode independently reported that physical unlock was required. These are availability failures during setup, not targeting measurements. Setup now leaves an existing runner running if a requested restart finds the phone locked.

## Remaining acceptance work

`acceptance.json` explicitly tracks required tests that have not run. Installed app versions were checked: TikTok 47.6.0 and Instagram 454.1.0. Installation/version checks do not establish that either publishing flow works.

- Run fresh isolated direct-device benchmarks with the physical phone unlocked.
- Extend the isolated mirroring comparison with equivalent end-to-end boundaries for the direct controller. Resolve the CUA coordinate limitation if mirroring publication tests need it. Exclude transport-switching/authentication pauses from warm task timing and disclose them separately.
- Complete the required TikTok and Instagram Reel publishing tests with the user's chosen video, accounts and visibility. These tests have not been performed; no post has been created.
- Record total time, correctness, model/tool turns, processing/upload waits, wrong targets, failures, recovery and duplicates.
- Optimize from those measurements. No universal or completed-task speedup claim is supported yet.
