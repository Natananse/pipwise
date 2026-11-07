# Portrait, landscape and full-screen trading

The current source revision uses **Trade UI: Rotate 1** in Profile → Settings. It requires a new native APK: orientation is now `default` in app.json and the SDK-compatible `expo-screen-orientation` module has been added. Saving JavaScript or restarting Metro does not update an already-installed APK.

## Behavior

- Welcome animation, language selection and all three onboarding questions request portrait. Replay and Questions also return to portrait. The existing animation, language/RTL choices, question order, persistence, retry and startup decisions remain in place. The welcome starts only after a portrait window is measured. If an unsupported OS-managed resize forces it sideways while running, the guard stops that instance and starts the complete original intro after portrait returns; it never runs the intro hidden. The wizard stays mounted with its current draft while waiting, and a bounded retry screen replaces any prolonged wait.
- After setup, **Settings → Screen rotation → Auto / Portrait only** controls orientation. Auto follows the platform's default orientation policy; Android's system rotation setting still applies. Display preferences are saved separately from onboarding answers, with visible errors and retry controls.
- Portrait Trade keeps the market selector and quote above the chart, with the order editor below. Landscape puts the chart on the left and a separately scrollable market/quote/order panel on the right. The approximate 65/35 split gives the panel additional room on small phones or with larger type.
- Chart and order component identities stay stable during rotation and full-screen changes. Selected asset, timeframe, chart type, moving average, viewport and order fields/review remain. Resize ends stale finger gestures/momentum while retaining and repositioning active inspection.
- Expand/collapse uses the same chart instance. Android Back exits full-screen without submitting or clearing the order. Entering full-screen dismisses the keyboard while preserving typed values.
- **Settings → Immersive mode** defaults on for Trade. Chrome hides after three seconds of inactivity or a downward page scroll. Touching the screen, scrolling up or pressing **Show navigation** reveals it. Android edge swipes reveal system bars temporarily. Navigation is compact in landscape, reserves space, and hides while the keyboard is present. Startup, dialogs and other routes retain their own visible system bars.
- The Risk ring estimates the loss if a practice position is manually closed at the stop target, including both simulator fees and USD/JPY conversion. Green is up to 1% of available virtual balance, amber up to 2%, red above 2%. Missing/invalid size or stop shows an unavailable estimate. Targets remain manual; there is no automatic exit or guaranteed loss limit.
- Shared sheets, provider/research charts, lessons, Review, Profile, Progress and support screens have short-window sizing, scrolling, safe-area or wrapping adjustments. Profile's statistics carousel realigns its selected page after resize.

## Check and build

```bash
pnpm lint
pnpm typecheck
node --test tests/*.test.cjs
pnpm dlx expo-doctor
pnpm beta:android
```

Open the completed EAS build link on the phone, download and install its APK, and compare the native version/build in Settings with the EAS artifact. The installed APK runs without Metro, a cable or the computer. Preview uses EAS remote versions and auto-increment; verify the actual Android `versionCode` is higher than every code already uploaded to Play before any Play upload. Do not use app.json's local number as evidence of the remotely assigned code.

The ignored generated android/ directory is not hand-edited. EAS regenerates native configuration for the new binary. A small local CNG plugin gives Android's activity an initial portrait orientation before JavaScript starts. The runtime owner then applies DEFAULT after setup for Auto, which explicitly releases that initial lock. Config introspection confirms the launch orientation, retained orientation/screen-size handling and adjustResize keyboard mode. iOS supports both landscape directions and starts portrait; requireFullScreen enables portrait locking on older iPads. Native splash behavior, system rotation and keyboard timing must still be tested with the rebuilt binary.

## Phone acceptance

- [ ] Confirm **Trade UI: Rotate 1**, the expected native version/build, phone model, Android version and test date.
- [ ] Rotate portrait → landscape → portrait with quantity, stop and take-profit typed; repeat during Review. Confirm values, side and selected asset survive, and that rotation never places an order.
- [ ] Select another timeframe, zoom and pan away from the latest candle, inspect a candle, then rotate repeatedly. Confirm timeframe, view and inspected candle remain; verify the next pan/pinch/hold works normally.
- [ ] Enter and exit full-screen in both orientations; repeat while an order is in progress. Check chart tools, Android Back, and that the draft is unchanged afterward.
- [ ] On a small landscape phone, scroll only the right panel through every input, Risk ring and confirmation. The left chart must remain stationary and usable. Verify blank, invalid and valid risk estimates for Buy, Sell and USD/JPY.
- [ ] Focus each order field, show/hide the keyboard and rotate while it is open. The focused field and review/confirm action must remain reachable. Repeat in sheets, profile editing, auth, feedback and account-deletion reauthentication.
- [ ] Test both landscape directions with the cutout on each side; check all four safe-area edges. Repeat using gesture navigation and three-button navigation.
- [ ] Wait three seconds on Trade, then reveal navigation by touching, scrolling up and the visible handle. Swipe from the edge for system bars. Confirm bars return on other routes and leaving full-screen. Turn Immersive mode off and verify visible controls.
- [ ] Choose Portrait only, relaunch and verify the lock; choose Auto and verify rotation, including with Android's system auto-rotate disabled/enabled.
- [ ] Cold-launch while physically holding the phone sideways. Verify the original full-screen welcome and native splash handoff, all ten languages including Arabic RTL, and all three questions remain portrait. Check Back, failed-save retry, kill/reopen mid-setup, saved-step resume, Replay onboarding and Settings → Onboarding questions. Check a returning-user launch too.
- [ ] Increase font/display size. Check narrow and large screens, lessons/quizzes, Review answer controls, Progress, both Profile statistics pages, Settings, Portfolio, Markets, legal pages and support forms. Reopen existing wallet/preferences/lesson progress and verify retained data.

## Verification limits and recovery

Automated tests and Android/iOS bundle exports do not establish actual phone painting, keyboard visibility, gesture performance or native splash timing. Record phone results separately; no measured 60fps claim is made.

The Android initial-portrait plugin covers launch before JavaScript, while the measured portrait presentation guard also protects Replay/setup transitions and bounds waiting instead of clearing data. Expo documents that newer resizable iOS windows may still refuse orientation locks; the current release target remains Android. Verify any future iOS release separately: https://docs.expo.dev/versions/v58.0.0/sdk/screen-orientation/.

If display preferences fail to load/save, use the Settings retry control. If native orientation cannot be applied, use its retry control or turn the phone upright. Preserve local data while reporting problems; uninstalling can erase practice data. Reverting the source and rebuilding the prior configuration is the release rollback; no database or server changes are part of this stage.
