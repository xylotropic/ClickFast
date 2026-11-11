# Third-party notices

The device runner in `vendor/iphone-use/runner` is based on **iphone-use v0.17.17**, commit `1ff29243b62db92fd702ea9b74a2ac75c747aad0`, published under MIT. Its full license is preserved in `vendor/iphone-use/LICENSE`. The original runner headers and the Callstack MIT attribution in its README are preserved.

Source: https://github.com/leeguooooo/iphone-use/tree/1ff29243b62db92fd702ea9b74a2ac75c747aad0/runner

That historical MIT grant is the basis for this vendored copy. Later iphone-use releases changed to PolyForm Shield; their new code and release binaries are **not included** in this project.

Local changes are the `/sprint/observe` and `/sprint/act` routes in `RunnerTests.swift`. These register live handles during observation and validate snapshot ownership before element clicks. The Node controller and MCP server are new MIT code.

`iproxy` is an external optional prerequisite from libusbmuxd, installed independently through Homebrew. It is not bundled or relicensed by this repository. Apple XCTest and Xcode are external Apple prerequisites, not included in the distribution.
