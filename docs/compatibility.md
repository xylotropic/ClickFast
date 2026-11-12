# iPhone compatibility

ClickFast aims to support a wide range of **iPhone hardware models**. This page concerns phones, not language-model providers. The only physical configuration verified by this project's current recorded app tests is **iPhone 16 Pro Max on iOS 26.5**. Other models are candidates for testing, not certified devices.

Checked November 12, 2026. A phone model, its installed iOS version, the selected Xcode build, developer services and the runner's runtime capabilities all matter. A deployment target or a simulator test alone does not establish physical compatibility.

## What the source permits

The runner project declares `IPHONEOS_DEPLOYMENT_TARGET = 15.0` and device families `1,2` (iPhone and iPad). That is a build configuration, not a tested support promise. Its bridge resolves private XCTest classes and selectors at runtime and checks whether they exist; missing capabilities may stop an operation. See the [project settings](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunner.xcodeproj/project.pbxproj) and [bridge contract](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/IPURBridge.h).

Apple's current table lists Xcode 26.5 device support from iOS 15, while the Xcode 27 entries list device support from iOS 17. These differ from deployment-target ranges. Choose an Xcode version that can install/debug the phone's actual OS, then verify the runner on that combination. Neither table guarantees ClickFast's private API surface. [Apple Xcode requirements](https://developer.apple.com/xcode/system-requirements)

Native control requires a paired/trusted development connection, a signed runner, compatible developer services, and an unlocked device. Developer Mode is additionally required on OS versions that enforce it for development apps. This project does not bypass pairing, passcodes or biometrics. [Apple Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device), [native preflight](../scripts/preflight.mjs)

## Support levels

| Hardware/OS group | Current status | What must happen before claiming support |
| --- | --- | --- |
| iPhone 16 Pro Max / iOS 26.5 | Physical tests and recordings exist | Keep validating task coverage and reliability; failures remain documented |
| Other iPhones running iOS 26 | Plausible native targets, unverified | Install signed runner, pass capability and input tests, run the same physical task suite |
| Compatible iPhones on iOS 18 | Plausible native targets; Mirroring also has an OS-level route | Verify selected Xcode, private selectors, geometry, text and fallback behavior on hardware |
| iPhones on iOS 15–17 | Source deployment target may permit a build; unverified | Use compatible Xcode/services and confirm actual runtime capabilities; Mirroring requires iOS 18 or later |
| Phones unable to run iOS 15 | Outside this runner's declared deployment target | A different compatible runner/toolchain would be a separate project; no current support claim |
| iPad | Project build target exists, physical product behavior unverified | Separate geometry, multitasking, keyboard and orientation coverage |

Apple's iOS 26 list includes the iPhone 11–17 families, iPhone Air, 16e/17e and second/third-generation SE models. That is OS eligibility, not a ClickFast test matrix. Use Apple's complete list for exact variants. [Apple iOS 26 hardware list](https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-26-iphe3fa5df43/26)

Apple Mirroring requires iOS 18 or later, a supported Mac, matching Apple Accounts with two-factor authentication, Wi-Fi/Bluetooth and a nearby locked phone. Its availability and restrictions differ from the native runner's. It cannot provide iPhone camera/microphone access or Face ID. Do not present Mirroring as a universal fallback for older iPhones or every phone capability. [Apple Mirroring requirements and limits](https://support.apple.com/en-us/120421)

## Build for capabilities, not a model whitelist

Do not hardcode the dimensions of the currently tested Pro Max. Observe logical screen bounds, orientation, foreground app and safe tap geometry on the active device. Convert screenshot pixels into those observed points. Keep hardware Home-button devices and gesture-based devices in the test matrix. Handle keyboards, display zoom, text size, landscape and app-specific layout changes without changing the user's settings.

Probe and report capabilities individually: foreground lookup, AX observation, element identity checks, tap, swipe, Unicode field entry, hardware buttons, screenshot capture, lock detection and audio-state read. Choose any supported fallback before dispatch, based on a capability probe. A failed dispatch may already have acted and must stop without another backend repeating it. Missing text-synthesis selectors are checked separately from touch selectors. Neither a fallback nor a build proves a new hardware model works; each configuration still needs physical tests.

Treat encoding as another capability. The inherited H.264 source contains an encoder fallback ladder for older hardware, including an upstream iPhone X/full-size-encoding example. That implementation detail is **not** evidence that ClickFast itself has been tested on iPhone X. Capture size/frame-rate must adapt when an encoder fails to emit frames. See [encoder source](../vendor/iphone-use/runner/IPhoneUseRunner/IPhoneUseRunnerUITests/RunnerH264.swift).

For each new physical configuration, save model/OS/Xcode/runner versions, capability receipts, mute/lock checks and recorded outcomes. Test one compact Home-button phone, one compact Face ID phone and one large modern phone first, then expand. Include cold/warm app launches, real Unicode text, scrolling, modal sheets and an AX-unavailable app. Report per-device results; do not average away a broken model or claim “all iPhones” from simulator coverage.
