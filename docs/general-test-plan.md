# Recorded comparison

Run the same tasks on the same physical phone through ClickFast and ordinary iPhone Mirroring. Neither host checks nor repeated Calculator cases count toward the requested 20 distinct tasks.

## Tasks

The first manifest is `benchmarks/fixtures/general-v4.json`:

| Task | Required result |
| --- | --- |
| Productivity folder → Clock → Home | Clock opened; folder closed afterward |
| Media folder → YouTube → Home | YouTube opened; folder closed afterward |
| Contacts search | Exact multiword query visible |
| Shortcuts Library → Gallery | Gallery navigation bar visible |
| Calendar search | Exact date, time and punctuation visible |
| Files Find | Exact filename query visible |
| App Store search | Exact multiword query visible; nothing downloaded |
| Reminders search | Exact punctuation and ampersand visible |
| Weather search | Exact accented city name visible; no city added |
| Books search | Exact book title visible |
| Settings search | Exact setting query visible; no setting changed |
| YouTube search | Exact multiword query visible |
| Open TikTok | Correct app and interactive controls visible |
| Scroll TikTok | Visible content changed after the actual swipe |
| Open Instagram | Correct app and interactive controls visible |
| Scroll Instagram | Visible content changed after the actual swipe |
| Open X | Correct app and interactive controls visible |
| Scroll X | Visible content changed after the actual swipe |
| Open YouTube | Correct app and interactive controls visible |
| Scroll YouTube | Visible content changed after the actual swipe |

These do not replace the requested file and messaging trials. Also complete:

- Open the generated `ClickFast Test.txt` in Files and read back `orbit maple 4827`.
- Send a uniquely identified test message to the self contact, then verify delivery in that conversation.
- Send the generated file to the same self contact, open the received attachment, and verify the filename and phrase.

Confirm the self contact against the phone's own contact information before sending. Use no other recipient. The generated file is currently on the Mac; phone visibility is unverified. Mac System Settings reports iCloud Storage Full, so do not assume that the file synced. Transfer it through an available local route if necessary. No existing file was overwritten.

## Measurement

Start the timer on Home. Include app opening, navigation, JEV decisions, input, recovery, independent result checks and the result screenshot. Record setup and cleanup separately. Match each app's initial view and empty-field state across both paths. Live feeds can differ; preserve the content and network differences in the evidence.

A bundle identifier alone cannot pass an app-opening task while its UI is blank. A swipe acknowledgment alone cannot pass a scrolling task. Compare the visible content immediately before the swipe with a fresh observation afterward. Check exact characters for text, including accents and punctuation.

Record every attempt. Keep failures, missing recordings, handbacks and uncertain input outcomes in the denominator. Never replay unknown delivery. Cleanup may remove only known test text in a unique field, and must verify the clear.

Mute before control. Capture the full phone image without added bars, masks or regenerated UI. Preserve frame request/completion timestamps and original source hashes. Local recordings may contain the user's screen; they are not published to GitHub.

The Mirroring recorder is `scripts/mirroring-general.mjs`. Import it only inside the authorized CUA runtime and supply its real App handle. It cannot control the UI from a shell. Begin timing after Home is verified, and verify each outcome from fresh screenshots. After unknown delivery, further input stays blocked until the caller captures and inspects a fresh screen.

Only make a speed claim for matched, verified pairs with the same timing boundary. Report total wall time, pass rate, recovery count, model calls and recording overhead. A faster failed attempt is a failure. These trials do not establish human or market-wide superiority.

Build the cinematic comparison only after the task results support its claims. Keep the complete recordings and measurements available alongside any edited film.
