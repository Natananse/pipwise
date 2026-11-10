# Android emulator screenshot candidates — 9 November 2026

Captured from the installed standalone preview APK **PipWise 1.0.0 / Android build 8**, app source `331c1aa`, **Trade UI: Rotate 1**. [EAS build](https://expo.dev/accounts/natananse/projects/pipwise/builds/7cb6a82c-1228-47cd-a6b9-4fcb3eaae214).

Device: disposable Android emulator `emulator-5580`, Android 17 / API 37, 16,384-byte page size; portrait display override **1080 × 1920**. Screenshot display density is listed per file below: 420 dpi for the initial captures and 360 dpi for the replacement order review. The density was changed on the emulator before rendering; no image was resized. These are emulator captures, not physical-phone acceptance. Only the local demo workspace was used. No account was created or signed in; no real or virtual order was confirmed and no exercise answer or lesson completion was fabricated. Demo prices were paused through the actual Practice details UI. Immersive mode was switched **Off** through Settings for stable navigation.

Every PNG is a direct `adb exec-out screencap -p` image converted technically to **RGB PNG without alpha**. No cropping, resizing, retouching, compositing, AI generation or UI/data replacement was performed. Source capture and delivered-file SHA-256 values are recorded below; originals remain under `/tmp/pipwise-screens/` during this session.

These are review candidates, not approved store assets. The floating navigation dock visibly overlapped bottom content on the original 420 dpi Trade/order views. The original order-review candidate is preserved unchanged as [QA evidence](../qa/2026-11-09/order-review-dock-overlap.png). The replacement 360 dpi order-review screenshot was visually checked: quantity, targets, disclosures, costs, risk estimate, Confirm virtual order and Edit order are all visible above the dock. This does not resolve the 420 dpi overlap finding. The complete Trade chart and simulation label were brought into view by ordinary scrolling. Resolve native acceptance findings and recapture as needed before upload. The Settings PNG is build evidence, not a recommended promotional screenshot. See [native smoke-test evidence](../../../docs/ANDROID_NATIVE_SMOKE_TEST.md).

| File | Emulator density | Suggested alt text |
| --- | --- | --- |
| [01-trade-chart.png](01-trade-chart.png) | 420 dpi | Simulated EUR/USD candlestick chart, practice-money label and virtual Buy/Sell controls. |
| [02-order-review.png](02-order-review.png) | 360 dpi | EUR/USD virtual order review with quantity, manual practice targets, collateral, fees, risk estimate, and visible confirmation/edit controls. |
| [03-learn.png](03-learn.png) | 420 dpi | PipWise lesson path showing Chapter One and actual zero completed lessons. |
| [04-analyse.png](04-analyse.png) | 420 dpi | Historical USD/JPY chart practice with Up and Down choices, before any answer. |
| [settings-build8.png](settings-build8.png) | 420 dpi | Settings showing Trade UI: Rotate 1 and App version: 1.0.0 · Build: 8. |

## Capture integrity

| File | Original screencap SHA-256 | RGB PNG SHA-256 |
| --- | --- | --- |
| `01-trade-chart.png` | `7f8506e522dc979d7640dfc62418a756d84c3bd76f59f89147ef97b45cb67987` | `854d2bf7f0eb55e88b5601e3790c1dc0a4f0e4981ed18b12606a262f413f21fd` |
| `02-order-review.png` | `3fe1b6f7fa03bd6ebcfe471106c769a82c72f6022479024081293e11f57a3c55` | `826c4d18ca07fd242a4c0c67c6f2556054752dffb66fcccfb1cb54553c755b45` |
| `03-learn.png` | `15513123276c6e045c0371e85c35d058be0340f488ebe53c1a46726a42c5f3ec` | `4fb3370ac53bb6b3e3182b7d8e0a5d75e11623986e443a380660fa606524889f` |
| `04-analyse.png` | `6a7b5e5856caf6dc158efb5af92e9fc2d733dee3e522722201ff07b2208a294b` | `3395960e3a7c098d64d0347cab1e89c33e276583fefd7028b92a269a771a79b8` |
| `settings-build8.png` | `be135c183ff5fa253489ddb34947930f3943e26d07293a2d4fb15d0ae411fd9f` | `0c1de21d378a88b8dca45f87a80b5369250ec5615f5a593317767ff48f6ba1e9` |

The original 420 dpi order-review source screencap SHA-256 was `b7d49a43364f059c2ea43d0b1bacc1378cc643cb600f2d242b2291ce8e7b250d`; its unchanged RGB PNG now preserved under QA has SHA-256 `10c7a6372b68d332abb0083dd3f30489160257188b133eb6fa89a0dc4cabbd4b`. The replacement source file is `/tmp/pipwise-screens/review-density360.png`.
