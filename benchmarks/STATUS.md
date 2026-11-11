# Measurement status

The signed MIT runner is installed and serves authenticated requests over USB on a physical iPhone 16 Pro Max, iOS 26.5. Its Sprint protocol is 1. The modified runner builds successfully with Xcode 26.5. The vendored host-side suite passed 240 checks; the current Node suite result is in `node-tests.txt`.

## Valid narrow measurements

`transport.json` contains 20 signed health requests and 20 signed lock-state requests. Median durations were 2.94 ms and 3.06 ms respectively. These measure inline device transport, not app control, model latency, or completed tasks.

## Invalidated task attempts

`direct.json` is an aborted preflight with zero app trials: the locked-device guard stopped it before app input. Earlier informal app-observation attempts were invalidated because mirroring was simultaneously connected. Neither establishes a completed-task speedup.

`mirroring-attempts.json` records search/activation attempts, including coordinate-click errors and ineffective keyboard activation. The XCTest runner was still resident, so these are troubleshooting evidence, not a clean isolated baseline. No app-opening task completed successfully in these attempts.

The important finding was a surface mismatch: accessibility reported Calculator, while a native screenshot showed the physical lock screen with the mirroring-use notice. The controller now refuses direct control while the Mac Mirroring process is running. A private diagnostic screenshot is intentionally excluded from Git.

`preflight-launch-window.json` records connection resets while the rebuilt runner was still waiting to launch. Xcode independently reported that physical unlock was required. These are availability failures during setup, not targeting measurements. Setup now leaves an existing runner running if a requested restart finds the phone locked.

## Remaining acceptance work

- Run fresh isolated direct-device benchmarks with the physical phone unlocked.
- Stop the native runner and complete an isolated mirroring baseline. Exclude transport-switching/authentication pauses from warm task timing and disclose them separately.
- Complete the required TikTok and Instagram Reel publishing tests with the user's chosen video, accounts and visibility. These tests have not been performed; no post has been created.
- Record total time, correctness, model/tool turns, processing/upload waits, wrong targets, failures, recovery and duplicates.
- Optimize from those measurements. No universal or completed-task speedup claim is supported yet.
