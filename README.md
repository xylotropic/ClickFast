<p align="center">
  <img src="docs/brand/clickfast-lockup.svg" width="720" alt="ClickFast">
</p>

ClickFast connects your iPhone to Codex and other AI agents. Your agent can open apps, tap buttons, enter text, scroll, and check the screen.

Try a task such as “Open Weather and search for São Paulo.” The agent reads the phone’s controls, chooses the actions, and checks the result.

ClickFast sends actions directly to the phone over USB. Several steps can run in one request, which cuts the wait between taps.

## Setup

You need a Mac, Xcode, Node 22 or newer, and an iPhone with Developer Mode enabled. Xcode needs an Apple development team to sign the runner.

```sh
git clone https://github.com/xylotropic/ClickFast.git
cd ClickFast
brew install libusbmuxd
node scripts/setup.mjs --udid YOUR_PHONE_UDID --team YOUR_TEAM_ID
codex mcp add clickfast -- node "$PWD/src/cli.mjs" mcp
```

Keep the phone unlocked during setup. Once connected, ask Codex to try a small task. Other agents can use the same MCP connection.

You can also let JEV choose the next action from the current screen controls. That option needs a TypeSafe API key. See the [setup and control reference](docs/control-reference.md).

## Results

We ran twenty tasks across folders and fourteen apps on a real iPhone. ClickFast verified **16/20**; the agent using iPhone Mirroring verified **14/20**. In the twelve tasks both completed, median time was **2.04 seconds with ClickFast** and **16.55 seconds with Mirroring**.

This compares the two complete workflows, including decisions and result checks. ClickFast delegates short tasks locally to JEV; Mirroring uses the coding agent between actions. App state and gesture paths differ, so these numbers do not isolate transport speed. Books, TikTok and X still exposed failures. [See every outcome and the method](benchmarks/runs/2026-11-12-general-v10-vs-mirroring/comparison.md).

ClickFast sets media volume to zero before control. Apple still shows its system “Automation Running” screen during XCTest control.

## Docs

- [Setup, commands, and current limits](docs/control-reference.md)
- [General phone tests and remaining failures](docs/control-development.md)
- [Latency research and measured experiments](docs/latency-research.md)
- [iPhone compatibility](docs/compatibility.md)
- [Earlier phone test results](docs/operator-performance.md)
- [Wireless control](docs/wireless.md)
- [JEV setup and notes](docs/jev.md)
- [Logo files](docs/brand/)

MIT. Based on Callstack’s MIT release of iphone-use. [License and credits](THIRD_PARTY_NOTICES.md).
