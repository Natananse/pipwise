# Android native smoke test — 9 November 2026

This is a **partial emulator acceptance check**, not a physical-phone or production sign-off. See [release status](FINAL_RELEASE_STATUS.md), [artifact verification](ANDROID_RELEASE_VERIFICATION.md) and the remaining [phone checklist](TRADING_ROTATION.md#phone-acceptance).

## Installed artifact and environment

- EAS preview build [`7cb6a82c-1228-47cd-a6b9-4fcb3eaae214`](https://expo.dev/accounts/natananse/projects/pipwise/builds/7cb6a82c-1228-47cd-a6b9-4fcb3eaae214), app source `331c1aa`, package `io.pipwise.app`.
- The installed package manager reports **version 1.0.0, versionCode 8, minSdk 24, targetSdk 36**. Downloaded APK SHA-256: `485da5f85ee38607b61603339ea5d22170f194df63bba37a39103e470b63285f`.
- Actual Settings UI also confirms **Trade UI: Rotate 1** and **App version: 1.0.0 · Build: 8**; [capture](../assets/play-store/qa/2026-11-09/settings-build8.png).
- Pixel 6 Android emulator, Android **17 / API 37**, x86_64 Google APIs image configured for **16 KB pages**; `getconf PAGE_SIZE` returned **16384**. Initial display: 1080×2400, density 420. Test date: **9 November 2026, Africa/Addis_Ababa**.
- Emulator `emulator-5580` was started with `-read-only -no-snapshot`. This session's demo data and device-setting changes are temporary. The signed APK ran without Metro, Expo Go or a development server.
- Tests used only local demo mode and synthetic onboarding/order values. No account was created, signed in, deleted or sent feedback. No database rollout or backend deployment was performed.

## Observed results

| Flow | Result and practical limit |
| --- | --- |
| Standalone launch | App reached language selection and completed the local demo entry path. Native startup error log query returned no AndroidRuntime/ReactNativeJS errors at that checkpoint. The animated intro itself was not fully recorded. |
| Portrait onboarding / RTL | Selected Arabic and requested landscape; accessibility rotation remained `0` and Arabic text/layout rendered right to left. Returned to English. Other eight languages were visible as options but not exercised. |
| Saved-step resume | Completed question 1, force-stopped/reopened at question 2, and returned to question 2 in portrait with setup state intact. Completed questions 2 and 3 and chose demo mode. Failed-save/retry behavior was not induced. |
| Rotation after setup | Auth and Trade followed landscape after onboarding; Trade rendered in portrait and both landscape directions (`1` and `3`). System auto-rotate on/off and the Portrait-only preference still need separate acceptance. |
| Landscape Trade | Chart stayed on the left while the right panel scrolled independently to quantity, target fields and order review. Simulated prices were paused through Practice details to stabilize accessibility capture. Live prices had rendered before pausing. |
| Keyboard and order draft | Entered quantity **100**, stop **1.08**, take profit **1.09** for EUR/USD. Android's landscape keyboard used its fullscreen text editor; text entry and Back worked. After portrait rotation, the app still showed all three exact values. This does not cover every keyboard/form or rotation while typing. |
| Risk display | With the market paused at **1.08398**, the Buy draft showed **$108.40** collateral, **$0.02** estimated entry fee and **$0.44** estimated stop risk including fees. Manual-target/no-guaranteed-exit text was visible. Blank/invalid values, Sell and USD/JPY remain untested natively. |
| Review through rotation | Opened Review, rotated to the opposite landscape direction and scrolled the right panel. Review still showed **BUY · 100 units · EUR/USD** and **Stop loss: 1.08 · Take profit: 1.09**. No trade was confirmed during this check. |
| Fullscreen / Android Back | Opened the fullscreen chart from that review, then pressed Android Back. The split layout and same order review returned with the quantity/targets intact. Portrait fullscreen, pinch/pan/hold-inspection retention and repeated-gesture stress remain open. |
| Immersive controls | Android showed its first-use fullscreen hint, which was dismissed. Hidden navigation, the visible reveal handle and revealed navigation were observed. Exhaustive timing, system-edge gestures and three-button navigation remain open. |

The first fullscreen landscape capture places the bottom chart-axis labels at the screen edge. The portrait draft capture also shows the navigation reveal handle over part of the bottom field/action area while scrolled. At 1080×1920, the nonimmersive dock also overlapped the bottom chart time labels at the initial Trade scroll position; normal scrolling brought the chart and its simulation disclosure into view. These are open layout observations, not complete safe-area or bottom-control acceptance; explicitly check them on the physical device and at smaller heights before sign-off.

The [listing screenshot candidates](../assets/play-store/screenshots/README.md) add four 1080×1920 product views. The replacement order-review capture was rendered at emulator density 360 and shows the quantity, targets, disclosures, costs, risk, Confirm and Edit controls above the dock. Other listing captures use density 420. The original density-420 order-review overlap is retained as [QA evidence](../assets/play-store/qa/2026-11-09/order-review-dock-overlap.png); the alternative display configuration does not resolve that observation. No order was confirmed. The task's read-only emulator was closed after capture; local session changes were not saved to its original image.

## Saved evidence

Screenshots are in [`assets/play-store/qa/2026-11-09`](../assets/play-store/qa/2026-11-09/). They are exact UI captures with only conversion to opaque RGB PNG; no cropping, added text, generated interface or changed pixel dimensions. [`captures.json`](../assets/play-store/qa/2026-11-09/captures.json) records original capture hashes and saved PNG hashes. The 1080×2400 / 2400×1080 QA images are **not Play listing upload assets** because their aspect ratio exceeds 2:1. The Settings version-evidence capture is 1080×1920.

| Capture | Evidence |
| --- | --- |
| [Language selection](../assets/play-store/qa/2026-11-09/onboarding-language.png) | Fresh installed-release setup |
| [Arabic portrait](../assets/play-store/qa/2026-11-09/onboarding-arabic-portrait.png) | RTL setup while landscape was requested |
| [Resumed question](../assets/play-store/qa/2026-11-09/onboarding-resumed.png) | Question 2 after force-stop/reopen |
| [Landscape Trade](../assets/play-store/qa/2026-11-09/landscape-trade.png) | Chart/panel split and paused demo |
| [Landscape keyboard](../assets/play-store/qa/2026-11-09/landscape-keyboard.png) | Native IME fullscreen editor with the test target |
| [Draft after rotation](../assets/play-store/qa/2026-11-09/order-after-rotation.png) | Preserved quantity and both targets |
| [Risk and review action](../assets/play-store/qa/2026-11-09/order-risk.png) | Actual local cost/risk display |
| [Fullscreen chart](../assets/play-store/qa/2026-11-09/chart-fullscreen.png) | Landscape chart before Back returned to review |
| [Settings version](../assets/play-store/qa/2026-11-09/settings-build8.png) | Installed native version/build and Rotate 1 marker |

## Still required

Complete physical-device acceptance and the untested items in [TRADING_ROTATION.md](TRADING_ROTATION.md#phone-acceptance), including native splash/intro, cutouts and safe areas, large text, TalkBack, gesture/three-button navigation, saved wallets/lesson progress, file imports, all keyboard forms, chart gestures and crash/performance checks. Real email/Google sign-in, recovery, authenticated API flows and account deletion depend on the compatible owner-run service setup. Running on one 16KB x86_64 emulator does not establish arm64 hardware behavior, Play-generated split behavior or store approval.
