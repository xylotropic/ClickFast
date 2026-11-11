# Wireless phone results

The physical iPhone completed ten Spotlight calculation/conversion tasks over **Apple iPhone Mirroring**, then completed a ten-task confirmation with one pinned controller. [Watch the ten comparisons](../benchmarks/runs/2026-11-11-wireless-phone/comparison.html), [timing table](../benchmarks/runs/2026-11-11-wireless-phone/comparison.md), [full logs](../benchmarks/runs/2026-11-11-wireless-phone/results.json).

The confirmation passed **10/10**. Median typing-to-independent-verification time was **0.921 seconds**; median navigation reset plus verification was **3.596 seconds**. Reset alone took **2.681 seconds**. The median matching-result capture finished at **0.584 seconds**; the headline timing also includes local OCR. These boundaries exclude the coding agent's reasoning/tool turns and the three-second result hold used for video.

This is a working wireless **navigation and text-input path**, with real phone recordings. It is not a complete general controller: coordinate taps and ordinary forwarded keyboard commands remain blocked or unreliable in this CUA/Mirroring session. These measurements do not establish a wired/wireless transport ratio, arbitrary-app performance, or live JEV performance.

## What was tested

| Capability | Observed result |
|---|---|
| Connect to real phone without USB | Passed on the existing Wi-Fi connection using Apple Mirroring |
| Navigate Home / Spotlight via native Mac menu commands | Passed in the confirmation suite |
| Enter complete new text in the observed Search field | Passed for all ten tasks |
| Verify exact query and numeric result on a fresh phone screenshot | Passed 10/10 with local Apple Vision OCR; result images inspected |
| Record and compare real screens | Ten full private recordings, twenty masked individual recordings and ten paired comparisons exported and decoded |
| Coordinate clicks through CUA | Refused with `noWindowsAvailable`; no tap was dispatched |
| Forwarded Return / Select All | Did not reliably affect the phone; excluded from the working route |
| Native XCTest runner over Wi-Fi | Existing pairing remained unreachable; not validated |
| No human phone operation during the ten confirmation tests | Passed |

The hotspot attempt disconnected the network. The original Wi-Fi connection was verified again before using Mirroring. Network settings were not changed further. Discovery found no `_remoted._tcp` or `_apple-mobdev2._tcp` advertisements, and CoreDevice reported its tunnel unavailable. Those observations do not establish the underlying network cause.

Apple documents that paired Xcode devices can run wirelessly on a suitable shared network: [wireless device guide](https://help.apple.com/xcode/mac/current/en.lproj/dev3e2f4ee6d.html). Mirroring uses Apple's separate wireless phone-control feature: [Apple's Mirroring guide](https://support.apple.com/en-us/120421). The two paths were kept separate during testing.

## Lightweight implementation

The wireless fallback reuses the installed Mirroring app and the authorized CUA App handle. There is no new phone app or phone-side daemon. The benchmark helper uses only CUA for UI observation/actions. A small compiled Apple Vision helper processes already captured image files locally; no screenshot is sent to JEV or another external image service.

Build the offline verifier:

```sh
swiftc -O scripts/mirror-ocr.swift -o .state/mirror-ocr
```

In an authorized CUA session, obtain the Mirroring App handle, verify the live Search field and mute state, then import `scripts/mirroring-benchmark.mjs` and call `createSession({app, directory, ocrBinary, initialQuery})`. Its ten inputs are benchmark fixtures; the UI interaction uses freshly observed native menu commands and screenshots. This helper is not a replacement for a general app controller. Existing native `sprint_*` MCP tools continue to use the separate XCTest path.

Raw frame timestamps identify capture request/completion bounds, not the exact instant the iPhone rendered a frame. Sampling ran at roughly 2–3 fps. Videos resample those real frames to 25 fps; they do not invent intermediate phone UI. Public videos retain only the result card and query bar. Original images, their hashes, full recordings and OCR reads stay in ignored private storage.

## Failures are evidence

Earlier development attempts are retained. A forwarded Select All failed, which appended text and produced **822 instead of 15**; the result check correctly rejected it. Five setup attempts stopped before input because reset/selection verification failed. Native menu navigation replaced unreliable key forwarding, and setup checks were corrected for OCR artifacts caused by selection handles. The final pinned controller then completed ten consecutive tasks without those failures. One small confirmation suite is not a general reliability estimate.

Audio output was explicitly muted before control and during cleanup, and all videos have no audio track. Cleanup observed that the output mute state had changed during the session; its cause was not established. Continuous mute was not independently monitored. Mirroring was quit before the Mac's prior unmuted state was restored.

## Wired comparison at home

Use the same ten queries, expected values and tolerances in [the paired task specification](../benchmarks/phone-search-task-spec.json). Keep warm input/verification, navigation reset and recording hold separate. Verify the actual USB link and mute state before starting. Preserve errors and original recordings.

A useful next comparison is the complete task through native XCTest versus Mirroring. That measures two complete control paths, including their different observation costs. To claim a transport-only USB/Wi-Fi ratio, the same native backend and verification method must work on both links. No wired confirmation was run during this cable-free session.

The largest observed saving to pursue is the 2.68-second reset. Faster focus/clear handling and a persistent OCR worker are concrete candidates. They need another measured run before any speedup is claimed.
