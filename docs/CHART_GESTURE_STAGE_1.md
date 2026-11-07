# Chart gestures — stage 1

This stage adds gestures to the in-app SVG chart: horizontal pinch zoom, horizontal pan, momentum, double-tap zoom, reset, and long-press candle inspection. It also keeps drawing inside the plot and distinguishes rising hollow candles from falling filled candles.

Fullscreen and rotation, provider navigation restrictions, and the Trade layout redesign belong to later stages. The provider widget keeps its own interactions.

## Implementation and dependencies

- `src/lib/chartViewport.ts` contains fractional-index viewport math, prepared OHLC/average data, and bounded drawing geometry. Price extremes are retained when distant candles are grouped for display; inspection uses the original candles.
- `src/components/useChartController.ts` prepares changed arrays once on the JS runtime and schedules live viewport changes on the UI runtime. Historical views keep their candle-time anchor when old bars roll out. A chart at the latest edge follows new data while the user is not interacting. Identity changes reset its view.
- `src/components/useChartGestures.ts` owns recognition, momentum, and cancellation.
- `src/components/InteractiveChartPlot.tsx` uses a scoped gesture root and a bounded number of animated SVG paths. Text readouts cross to React separately from the plot geometry.
- `src/components/TradingChart.tsx` connects the existing chart controls and loading states to those pieces.

The SDK58 dependencies are `react-native-gesture-handler` `~3.3.0`, `react-native-reanimated` `4.7.1`, and `react-native-worklets` `0.13.0`. Expo's Babel preset configures the worklet plugin automatically. The gesture root surrounds the chart; startup does not need a new global wrapper. See the matching [Expo gesture-handler docs](https://docs.expo.dev/versions/v58.0.0/sdk/gesture-handler/) and [Expo Reanimated docs](https://docs.expo.dev/versions/v58.0.0/sdk/reanimated/).

Animated SVG geometry uses `createAnimatedComponent` and `useAnimatedProps`, as described in the [Reanimated SVG guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/animating-svg/). UI-thread geometry avoids React updates for every gesture frame, but does not by itself prove a particular frame rate.

## Build and install

These dependencies add native code. Use a newly built APK when validating this stage; an existing standalone APK cannot acquire the native modules through a JS reload or an OTA update. SDK-compatible Expo Go can help during development, but acceptance uses the standalone preview build.

Run the repository checks before building:

```sh
pnpm lint
pnpm typecheck
node --test tests/*.test.cjs
pnpm dlx expo-doctor
```

Build through the existing preview command:

```sh
pnpm beta:android
```

Follow [BETA_TESTING.md](BETA_TESTING.md) for installation and signing details. EAS uses the remote app version and preview auto-increment. Record the prior Android build's `versionCode`, then confirm the completed build has a higher `versionCode` in EAS before distributing it. The value in `app.json` alone does not establish the remote build version. Record the build URL, commit, version code, phone model, Android version, and test date.

## Phone acceptance checklist

Use both the moving practice chart and a static chart where available. Repeat in Line and Candles modes, with the moving average enabled and disabled.

- [ ] Pinch near the left, center, and right of the plot. The candle beneath the pinch stays anchored until a history boundary is reached. Repeated pinches reach the zoom limits without blank space, inverted geometry, or disappearing paths.
- [ ] Drag horizontally in both directions. The plot follows the finger, stops at available history boundaries, and cannot pan into empty history. Pan after zooming without a jump to the latest bars.
- [ ] Release a brisk horizontal pan. Momentum slows and remains inside history. Starting another drag, pinch, inspection, or toolbar action interrupts it immediately. With reduced motion enabled, verify the chosen reduced-motion behavior.
- [ ] Double-tap near different parts of the plot. Zoom anchors around the tap. Reset returns to the initial window at the latest edge; accessible zoom and earlier/later buttons also work.
- [ ] Long-press, then move across candles. Crosshair, timestamp, OHLC, and price readout agree with the touched location. Release removes inspection. Test the first and last available candles and a flat-price series.
- [ ] Start a vertical swipe on the plot before a chart gesture activates. The surrounding page still scrolls. Horizontal pan and two-finger pinch do not move that page. The horizontal asset selector and chart toolbar remain usable.
- [ ] Cancel a gesture by leaving the tab, opening another screen, switching asset/timeframe, opening chart controls, pressing Android Back, or backgrounding the app. Return and confirm there is no stuck crosshair, runaway momentum, or locked page scrolling.
- [ ] While viewing old candles, let the demo clock update and cross a bar boundary. The chart keeps its historical time anchor. Reset and confirm the latest edge follows new bars again. Pause/resume the demo clock and repeat inspection.
- [ ] Check the plot edges, price axis, timestamp labels, and smallest phone width. Paths stay clipped to the plot, strokes remain legible, and hollow/filled candle bodies remain distinct without relying only on color. Text finishes at the final gesture position after motion stops.
- [ ] Check loading, error/retry, empty data, and a short series. Controls disable appropriately and stale OHLC from a previous asset is not displayed.
- [ ] Cold-start with an unfinished setup and with an existing completed profile. Verify the native splash, onboarding/returning navigation, language choice, and saved wallet behavior.
- [ ] Place and close the same virtual orders used for the simulator regression check. Confirm execution price, collateral, fees if applicable, and P/L behavior remain consistent. Check the optional provider mode separately.
- [ ] Smoke-test browser rendering, pointer input, and page scrolling. Browser behavior is separate from native Android acceptance.

## Performance evidence

Measure on a physical Android phone using the standalone preview/release build. Development mode, attached debugging, screen recording, and thermal throttling can affect measurements; record those conditions. Reanimated's [performance guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/) explains the difference between debug and release performance.

At 60 Hz, the frame budget is about 16.7 ms. Record a repeatable pinch/pan/inspection sequence, its duration, frame timing and missed frames using Android frame tracing or equivalent tooling. Repeat with moving data and a large synthetic history (for example 10,000 and 50,000 candles), and record preparation time separately from gesture frame time. A large source array should not create one native SVG node per candle; confirm the visible drawing remains bounded and extreme prices are retained when grouped.

The automated tests exercise viewport math, data anchoring, scheduling, gesture lifecycle contracts, and regressions. Mocked hooks and Node tests do not exercise native touch arbitration, measure frame rate, or establish 60 fps. Phone checks and performance traces remain pending until someone records those results for the new APK.
