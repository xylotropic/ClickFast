# iPhone Sprint

Tiny, general iPhone control for coding agents. One signed XCTest runner, a USB relay, and **three MCP tools**. No saved routines, cloud service, video stream, npm packages, or model API required.

**Status:** the signed runner builds and has served commands on a physical iPhone 16 Pro Max. Hardware benchmarking is in progress. No completed speedup or world-fastest claim is supported yet. See [measurement status](benchmarks/STATUS.md).

## Why this can reduce overhead

- Capture visible text and actionable element handles in **one native AX traversal**. Avoid another full tree lookup before clicking.
- Revalidate the chosen live element on the phone before tapping. Reject a different snapshot or foreground app.
- Combine an action and its next observation in one USB request.
- Execute newly generated short sequences locally, with exact postconditions. No learning or recording phase.
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
codex mcp add iphone-sprint -- node /absolute/path/to/iphone-sprint/src/cli.mjs mcp
```

Other MCP clients can use the same `node` command and absolute script path. Tools:

| Tool | Purpose |
| --- | --- |
| `sprint_status` | Read native runner health |
| `sprint_observe` | Fresh controls/text, optional screenshot |
| `sprint_execute` | Run up to 24 newly generated actions/checks |

Only 1,894 bytes of tool schemas in the initial build. This is a schema-size measurement, not a task-speed measurement.

Read the screen, choose current refs or unique selectors, then execute a short sequence. Example:

```json
{
  "steps": [
    {"op":"launch","bundle":"com.apple.calculator","expect":{"app":"com.apple.calculator"}},
    {"op":"observe"}
  ]
}
```

This is an example request, not a stored workflow. A click can use `selector:{"kind":"Button","label":"7"}` or `ref` plus its matching `snapshot`. Supported operations are `observe`, `wait`, `launch`, `home`, `tap`, `tap_point`, `text`, `key`, and `swipe`. Text requires a freshly observed focused nonsecure editable field. Point coordinates are screen points; scale screenshot pixels using the observation's screen dimensions.

A missing target can wait locally; multiple matching targets stop. Unknown mutation outcomes stop without replay. A timeout is not evidence that a tap failed. Read the screen and resolve the outcome before continuing. Batch only actions authorized by the current user task. Stop for user takeover, authentication, unexpected sensitive screens, or ambiguous destructive actions.

An example temporary JSON request can also be run with `node src/cli.mjs execute /path/to/request.json`. CLI invocations cannot reuse another process's in-memory refs; use semantic selectors. MCP keeps its current observation in memory.

## Development and validation

```sh
npm test
bash vendor/iphone-use/runner/unit-check.sh
xcodebuild build-for-testing \
  -project vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunner.xcodeproj \
  -scheme IPhoneUseRunner -destination generic/platform=iOS \
  -derivedDataPath .state/unsigned CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO
```

After changing native code, run setup again with `--restart` to shut down the authenticated old runner and load the new one. Do not launch another test process while the first is still alive.

Host checks do not prove phone performance. Record correctness, failed attempts, recovery, and cold/warm behavior. Publish only redacted timing summaries; phone screenshots and interface text can contain private data.

## License and provenance

MIT. The runner is based on the **historical MIT release iphone-use v0.17.17**, commit `1ff29243b62db92fd702ea9b74a2ac75c747aad0`, with its license and Callstack attribution preserved. Newer PolyForm Shield code/binaries are not bundled. See [third-party notices](THIRD_PARTY_NOTICES.md).

This project uses private XCTest interfaces. iOS updates can change their behavior; compatibility must be tested on actual devices. It cannot promise every app exposes useful controls or that protected content can be captured.

## Required product tests and local records

[Acceptance tests](docs/acceptance-tests.md) require an actual TikTok post and an actual Instagram Reel, with the designated clip, account and visibility. Drafts do not count as published posts. These tests are not complete yet.

Every execute call records per-step durations and success/outcome metadata in private `.state/runs/`. Captions, account names, screenshots and interface text are omitted from this timing journal. Valuable failure screenshots can be kept in ignored `benchmarks/private/`; do not commit them.

**Keep the two transports isolated.** Quit iPhone Mirroring before direct control. Stop the XCTest runner before testing mirroring. In testing, concurrent mirroring caused AX to report Calculator while the physical screenshot showed the locked mirroring notice. The MCP/CLI front end now refuses direct observation/input while the Mirroring process is running. `sprint_status.drivable` includes that check. Host tools cannot guarantee every off-device controller respects this rule.
