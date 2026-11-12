# ClickFast control reference

## How control works

- Capture visible text and actionable element handles in **one native AX traversal**. Avoid another full tree lookup before clicking.
- Revalidate the chosen live element on the phone before tapping. Reject a different snapshot or foreground app.
- Combine an action and its next observation in one USB request.
- Execute newly generated short sequences locally, with exact postconditions. No learning or recording phase.
- Group2–8 current numeric/operator keys in one native gesture submission. Validate every key before dispatch, stop on uncertain delivery, and check the displayed result. Transitions and nonnumeric controls remain separate.
- Wait for the next required control, rather than waiting for global idle or taking two matching full-tree snapshots.
- Keep all model reasoning in your existing agent. Screenshot fallback is available when accessibility is insufficient.

An immediate observation is a first-frame observation, not proof that a transition completed. Put `expect` on transitions and verify the task result. Service/network latency and agent reasoning remain real costs.

## Install

Requirements: a Mac with full Xcode and a configured Apple development team, Node 22+, and an iPhone with Developer Mode enabled. Provisioning must include the phone. Your first launch may require Trust and an on-phone UI Automation/passcode approval.

```sh
brew install libusbmuxd
node scripts/setup.mjs --udid YOUR_PHONE_UDID --team YOUR_TEAM_ID
node src/cli.mjs status
```

Find devices with `xcrun devicectl list devices`; use the hardware UDID, not the CoreDevice UUID. Keep the phone unlocked during setup. State, credentials, build products, and logs stay in ignored `.state/`; never publish that directory.

The setup defaults to `/opt/homebrew/bin/iproxy`; use `--iproxy /absolute/path/to/iproxy` on another Homebrew layout. The control relay binds only to `127.0.0.1:8130`. Device requests are signed with a private HMAC token. Video is disabled. No phone lock or security setting is disabled.

## Connect your agent

Register the persistent stdio MCP process:

```sh
codex mcp add clickfast -- node /absolute/path/to/ClickFast/src/cli.mjs mcp
```

Other MCP clients can use the same `node` command and absolute script path. **Control stays silent:** observe/execute verify native media volume at zero, lower it only when necessary, and stop if mute cannot be verified. Volume is not automatically restored. Tools:

| Tool | Purpose |
| --- | --- |
| `sprint_status` | Read native runner health |
| `sprint_observe` | Fresh controls/text, optional screenshot |
| `sprint_execute` | Run up to 24 newly generated actions/checks |

The interface keeps three tools. `sprint_observe` accepts `view:"navigation"` for controls only or `view:"reading"` for visible text, and `pixels_only:true` for a screenshot/context without a tree traversal. Tool-schema size is not a task-speed measurement.

Read the screen, choose current refs or unique selectors, then execute a short sequence. Example:

```json
{
  "steps": [
    {"op":"launch","bundle":"com.apple.calculator","expect":{"app":"com.apple.calculator"}},
    {"op":"observe"}
  ]
}
```

This is an example request, not a stored workflow. A click can use `selector:{"kind":"Button","label":"7"}` or `ref` plus its matching `snapshot`. Supported operations are `observe`, `wait`, `launch`, `home`, `tap`, `tap_point`, `text`, `key`, `swipe`, and `scroll`. Text requires a freshly observed focused nonsecure editable field. Point coordinates are screen points; scale screenshot pixels using the observation's screen dimensions.

Use `swipe` for a flick. Use `scroll` with `x1`, `y1`, `x2`, `y2` for a 470 ms drag that slows before release, reducing the extra distance from momentum. The controller checks the current snapshot and screen bounds. This is a gesture delivery receipt; verify that the requested content moved afterward. `scroll` has fixed timing; use `swipe` for custom timing.

For `launch` or `home`, `observe:false` checks the foreground bundle without traversing all controls. This proves which app is in front, not that its content has loaded. A selector or absence predicate still needs AX; the next element action reads a fresh tree. Pixel observations and incomplete trees cannot prove a control is absent.

Native snapshots expire after30seconds. A click re-reads the same registered element and rejects changed meaning, moved frames, disabled controls or partial off-screen bounds; it does not silently scroll. Full overlay/hit ownership remains a separate limitation. A missing target can wait locally; multiple matching targets stop. Unknown mutation outcomes stop without replay. A timeout is not evidence that a tap failed. Read the screen and resolve the outcome before continuing. Batch only actions authorized by the current user task. Stop for user takeover, authentication, unexpected sensitive screens, or ambiguous destructive actions.

An example temporary JSON request can also be run with `node src/cli.mjs execute /path/to/request.json`. CLI invocations cannot reuse another process's in-memory refs; use semantic selectors. MCP keeps its current observation in memory.

## Real wireless phone results

Ten physical iPhone Spotlight calculations/conversions passed, followed by a **10/10 confirmation**. Median warm input plus fresh screenshot/OCR verification was **0.921 s**; median navigation reset plus warm task was **3.596 s**. [Watch ten recorded comparisons](../benchmarks/runs/2026-11-11-wireless-phone/comparison.html), [results table](../benchmarks/runs/2026-11-11-wireless-phone/comparison.md), [wireless implementation and limits](wireless.md). This is a Mirroring navigation/text fallback; arbitrary-app taps and native XCTest over Wi-Fi remain unverified or blocked. These measurements use different tasks and boundaries from the older Calculator results above.

## Recorded comparison suite

`node scripts/benchmark-suite.mjs` runs ten reversible tasks in alternating batch/JEV order, with a native 3 fps screen recording and timestamped input/decision logs for each run. It checks media volume before every run and verifies results with a separate fresh accessibility read. JEV credentials are required. Raw captures stay in ignored `benchmarks/private/`. See [suite method](benchmark-suite.md).

Use `node scripts/benchmark-suite.mjs --ab-bursts` for a paired burst on/off run without a JEV key. `--scoped-jev` tests a narrower task-specific candidate set and records that scope change. [Current results and failure audit](operator-performance.md).

Brand assets: [mark and wordmark](brand/). Existing `sprint_*` tools and signing IDs remain compatible.

## Development and validation

```sh
npm test
bash vendor/iphone-use/runner/unit-check.sh
xcodebuild build-for-testing \
  -project vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunner.xcodeproj \
  -scheme IPhoneUseRunner -destination generic/platform=iOS \
  -derivedDataPath .state/unsigned CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
```

After changing host code, reconnect the MCP server so its process loads the new code and tool schema. A running server keeps its existing imports.

After changing native code, run setup again with `--restart` to shut down the authenticated old runner and load the new one. Do not launch another test process while the first is still alive.

Host checks do not prove phone performance. Record correctness, failed attempts, recovery, and cold/warm behavior. Publish only redacted timing summaries; phone screenshots and interface text can contain private data.

## License and provenance

MIT. The runner is based on the **historical MIT release iphone-use v0.17.17**, commit `1ff29243b62db92fd702ea9b74a2ac75c747aad0`, with its license and Callstack attribution preserved. Newer PolyForm Shield code/binaries are not bundled. See [third-party notices](../THIRD_PARTY_NOTICES.md).

This project uses private XCTest interfaces. iOS updates can change their behavior; compatibility must be tested on actual devices. It cannot promise every app exposes useful controls or that protected content can be captured.

## Required product tests and local records

[Acceptance tests](acceptance-tests.md) require an actual TikTok post and an actual Instagram Reel, with the designated clip, account and visibility. Drafts do not count as published posts. TikTok published once as **Only you** and was verified in the private grid; playback reopen remains unverified. Instagram reached the final settings and its private draft was saved/reopened with exact caption; **Share was never dispatched** because the available audience choices failed the user’s owner-only requirement. Both full acceptance tests remain incomplete.

Every execute call records per-step durations and success/outcome metadata in private `.state/runs/`. Captions, account names, screenshots and interface text are omitted from this timing journal. Valuable failure screenshots can be kept in ignored `benchmarks/private/`; do not commit them.

The user subsequently replaced publication acceptance with the Calculator benchmark; posting results remain historical evidence.

**Keep the two transports isolated.** Quit iPhone Mirroring before direct control. Stop the XCTest runner before testing mirroring. In testing, concurrent mirroring caused AX to report Calculator while the physical screenshot showed the locked mirroring notice. The MCP/CLI front end now refuses direct observation/input while the Mirroring process is running. `sprint_status.drivable` includes that check. Host tools cannot guarantee every off-device controller respects this rule.

## Runner screen

ClickFast's own app screen shows the official Libraries.dev **ThinkingOrb**, state `working`, 64 pt, centered on dark gray `#121212`. It uses the library's native SwiftUI port and pauses while backgrounded or with Reduce Motion. [Installed app screen](images/operator-on-phone.png), [captured animation](images/working-orb.gif), [verification](../benchmarks/orb-ui.json). This does **not** replace Apple's system “Automation Running” shield. That shield remains a platform limitation of this XCTest control path; screenshots of our app do not prove it changed.

## Optional JEV loop

The largest measured saving here comes from fewer coding-agent round trips. `sprint_execute` also accepts a newly generated `local_goal` in place of `steps`. It selects among fresh permitted controls, performs one action, observes, and continues until an explicit visible predicate or a budget/handoff. This is general bounded navigation, not a saved app routine.

Set `TYPESAFE_API_KEY` in the MCP environment, or save it in ignored `.state/jev-token` with mode 0600. Never commit keys. Each goal must opt into sending its goal and selected UI labels to TypeSafe. Screenshots and editable field values are excluded. The current chooser receives permitted control labels and the exact text literals supplied in the goal. It can choose a tap, bound text entry, Home, an allowed app launch, or a bounded swipe. [Research and contract](jev.md), [general-control implementation review](jev-general-control-research.md).

JEV is still experimental. An earlier strict physical suite completed 4/10 tasks. A later, different set of 12 tasks verified seven: a folder/app round trip and input or navigation in Contacts, Shortcuts, Calendar, Reminders, Weather and Books. Four tasks stopped at decision gates; one failed its starting-state check. These are separate task sets, not a measured improvement from 4/10 to 7/12. [Full broader run and failures](general-control-results.md). The 0.9 execution gates remain unchanged.

```json
{
  "local_goal": {
    "goal": "Open the editor without publishing",
    "apps": ["the.observed.app.bundle"],
    "allowed_selectors": [{"kind":"Button","label":"Next"}],
    "until": {"selector":{"kind":"StaticText","label":"Editor"}},
    "external_ui_opt_in": true,
    "max_actions": 6
  }
}
```

The calling agent supplies an authorized app and control scope. Protected-label filtering is an extra English-language check, not a substitute for authorization. Publication, money, authentication, consent and destructive actions stay with the calling agent. For calculations, add `until.after_action`, for example `{"kind":"Key","identifier":"Equals"}`, so an intermediate matching number cannot finish the goal. Text entry binds the original field's native identity and rechecks it after focusing. Home can require the open folder title to disappear. Completion comes from a fresh explicit predicate; a model answer alone cannot finish the task. Ambiguous targets, uncertain delivery, no progress or exhausted budgets hand back. Choice gates are experimental and uncalibrated.

## AXe review

The [pinned source review](axe-review.md) covers the whole tracked path inventory and traces critical implementation areas. ClickFast adopts native target identity/frame admission, snapshot expiry, input-delivery receipts, compact navigation views, and a bounded optional chooser. Full overlay ownership and native cancellation propagation remain open work. AXe's runner-free path was measured in isolation: AX reads worked; its screenshot/HID services were unavailable on this phone. No blanket replacement or performance claim follows from its simulator benchmarks.
