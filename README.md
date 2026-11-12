<p align="center">
  <img src="docs/brand/clickfast-lockup.svg" width="720" alt="ClickFast">
</p>

ClickFast lets Codex use your iPhone. It can tap, type, search, and move between apps.

Connect your phone, tell your agent what you need, and let it handle the tapping. It reads the screen as it goes and checks the result.

## Try it

You'll need a Mac, Xcode, Node 22 or newer, and an iPhone with Developer Mode enabled. Setup also needs an Apple development team for signing.

```sh
git clone https://github.com/xylotropic/ClickFast.git
cd ClickFast
brew install libusbmuxd
node scripts/setup.mjs --udid YOUR_PHONE_UDID --team YOUR_TEAM_ID
codex mcp add clickfast -- node "$PWD/src/cli.mjs" mcp
```

Keep the phone unlocked during setup. Once connected, ask your agent to open an app and try a small task. Other agents can connect through MCP too.

[Setup and control reference](docs/control-reference.md)

## What we've tested

Ten small tasks on a wired iPhone took 7.46 seconds with ClickFast and 30.53 seconds through iPhone Mirroring. Those were Calculator and navigation tasks, not an all-app test. [Recordings and method](benchmarks/runs/2026-11-11-operator-vs-mirroring/comparison.md).

JEV handles the next-action decisions in the optional local loop. It completed seven of twelve broader trials. That part still needs work. [Results, including failures](docs/general-control-results.md).

The phone stays muted during control. Apple's system automation screen is still there. Full details and current limits are in the [control reference](docs/control-reference.md).

## More

- [Physical-phone measurements](docs/operator-performance.md)
- [Wireless setup and results](docs/wireless.md)
- [JEV notes](docs/jev.md)
- [Logo files](docs/brand/)

MIT. Based on the MIT release of Callstack's iphone-use. [License and credits](THIRD_PARTY_NOTICES.md).
