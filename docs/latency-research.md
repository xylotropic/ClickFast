# Making general iPhone control faster

Research checked November 12, 2026. Source audit: ClickFast `d78888209a1ce66629986d5d070768c3bcb515e9`; AXe `d8ddf406d391882943e27211562ae57012ad2f7d`. This is a research and experiment plan, not a claim that every approach below has been implemented or tested.

The strongest current direction is to keep the signed native runner, do less work for each verified transition, and add a visual path where accessibility fails. Replacing the entire stack before measuring those costs would discard working code without evidence of a faster replacement. Apple Mirroring remains an important comparison and wireless fallback. No evidence establishes an absolute fastest backend across every app, and no control backend can remove a third-party server delay or an authentication requirement.

## Measurements after the source audit

The twenty-task Mirroring baseline is now complete: fourteen verified results. The next full ClickFast run verified sixteen, including real Instagram and YouTube movement with the new guarded slow-release `scroll` operation. Across twelve successful matched intents, median task time was 2.040 s for ClickFast versus 16.547 s for Mirroring. Different app state and decision paths prevent interpreting that as a pure transport ratio. [Recorded outcomes](../benchmarks/runs/2026-11-12-general-v10-vs-mirroring/comparison.md).

Three proposed experiments now have physical results:

- Foreground-only app checks verified 16/16 cycles. Median was 1.122 s without the full AX tree versus 1.687 s with it. The opt-in is `observe:false` on `launch`/`home`; selector and absence checks still require AX. [Record](../benchmarks/runs/2026-11-12T06-59-39-471Z-app-switch/results.json).
- Native activation versus CoreDevice verified 16/16 cycles. Medians were 1.103 s and 1.076 s respectively. Warm native activation was promising, but first-use outliers prevent selecting it as the universal default. CoreDevice stays. [Record](../benchmarks/runs/2026-11-12T07-12-27-274Z-activation/results.json).
- AXe's real-device HID probe failed with a typed missing-Indigo-service error. It is not an available faster input path on this configuration. [Record](../benchmarks/runs/2026-11-12T07-12-00-030Z-axe-input-probe/results.json).

A separate raw pointer probe established coherent text movement in Instagram, YouTube and X with a 470 ms drag that slows before release. The guarded controller operation subsequently passed Instagram and YouTube in the full task suite. TikTok remained unchanged; X's strict AX readiness still failed before the gesture. This separates a successful low-level input experiment from a working general task. [Probe](../benchmarks/runs/2026-11-12T07-18-54-077Z-precise-scroll/results.json).

## What was established at the audited revision

The last completed twenty-intent native suite at the audited revision verified 17/20 tasks. The suite includes app launches, folders, search text, navigation and feed movement. TikTok scrolling and two X accessibility-readiness checks failed. These are bounded intents, not a test of all functionality in those apps. The later app-opening demonstration is a different smoke test; foreground identity is not proof that an app finished loading or that a task inside it succeeded. See [development results](control-development.md) and the numeric [twenty-task record](../benchmarks/runs/2026-11-12T06-25-53-384Z-general/results.json).

Current implementation already has a persistent HTTP runner, keep-alive connections, reduced AX attributes, quiescence bypasses, native bound-field text, independent screenshot capture, bounded JEV decisions and delivery receipts. Reimplementing those features under a new name would not produce an additional speed gain. See [host controller](../src/driver.mjs), [chooser](../src/jev.mjs), [runner](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerTests.swift), [bridge](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/IPURBridge.m) and [HTTP lanes](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerHTTP.swift).

## Measure the whole path

For each intent, record these intervals separately with a monotonic clock:

| Interval | Start and end | Likely improvements |
| --- | --- | --- |
| Agent overhead | Request accepted to local intent admitted | Fewer host turns; one bounded local delegation |
| Preflight | Lock/audio/mode checks | Persistent session with cheap checks; retain checks at input admission |
| Observation | Read requested to usable AX or image | Foreground-only reads, fewer attributes, fresh frame buffer |
| Decision | Exact request sent to validated answer | Atomic JEV questions, same-state fan-out, smaller state |
| Dispatch | Native command admitted to delivery receipt | Persistent input lease, fewer event submissions |
| App response | Delivery to required UI change | Predicate-specific readiness; cannot assume dispatch means completion |
| Verification | Relevant result visible to checked result | Field readback, targeted OCR, one independent final check |
| Recording overhead | Capture/encode/disk costs and contention | Separate lane, latest-frame policy, hardware encoding |
| Recovery | Failure detected to verified resumption | Typed delivery status; observe before any new action |

A task's wall time includes every interval on its critical path, including recoveries. Parallel stages overlap; adding their durations would overcount total time. Log both request and completion times for each capture. A screenshot's receive time is not its phone presentation time. Keep setup, cleanup and any final video hold separately visible.

The older narrow JEV run in [the earlier research](jev-general-control-research.md) had a median chooser call around 87 ms and delivered-action records around 365 ms. Those are that run's instrumented numbers, not current service guarantees or a clean driver floor. They illustrate why optimizing inference alone can leave most delay intact. In a hypothetical 1,000 ms task with only 100 ms spent deciding, deleting all inference would reduce the total to 900 ms, not to 100 ms.

## First: stop traversing AX for app-only checks

`Controller.wait` at the audited revision requested `observe()` even when the predicate was only `{app: bundle}`. The measured opt-in above now avoids that traversal for an exact foreground-only predicate. That is unnecessary for the narrow question “Which app is in front?” An app-only launch or Home wait can use `/sprint/frame`; a selector or absence predicate still needs a complete, fresh enough AX read or an explicit visual verifier. The next action that needs an element must obtain fresh element refs. This is a general operation-level optimization, not a saved app routine.

There are two important qualifications in the current implementation:

- `/sprint/frame` avoids the full tree but still resolves foreground through active AX applications, sometimes a hit-test and view-service state checks, then reads screen dimensions. It is not a zero-cost or entirely AX-independent API.
- `/sprint/frame` creates a new snapshot and clears native element IDs. A background frame-context poll can invalidate refs for a concurrent action. Use it sequentially today. A future telemetry endpoint should return context without altering the action snapshot.

Measure the old and new wait with identical native commands and the same final evidence. Reject the change if it can report a selector or absence from an empty pixel observation. A foreground bundle may already match while a launch animation, splash, sign-in sheet or network loader remains visible. Tasks that require usable content must verify that content too.

## Launch paths worth comparing

There are three real-device candidates: the current CoreDevice launch, the existing on-phone `/launch` activation and AXe's physical input/launch machinery. Use the same app set, start state and result verifier for all three. The host CoreDevice path launches a new `xcrun` process per app; a resident path might remove host process startup, but may pay more test-service waiting. Only measurement decides the winner.

Apple distinguishes `activate()` from `launch()`: activation preserves an already running instance, whereas `launch()` terminates an existing instance to start cleanly. Use activation for ordinary control; force relaunch changes user state and creates an unfair warm/cold comparison. Apple's normal activation returns when the app can handle events, but ClickFast deliberately bypasses some waiting, so its own postcondition remains necessary. [Apple activation](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/activate()), [Apple launch](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/launch()), [application state](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/state-swift.property)

The on-phone implementation already wraps `XCUIApplication.activate()` in `performWithoutQuiescence`. Compare it directly instead of implementing a second private launcher first. Keep CoreDevice as a fallback if activation is slower or less reliable. See [current native activation](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerWDA.swift).

## Reduce AX cost without losing the target

Appium documents explicit tradeoffs among idle waits, tree depth, child counts and first-match lookup. Lower depth or fewer children can speed snapshots but omit real controls. A first match can be faster but is unsuitable when the task requires a unique match and duplicate labels exist. Its default idle timeout is ten seconds; zero disables idling checks and is discouraged by Appium. These are comparison points, not settings to copy blindly into ClickFast. [Appium settings](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/reference/settings.md)

Useful experiments:

1. Read only foreground context for app-only checks.
2. Request only the attributes used by the current predicate, if the private API supports the combination on the installed OS.
3. Search a known visible subtree before requesting the complete tree; fall back on a miss.
4. Separate navigation controls from long reading text, while preserving values and nearby labels needed to distinguish fields.
5. Probe the current target at its center before input instead of rereading unrelated descendants, provided target identity and overlay checks remain intact.
6. Bound failed AX reads and switch to visual observation once; do not try several depths after a missing server or timeout.

Private APIs are version-dependent. A reported read timeout does not necessarily cancel work already queued in Apple's service. Starting more reads can worsen queue pressure. Invalidate old refs after uncertain reads, and measure p95/p99 as well as the median.

## Input: batch what is already known

A fast general controller can receive a fresh sequence such as “focus this observed empty field; enter this exact literal; wait for that value” in one local call. The sequence is generated for the present task. It need not be a saved routine.

The useful boundary is causality. Multiple low-level events for one validated gesture or a field's exact text can be submitted together. A tap that navigates to a new page does not authorize blindly tapping a guessed control on the next page. Between dependent pages, reacquire the minimum evidence required for the next action. Keep a serial mutation lane even if independent capture and decision preparation overlap.

ClickFast's existing numeric burst demonstrates this principle only for observed keypad keys. Do not generalize that result to arbitrary controls, Send, permissions or destructive buttons. Likewise, calling a semantic press can avoid some touch ambiguity but does not prove the app changed. A native event receipt and a verified task result remain different facts.

## What AXe, WDA and idb can contribute

AXe's current physical backend supports taps, gestures, text, buttons, batches and native H.264 streaming. Its docs describe physical AX reads as roughly one second plus per-element cost, up to a bounded tree size; these are AXe's own published figures, not measurements on this phone. Its stateful `--agent` mode is explicitly unsupported on physical devices. Do not import simulator-only benchmarks or the autonomous simulator agent as a working real-phone controller. [AXe physical support](https://www.axe-cli.com/docs/physical-devices), [AXe agent mode](https://www.axe-cli.com/docs/agent-mode)

The pinned AXe source has a resident physical broker and explicit input leases. Its client distinguishes lost input exchanges from read failures and tries to confirm lease cleanup. That is useful architectural evidence for a persistent alternative input path. It is not proof that the alternative beats ClickFast. Prototype with one reusable broker session and matched gestures; include broker startup separately. [Physical input](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/PhysicalDeviceInput.swift), [broker client](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/PhysicalDeviceBrokerClient.swift)

WebDriverAgent is also an XCTest REST server; adding the full Appium orchestration layer is not intrinsically a faster input backend. Appium documents running prebuilt WDA independently and routing real-device traffic through a USB proxy. Reusing a working runner is a valid lightweight design. [Appium's WDA management guide](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/guides/wda-custom-server.md)

Meta idb offers device/simulator automation, but individual command support must be checked for physical targets. Its shared origins with simulator frameworks do not make simulator HID injection a physical-phone capability. Treat idb as another measured candidate, not a reason to add a second daemon by default. [Meta idb source](https://github.com/meta/idb)

## Capture: prefer the newest usable frame

Repeatedly asking for a screenshot, encoding it, sending it, starting OCR and waiting for a model creates serial delay. A persistent capture producer can maintain a single latest usable frame. Consumers take a frame newer than the last relevant input or explicitly wait for a later observation. Old frames are dropped rather than queued for the controller. The archival recorder can preserve selected frames independently.

Apple's ScreenCaptureKit supports streamed frames, frame status and display timestamps. `complete` means a new frame was generated; `idle`, `blank` and `suspended` have different meanings. The display timestamp refers to the Mac WindowServer's presentation, not necessarily the original iPhone's presentation. [Frame statuses](https://developer.apple.com/documentation/screencapturekit/scframestatus), [display time](https://developer.apple.com/documentation/screencapturekit/scstreamframeinfo/displaytime)

Apple documents queue depth starting at three and warns against exceeding eight. Its WWDC explanation identifies the latency cost of retaining old surfaces: processing must keep up, or consumers should release/drop frames. Increasing the queue is a throughput buffer, not a latency optimization. A latest-frame consumer should retain only what its current work needs. [Queue depth](https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/queuedepth), [Apple's capture session](https://developer.apple.com/videos/play/wwdc2022/10155/)

For a Mirroring-window implementation, ScreenCaptureKit would capture the Mac window. It does not remove Apple's upstream wireless encode/decode or input forwarding. It also is not an alternative to the authorized Computer Use tool for this session: implementing a new screenshot/input backend would be a separate product experiment. Do not replace the benchmark's existing tool path midway and still call the result ordinary Mirroring/CUA.

The native runner already has separate capture and command lanes, JPEG scaling and an H.264 implementation. Before adding another stream, measure the existing one. A one-off screenshot may still be cheaper for infrequent actions. Streams can consume CPU and contend with app rendering even when network bandwidth is plentiful. [Native stream](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerH264.swift)

VideoToolbox supports real-time encoding and disabling frame reordering. The runner already sets both appropriately; merely switching these flags again is not a new optimization. Record capture-to-decode age, not only frames per second. Thirty frames per second can still be hundreds of milliseconds behind. [Real-time property](https://developer.apple.com/documentation/videotoolbox/kvtcompressionpropertykey_realtime), [frame reordering](https://developer.apple.com/documentation/videotoolbox/kvtcompressionpropertykey_allowframereordering)

## OCR and the missing visual path

A persistent accurate Vision worker is a strong low-complexity candidate: load Vision once, accept framed image requests over a local pipe, reuse process resources, and return timestamped lines. Compare cold worker startup with warm recognition. The current helper starts a new executable for each OCR operation. Keep raw frame identities so recognition never silently applies to a later screen.

Apple exposes fast/accurate recognition and a minimum text height. Raising the minimum can speed recognition by ignoring small text; it is not a free speedup. Earlier ClickFast trials already found that fast OCR missed real labels. Use accurate OCR on a small relevant region, with a full-frame fallback when the target is absent or the layout changed. Never treat a miss in a crop as proof that the target is absent from the screen. [Text recognition](https://developer.apple.com/documentation/vision/recognizing-text-in-images), [minimum text height](https://developer.apple.com/documentation/vision/vnrecognizetextrequest/minimumtextheight)

Vision's region coordinates start at the lower left. Phone taps normally use top-left logical points, while screenshots use pixels. Preserve explicit crop, scale, orientation and window-to-phone transforms. Reject points outside the current screen. A locally placed share sheet can expose AX coordinates in a different coordinate space, as the project's earlier file-sharing experiment found. [Vision region coordinates](https://developer.apple.com/documentation/vision/vnimagebasedrequest/regionofinterest)

A useful general visual path combines visible text boxes, icon/layout recognition and a bounded chooser. OCR alone cannot identify every unlabeled button or canvas control. A small local model might avoid cloud transit, but model loading, image encoding, inference, grounding accuracy and fallback rate must all be timed. No local model is verified as a replacement here.

## Use JEV for narrow judgments

TypeSafe recommends atomic questions composed in code. It evaluates questions independently against the same state, so the second question cannot consume the first question's answer. Put control definitions and the current intent in shared state. Ask operation, target and applicability heads together when they depend on the same observed screen; ignore unused heads. This is speculative reading/decision work, not permission to send speculative phone input. [JEV introduction](https://docs.typesafe.ai/introduction), [same-state fan-out](https://docs.typesafe.ai/patterns/fan-out)

Do not ask a model to choose the exact app or supplied literal when code already has an unambiguous caller-authorized value and a verified target. Save JEV calls for actual ambiguity. Cache immutable app metadata and parsed intent structure. Do not cache a coordinate or previous decision by app name alone. A reusable decision needs an exact relevant-state signature, app/version/orientation and target revalidation; authentication, user data and content can change between identical-looking pages.

Choice always selects something, even when none of the offered options fits. Its companion Noul should ask whether the observed candidate set actually contains the needed next action. The current triple gates should remain fixed while representation is evaluated. Confidence and selected probability are related statistics, not independent confirmations. Reducing thresholds to make a failed benchmark pass would change the experiment. [Companion Noul](https://docs.typesafe.ai/patterns/companion-noul), [confidence semantics](https://docs.typesafe.ai/confidence)

For repeatable experiments, record the resolved model ID. TypeSafe's `jev-latest` alias currently points to `jev-1.14.0` and can move later. Pin a tested model for release and compare a new version on held-out screens before switching. [Models and aliases](https://docs.typesafe.ai/models)

### JEV images and Box are a new candidate, not a finished solution

Official documentation now permits PNG/JPEG inputs to Jev 1.13 and 1.14; Box localization needs 1.14. Every such request needs the images danger-zone header. The vendor explicitly labels images/Box experimental and below its production-readiness standard. Multipart avoids base64's roughly one-third size expansion. This could replace some slow outer-agent screenshot turns, but latency and accuracy on actual phone UI remain unmeasured here. Sending screenshots also discloses more than the current compact UI-label state; require an explicit image-data opt-in and exclude sensitive views. [Image API](https://docs.typesafe.ai/images)

Box always returns coordinates, including when the target is absent. Pair it with a presence/uniqueness question in the same request. Validate finite ordered normalized edges, minimum usable size, current app/orientation and image identity. Map back to current logical points and recheck that the selected region still contains the intended visible control before input. Never let a confident box authorize a payment, send or permission change. [Box contract](https://docs.typesafe.ai/primitives/box)

## USB, Wi-Fi and process overhead

`iproxy` forwards TCP ports through usbmuxd; it is not a replacement for a phone-side control service. The existing keep-alive runner already avoids a new HTTP handshake per action. Measure transport RTT and encoding size before replacing HTTP with a custom binary protocol. Smaller payloads matter mainly when serialization or transfer is a measured bottleneck. [libusbmuxd](https://github.com/libimobiledevice/libusbmuxd)

Apple supports running a paired Xcode device over a network. Native Wi-Fi and iPhone Mirroring are different control paths. Compare USB and Wi-Fi using the same native runner, intent, payload and verifier; a native-vs-Mirroring result cannot isolate transport speed. The project's earlier hotspot failure did not identify a general cause and is not evidence that all wireless native control is impossible. [Apple wireless development](https://help.apple.com/xcode/mac/current/en.lproj/dev3e2f4ee6d.html), [earlier wireless observations](wireless.md)

Mirroring itself requires a nearby locked phone, Wi-Fi/Bluetooth and a supported Mac. Its host-window capture and remote input add stages that the native path can avoid, but Apple's public guide supplies no universal latency figure or supported toggle that removes those stages. [Apple Mirroring](https://support.apple.com/en-us/120421)

## Direct app APIs can be faster, with narrower coverage

An exposed App Intent, deep link or official API can replace several UI actions with one semantic operation. That is worth using when the requested operation is supported and the result is independently checked. App Intents are functionality that app developers expose; they are not a universal arbitrary-app control API. A shortcut for one app cannot establish general coverage. Keep UI control for the rest and identify which route produced each result. [Apple App Intents](https://developer.apple.com/documentation/AppIntents), [getting started](https://developer.apple.com/documentation/appintents/getting-started-with-the-app-intents-framework)

## Ranked experiments

The order below favors large, general savings with small implementation cost. A candidate wins only after a matched physical test; the ranking is a hypothesis.

| Priority | Candidate | Matched test | Reject or stop condition |
| --- | --- | --- | --- |
| 1 | Foreground-only waits | Old/new wait, same launches and Home transitions | Any selector/absence falsely passes; stale refs reused |
| 2 | Native activation vs CoreDevice | Warm/cold launch sets, same content checks | State reset, extra prompts, worse tail latency |
| 3 | Persistent accurate OCR | Same saved public fixtures, then live checks | Lower exact-text/target accuracy or stale frame |
| 4 | Reduced duplicate observations | Instrument request counts per verified intent | Next action lacks current evidence |
| 5 | Latest-frame capture | On-demand vs stream, actual frame age | Older frames, command slowdown, thermal load |
| 6 | Smaller AX reads | Full vs target/subtree queries | Real target omitted without fallback |
| 7 | JEV same-state fan-out | Sequential heads vs one request, held-out UI | More wrong input or abstention at fixed gates |
| 8 | OCR-grounded visual chooser | AX-unavailable screens, hidden/duplicate targets | Guessed geometry or false completion |
| 9 | JEV image/Box prototype | Consented public UI, absent-target cases | Ungrounded/unstable targets or latency regression |
| 10 | Persistent AXe physical broker | Same tap/text/swipe, same result checks | Cleanup ambiguity, unsupported physical capability |
| 11 | Native transport over Wi-Fi | Same runner USB/Wi-Fi, balanced order | Disconnects, unsafe replay, unmeasured handoffs |
| 12 | Alternate serialization | Same payload/command through both codecs | Saving smaller than complexity/tail cost |
| 13 | Local visual/decision model | Warm/cold inference and full task success | Model footprint or accuracy defeats saving |
| 14 | Exposed semantic API/intent | Same requested outcome, label route explicitly | Unsupported operation or changed destination |

Other ideas worth separating from the first implementation: a non-mutating foreground telemetry endpoint; bounded action batches with per-step postconditions; incremental AX text diffing; target-specific change detection; unchanged-frame OCR reuse; app metadata caching; local intent decomposition; a persistent CoreDevice launch helper; hardware H.264 capture; recording-off performance controls; and a prewarmed fallback worker. Each needs an ablation. None justifies predicting future screens, removing lock/audio checks, replaying uncertain input, resetting the phone, disabling security, changing the user's animation settings, or treating a simulator as the phone.

## Support across iPhone models

Hardware coverage is separate from model-inference choice. The source targets iOS 15+, but only iPhone 16 Pro Max/iOS 26.5 has the current physical evidence. Xcode device support, private API availability, geometry and encoder behavior must be checked per configuration. See the sourced [iPhone compatibility matrix](compatibility.md) for candidate ranges and the physical validation plan. “All iPhones” is a design goal, not an established test result.

## Decide with results, including failures

Keep the twenty distinct general intents, add a separate long cross-app workflow, and retain all failed attempts. Use balanced order where the lock/Mirroring handoff permits it. Control app starting state, text and completion predicates; disclose unavoidable state drift. Separate warm launch, cold launch, app-only switches and task completion. Do not force-quit all apps to make a warm benchmark appear faster or change the user's state for a chart.

Report success rate first, then time for successful matched pairs, total time including failures/recovery, median, p95 and timeout counts. Include recording-on/off runs and capture request counts. With a small sample, publish the individual outcomes instead of claiming a stable tail estimate. An outer-agent Mirroring run versus a locally delegated native loop is a valid complete-workflow comparison when labeled; it does not isolate Apple's Mirroring transport.

The release choice should be the fastest verified path for each operation class, with a small fallback graph, rather than one mandatory backend for all cases. For now the evidence favors retaining the signed native runner and testing the first four changes before replacing it. General visual fallback is the major coverage gap. Performance and coverage must improve together: an instant wrong action, a fast handback or an unverified dispatch does not count as a completed task.

## Appendix: experiment designs and remaining investigations

The source investigation itself sent no phone input. Later physical probes are listed above; unimplemented designs below remain proposals.

### A. Native activation versus CoreDevice

Compare the existing signed `POST /launch {bundle}` with the current `xcrun devicectl device process launch` path. The native route calls `XCUIApplication.activate()` inside the quiescence-bypass wrapper, invalidates its request cache and resolves the PID. It does not deliberately terminate an existing app. The CoreDevice host wrapper starts a fresh process, has a five-second command deadline and a six-second host-process deadline. These deadlines are bounds, not normal execution costs. Neither source provides a universal activation latency.

The native bypass neutralizes only known void-returning quiescence methods, and passes skip-pre/skip-post interaction flags when the private selector exists. It cannot establish that every internal XCTest wait disappeared. Time the actual activation rather than inferring its cost from a patched selector. [Native activation](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerWDA.swift), [bypass implementation](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/IPURBridge.m), [CoreDevice wrapper](../src/device-launch.mjs)

Use ten installed, non-sensitive apps and balanced AB/BA order. Begin each trial on verified Home. Apply one launch, then the same sequential foreground-only wait, then the same specified visible-content check. Measure command completion, foreground confirmation, usable-content confirmation and return Home separately. Retain cold-start and warm-start results as separate cohorts. Do not repeat an uncertain launch automatically. This tests launch implementations without mixing in a changed AX verifier.

### B. AXe's physical HID broker versus XCTest Home

The pinned AXe implementation is a genuine no-WDA physical input route. Its host broker retains a RemoteXPC service directory and `com.apple.coredevice.hid.indigo` connection. Home sends `IndigoButtonEvent` down/up with an 80 ms default hold. Coordinate taps default to a 50 ms hold and read display geometry unless supplied by the owning operation. These are scheduled hold defaults, not end-to-end times. Its warm broker can reuse connections and recent readiness evidence; the source's readiness timing comments are author observations, not a guarantee for this Mac. [Physical input owner](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/PhysicalDeviceInputOwner.swift), [service directory](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/DeviceServiceDirectory.swift), [broker lifetime](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/PhysicalDeviceBrokerOwner.swift)

ClickFast touch synthesis instead submits `XCSynthesizedEventRecord` through `synthesizeWithError:` and awaits the test-service receipt. Its inherited source comments describe hold plus roughly 220 ms on an upstream iPhone 13/iOS 27 experiment. That is a mechanism to investigate, not a current-device latency measurement. Home currently uses the separate XCUIDevice button path, so touch-synthesis figures must not be assigned to Home. [Synthesis instrumentation](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/IPURBridge.m), [native button path](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerWDA.swift)

AXe's `sendEvent` does not request a per-event reply. Lease cleanup drains an HTTP/2 PING, and its source explicitly says that acknowledgement confirms consumed transport frames, **not guest input**. A faster dispatch receipt is therefore weaker evidence than a confirmed UI transition. Time both backends to the same independently observed Home result. Start with Home alone; only after that passes compare harmless visible tabs or controlled gestures. Keep recorder, phone state and verifier unchanged. Report broker cold startup separately and include lease close/cleanup in the complete operation time. [RemoteXPC event semantics](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/RemoteXPCConnection.swift)

The exact prerequisites are pairing, Developer Mode, a connected CoreDevice tunnel, a mounted developer image, an unlocked phone, an RSD service directory matching the requested hardware UDID and the advertised HID service. AXe's input readiness code does not require the screenshot service, although `doctor` adds that requirement to its full report. Thus the earlier local `screenshotServiceUnavailable` result does not by itself rule out a small HID-input test with ClickFast's existing recorder. The recorded physical probe on November 12 (`2026-11-12T07-12-00-030Z-axe-input-probe`) then refused Home in 489 ms with `deviceOperationFailed`: “The device does not advertise a supported com.apple.coredevice.hid.indigo service.” The native runner responded before and after, with SpringBoard observed both times. No successful input occurred. This is a measured refusal cost, not a Home latency or speedup. Retain the native input path; do not adopt the AXe broker for this configuration without establishing the missing endpoint. [Input readiness](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/PhysicalDeviceInputOwner.swift), [doctor checks](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Device/DeviceReadiness.swift)

AXe documents Xcode 26/27 support and validation with Xcode 26.5/iOS 26.5; its settings command requires Xcode 27. Its physical agent mode is still unsupported. Keyboard typing is a restricted physical HID layout, not a replacement for ClickFast's verified Unicode field-bound text. Do not switch all operations to HID on the strength of a Home test. [Pinned compatibility statement](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/README.md#xcode-compatibility), [physical limitations](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/docs/device-support.md)

### C. Investigate the runner interruption separately

The local test session that ended at 06:57:11 UTC on November 12 reports `com.apple.dt.CoreDeviceError` code 3, caused by `com.apple.Mercury.error` code 1001: the remote XPC connection was invalidated and its state was canceled. The saved `.xcresult` summary identifies runner PID 18912 and corroborates that communication failure. Device diagnostics collection then failed. The last successful runner request in the log is a lock-state read at 06:57:05.312 UTC. Several preceding screenshot and foreground reads became slower, but that does not identify why the connection died.

A second check of the timestamp-matched host unified log narrows the failure: MobileDevice reports `_AMMuxedDeviceDisconnected` and “BootedOS mode device disconnected” at 06:57:05.832–.833 UTC. `remoted` reports the NCM connection disconnecting at 06:57:06.104, followed by tunnel usage-assertion invalidations at 06:57:06.263. These events precede the Xcode error. They support disappearance of the device/transport connection rather than an isolated runner exit. They do **not** establish whether a cable event, a reboot, a device-service reset or another condition caused that disappearance. The checked local diagnostic-report locations contain no matching runner/testmanagerd/CoreDevice crash report. Preserve the result bundle and narrowly filtered host logs privately. Next obtain a device crash or jetsam report, or a timestamp-matched tunnel/service termination event, before attributing a cause. Do not publish the result bundle or unfiltered developer logs: they can contain device identifiers, paths and signing/environment details.

If the interruption repeats, run separate controlled cohorts with the recorder on/off and a small versus large app set. Track runner liveness, command queue age, capture latency, app count and available diagnostics. Reopening many apps can change device pressure, but calling that the cause without a termination record would be speculation. Restart only the owned runner once the device is unlocked, verify it responds, and resume from recorded outcomes rather than replaying the unfinished app cycle.


### D. Alternatives when Indigo is absent

**A semantic AX press is the smallest runner-side experiment, with unresolved support.** Appium's current SDK 26.4 private headers expose `XCAXClient_iOS.performAction:onElement:value:error:` and the corresponding remote accessibility action. Both accept an **object** action argument. This differs from old integer signatures found in archived headers. The header establishes a callable surface, not the accepted action representation, entitlement scope or latency. The existing bridge retains the underlying AX element, which could preserve target identity better than converting a label into an unguarded coordinate. Before input, resolve the current PID, verify the retained element is valid and still matches the intended visible enabled control, and obtain the supported action representation. Avoid guessed numeric actions. Test one harmless tab against synthesized touch with identical state and postcondition. Keep explicit semantic activation separate from physical tap: a custom control's accessibility action can differ from its touch behavior. Any uncertain result stops; a fallback must not repeat a possibly completed action. [Current AX client](https://github.com/appium/WebDriverAgent/blob/3d6a4e03cdd673e540289c610f7e189f8ffea434/PrivateHeaders/XCTest/XCAXClient_iOS.h), [remote action protocol](https://github.com/appium/WebDriverAgent/blob/3d6a4e03cdd673e540289c610f7e189f8ffea434/PrivateHeaders/XCTest/XCUIRemoteAccessibilityInterface-Protocol.h), [Apple's activation contract](https://developer.apple.com/documentation/objectivec/nsobject-swift.class/accessibilityactivate())

**AXAudit press is not a demonstrated general alternative.** pymobiledevice3 exposes a physical accessibility-audit DTX service and `perform_press`, but its own source limits activation to debug-entitled target processes; the maintainer clarifies `get-task-allow`. That restriction excludes assuming ordinary App Store apps work. The implementation sends without waiting for an action reply, so return from the method would not establish activation even for an allowed target. Do not change the signing or entitlements of the user's apps to make this route work. [Pinned implementation](https://github.com/doronz88/pymobiledevice3/blob/03d788d23105c1754c27cc4e6ddc1d7e23835b32/pymobiledevice3/services/accessibilityaudit.py), [maintainer's entitlement clarification](https://github.com/doronz88/pymobiledevice3/issues/405#issuecomment-1465104729)

**UniversalHID is a distinct, unverified endpoint candidate.** pymobiledevice3 also implements `com.apple.coredevice.hid.universalhidservice`, with raw touchscreen reports rather than Indigo envelopes. Its source says an active media session is needed to authenticate touch, retains that session for batches, and includes a 500 ms startup settling period based on observed device differences. It requires contact release and session cleanup. Endpoint availability here is unknown; the missing Indigo endpoint neither proves nor disproves UniversalHID. [Pinned HID implementation](https://github.com/doronz88/pymobiledevice3/blob/03d788d23105c1754c27cc4e6ddc1d7e23835b32/pymobiledevice3/remote/core_device/hid_service.py)

The current media helper explicitly rejects iOS below 27 before starting its video session. Comments say older devices may accept input without producing frames, but that does not make the current helper usable on this iOS 26.5 phone. This is a future compatibility experiment, not a drop-in fix; do not upgrade the phone or remove version guards for a benchmark. [Media version guard](https://github.com/doronz88/pymobiledevice3/blob/03d788d23105c1754c27cc4e6ddc1d7e23835b32/pymobiledevice3/remote/core_device/display_service.py)

Avoid pymobiledevice3's `--native` tunnel mode alongside the existing runner. Its own command documentation warns that sharing Apple's single RSD connection can evict `remoted` and reset Xcode/devicectl connectivity. Use a separately established supported provider only in an isolated future experiment, with recovery and state verification. A theoretical transport speedup is not useful if it invalidates the live runner. [Maintainer's connection-mode warning](https://doronz88.github.io/pymobiledevice3/latest/cli/developer/)

No examined Instruments source establishes a separate supported, faster arbitrary-app HID path on this phone. DVT process control, screen capture and telemetry do not imply event-injection support. The fastest actionable experiment remains the existing native activation A/B; a guarded AX semantic press is the next narrowly scoped input investigation after its action contract is established.

## Local visual path built after the experiments

An explicit OCR navigation mode now uses the same controller for guarded taps and scrolls when AX cannot describe a screen. No screenshot goes to JEV: only caller-supplied labels and result/readiness markers that local OCR found. This keeps visual targeting separate from native element identities and avoids claiming that OCR can satisfy an AX selector. It still needs physical validation; the phone's developer connection disappeared at 07:36 UTC before those tests.

The saved X image exposed a merged OCR row, “For you v.” Whole-line equality missed the real label. The helper now obtains word ranges and their boxes, so an exact phrase can exclude an adjacent glyph. Apple's accurate recognizer gives word-level boxes and warns that boxes are approximate. No fuzzy substring match or unlabeled-icon guess was added. [Apple's range-box contract](https://developer.apple.com/documentation/vision/vnrecognizedtext/boundingbox(for:)).

An alternating A/B on ten different original phone captures compared starting OCR per image with one local worker. All twenty calls completed with matching text and rounded word geometry. Median time was 266.605 ms per process versus 79.498 ms in the worker; worker cold startup was retained (268.578 ms maximum). The worker correlates response IDs, accepts one read at a time, handles split Unicode, and retires after an interrupted or invalid response. This measures one observation stage on saved data, not live input or end-to-end task speed. [A/B record](../benchmarks/runs/2026-11-12T07-48-48-509Z-offline-ocr/results.json), [reproduction script](../scripts/benchmark-ocr.mjs).

Two live JEV requests selected the intended Following / For You labels from that saved frame at the unchanged gates. This establishes model-choice behavior for those two requests only. No phone tap or navigation is claimed. The next required evidence is the recorded physical suite through the new visual path, followed by matched task comparisons. [Decision record](../benchmarks/runs/2026-11-12-replayed-visual-decisions/results.json).

A repeat on the same ten captures measured 234.243 ms per process versus 77.067 ms in the worker (240.465 ms maximum, including startup), again with matching text and rounded word geometry. These are the same ten distinct images, not ten new phone tasks. [Repeat record](../benchmarks/runs/2026-11-12T07-56-52-065Z-offline-ocr/results.json).
