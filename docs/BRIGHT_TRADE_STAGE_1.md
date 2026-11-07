# Bright Trade — Stage 1

Historical stage: [TRADING_ROTATION.md](TRADING_ROTATION.md) supersedes this stage’s build marker, order layout, orientation and system-bar behavior. The current marker is **Trade UI: Rotate 1**.

This stage makes the default Trade workspace visibly bright and simpler. It covers the warm off-white background (`#F7F5EF`), a compact balance and information bar, asset pills, a prominent quote and change, the light chart and its controls, and one Buy/Sell strip. Secondary controls and explanations remain reachable through information or the expanded market selector. The persistent practice qualification is **Practice money · Simulated prices**. Pro promotions and repeated banners do not belong on this Trade surface.

The order panel/risk ring, immersive navigation, automatic dock hiding, fullscreen chart, and other-screen redesigns are later stages. System bars and normal tab navigation stay visible in Stage 1. Existing chart gestures, simulator execution/P&L, auth, billing, account deletion, public legal pages, launch animation, and onboarding behavior remain protected.

## Confirm which app is installed

Open **Profile → Settings** and find **Trade UI: Bright 1** near the top. On a native standalone build, the next line shows the installed app's **App version** and **Build**. Android's Build is the binary's `versionCode`; iOS uses its build number. Values come from [`expo-application`](https://docs.expo.dev/versions/v58.0.0/sdk/application/), not `app.json` or an update's config. Missing values display **Unknown** instead of a guessed number.

The browser displays **Preview · Browser**. Expo Go or a development client reports **Preview · Expo Go / development client**, using Expo's [`executionEnvironment`](https://docs.expo.dev/versions/v58.0.0/sdk/constants/) classification. Host metadata is deliberately excluded from those preview labels; use the standalone APK to confirm a distributed build.

The UI marker identifies this source revision's visual stage. Record the actual version/build as well: the marker alone does not identify an EAS artifact or prove which backend is deployed.

## Check, build, and install

Run the required checks from the repository root:

```bash
pnpm lint
pnpm typecheck
node --test tests/*.test.cjs
pnpm dlx expo-doctor
```

Build a fresh standalone Android preview APK with the exact command:

```bash
pnpm beta:android
```

The Settings marker adds the SDK-compatible `expo-application` native module. Use a newly built APK when accepting this stage. An old installed APK is not updated by saving code or restarting Metro. Follow [BETA_TESTING.md](BETA_TESTING.md) for signing, download and installation details; uninstalling can remove local practice data.

EAS uses remote app versions and preview auto-increment in `eas.json`. Record the previous artifact's Android `versionCode`, then check the completed artifact's actual version/code in EAS. After installing it, compare that version/code with **Profile → Settings → Trade UI: Bright 1**. Do not rely on the local `app.json` value alone. Before any Play upload, verify the new `versionCode` is higher than every version already uploaded to that app's Play tracks.

Record the EAS build URL, source commit, version/code, phone model, Android version and test date with the results. If the marker is missing or the native build number differs, resolve the installed artifact before assessing the redesign.

## Phone acceptance checklist

- **Visible design:** Trade has a warm off-white (`#F7F5EF`) background, charcoal text, compact balance + small information control, asset pills, a large quote/change, light chart, timeframe/type/tools controls and one Buy/Sell strip. Check that no dark header gradient, Pro promotion, motivational banner or repeated practice captions remain on the default screen. Keep the one practice-money/simulated-prices label readable.
- **Information and selection:** Open information and the market selector. Check portfolio access, watchlist/filter/save actions, pause/resume, useful model information and the reachable full trading disclaimer. A paused market must be distinguishable from a loading or failed chart. Search and an empty watchlist must offer a useful next action.
- **Chart behavior:** Switch assets, timeframe and chart type. Test anchored pinch, sideways pan, momentum, double tap, hold-and-drag crosshair, chart tools and reset. Drag vertically from the chart to check page-scroll arbitration. Repeat with reduced motion, background/resume, fast asset switches and a running simulated market. Follow the more detailed [chart gesture checklist](CHART_GESTURE_STAGE_1.md).
- **Orders and keyboard:** Open Buy and Sell; check quantity, optional targets, review/edit/confirm, costs, validation, fill feedback and dismissal without placing an accidental second order. Show/hide the keyboard and check every field and primary action remains reachable. Stop-loss/take-profit remain practice targets without automatic execution; no risk-ring behavior is claimed in this stage.
- **Insets and navigation:** Test gesture navigation and Android three-button navigation, with a cutout if available. Status/navigation bars remain visible in Stage 1; the tab dock must not cover Buy/Sell or content, and the keyboard must not leave navigation stuck hidden. Tap through other tabs and back. Check the existing portrait orientation policy when rotating the phone; also check narrow and wide preview layouts for clipping.
- **Large text and accessibility:** Increase system font/display size. Confirm balance, asset identity, quote/currency, information action, chart controls, errors and Buy/Sell remain readable/reachable. Use a screen reader to identify the selected asset and action controls. Check that change and candles communicate direction through sign/shape as well as color.
- **Protected first launch:** On an appropriate clean test profile, verify the original launch animation and all ten language choices, including Arabic RTL. Complete the three questions, use Back, kill/reopen midway and confirm saved-step resume; finish and confirm the established auth/demo flow. Use **Replay onboarding** from Settings, then confirm normal returning-user navigation afterward. Do not clear an important existing wallet simply to run this check.
- **Protected returning data:** Reopen with an existing wallet, preferences, lesson progress and account. Verify preserved balances, positions and P&L, portfolio closing/history, account access and legal routes. Report any startup retry/save issue rather than clearing storage to hide it.
- **Installed identity:** Confirm **Trade UI: Bright 1** and the expected native version/build in Settings. Repeat acceptance from the installed standalone APK without a cable, Metro or the computer running.

Source checks and mocked tests do not establish physical-device visual, keyboard, navigation-bar or gesture performance acceptance. Record actual phone results separately.
