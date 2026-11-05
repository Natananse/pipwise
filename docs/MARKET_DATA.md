# Market charts and custom analysis

**Trade** opens the moving simulated practice market. The optional **Market charts** view embeds TradingView’s official free advanced-chart widget for the seven markets. No generated candles or sample numeric quotes appear in this mode. Provider loading errors remain errors; there is no simulated fallback. Symbols, data sources, delay/availability messages and standard attribution remain visible. Oil is explicitly a WTI CFD reference, S&P 500 a FOREX.com CFD reference, and gold a TradingView-calculated reference. The exchange cash-index SP:SPX and its TVC alias rejected embedding during verification; the FOREXCOM:SPX500 reference was visually verified instead.

The display-only widget uses an Expo DOM component isolated on native platforms through the SDK’s existing `@expo/dom-webview`. The native Expo-modules bridge stays disabled, no account data is passed into the widget, and no prices are extracted for caching, forecasts or order execution. The component unmounts when its route loses focus or the app enters the background.

**Practice · simulated** opens the separate fixed-price virtual-order room. **Trade → Open custom analysis tools**, or **Analyse → Market outlooks & news**, opens the custom raw-feed workspace described below.

References: [TradingView widgets for apps](https://www.tradingview.com/widget-docs/getting-started/), [widget data availability](https://www.tradingview.com/widget-docs/faq/data/), [TradingView terms](https://www.tradingview.com/policies/), [Expo DOM components](https://docs.expo.dev/guides/dom-components/).

The custom workspace covers EUR/USD, GBP/USD, USD/JPY, BTC/USD, XAU/USD, WTI/USD and SPX/USD. Stars share the existing on-device watchlist with Trade. It provides quote cards, historical candles with OHLC inspection, timeframe controls, zoom/pan, news links, connection status and conditional technical scenarios.

## What works without provider access

**Try sample data** explicitly selects fixed synthetic fixtures. Every price, chart and outlook remains labelled sample. No provider requests run in this mode; sample values are not written to the provider cache. Sample mode has no fabricated news stories.

Inside the custom analysis workspace, **Provider data** is the default. With no backend URL on Android, it shows **Not connected**. With a backend but no enabled provider configuration, the API returns `503 NOT_CONFIGURED`. There is no automatic sample fallback.

Practice orders and portfolio calculations retain their existing fixed simulated prices. Research quotes do not revalue old practice positions or change order execution.

## Architecture

- `src/components/LiveMarkets.tsx`: optional provider-chart screen and practice entry.
- `src/components/ProviderChart.tsx` / `TradingViewWidget.tsx`: native wrapper and isolated web widget, fixed height, timeout/retry and attribution.
- `src/lib/providerCharts.ts`: explicit source/instrument mappings and fixed official URLs.

- `src/lib/marketTypes.ts`: normalized quotes, OHLC series, articles and resource states.
- `src/server/marketApi.ts`: server-only Twelve Data and Marketaux adapters. Imported only by `src/app/api/market+api.ts`.
- `src/lib/marketClient.ts`: bounded, versioned AsyncStorage cache, validation, request deduplication, timeouts and last-good-data recovery.
- `src/lib/marketProvider.tsx`: subscribed-resource loading and foreground checks. Polling stops on unmount/background, and resources are fetched automatically only after their TTL.
- `src/lib/marketAnalysis.ts`: explainable indicator rules, completed-candle checks and conditional scenarios.

`app.json` uses Expo SDK 58 `web.output: "server"` to export API routes. Android still needs a separately deployed HTTPS backend; an APK does not host this route. The existing hosted beta has not been updated with this endpoint by these local changes.

## Raw-feed access is still pending

No raw-feed accounts, paid plans, provider keys or deployment are created by this feature. The custom adapters are prepared for provider access; their presence does not grant a data licence. TradingView’s separate display widgets do not unlock raw prices, custom forecasts or news API access.

Twelve Data Basic currently allows 8 API credits/minute and 800/day, and its free offering is described for internal non-display use. Public mobile display, redistribution/caching and derived analysis require the appropriate permissions; commodity and index coverage may require additional access. Marketaux lists a free 100-request/day plan with three articles per request, but public/commercial usage must comply with its terms. A free API key alone is insufficient evidence of public-app rights.

References: [Twelve Data pricing](https://twelvedata.com/pricing), [Twelve Data terms](https://twelvedata.com/terms), [Marketaux pricing](https://www.marketaux.com/pricing), [Marketaux terms](https://www.marketaux.com/terms-and-conditions), [Expo API routes](https://docs.expo.dev/router/web/api-routes/).

When permitted access is available:

1. Configure **private server environment variables** `TWELVE_DATA_API_KEY` and/or `MARKETAUX_API_KEY`. Set `MARKET_DATA_DISPLAY_ALLOWED=1` only when the intended display, caching and analytics are permitted. The default remains disabled.
2. Verify the exact oil and index instruments and supply private `TWELVE_DATA_SYMBOLS_JSON` overrides for `WTI/USD` and `SPX/USD`. Spot oil, futures, cash indices, ETFs and CFDs differ. These two mappings intentionally have no default. The adapter rejects known stock/ETF and currency mismatches; entitlement and the remaining metadata still need verification with the provider.
3. Export and review the server bundle, then deploy to a supported server host. Preserve `/native-auth.html` and `/native-auth-return.js` when updating the existing authentication relay host. Do not upload the entire `.env.local` to EAS; it also contains unrelated authentication secrets.
4. Set the app's public `EXPO_PUBLIC_MARKET_API_URL` to the backend HTTPS origin or its full `/api/market` URL. It contains no provider credential. Web defaults to its own `/api/market` when this value is empty. Android requires this setting in its next build/update.
5. Verify one entitled instrument end to end, including market time, price precision, OHLC and news attribution, before enabling the rest.

The private gate is an operator acknowledgement, not an automated entitlement check. Never prefix a provider key with `EXPO_PUBLIC_` or import a server adapter into a screen.

## API and limits

`GET /api/market?kind=quote&symbol=EUR%2FUSD`

`GET /api/market?kind=candles&symbol=EUR%2FUSD&timeframe=1h`

`GET /api/market?kind=news&symbol=EUR%2FUSD`

Timeframes: `1m`, `5m`, `15m`, `1h`, `4h`, `1D`. Only the seven canonical symbols are accepted. Success is `{ data, cache: { hit, expiresAt } }`; failure is `{ error: { code, message } }`. Provider messages and keys are not echoed. Timeouts are ten seconds. HTTP/JSON provider rate limits are normalized to 429 and the server returns `Retry-After`.

Prices/candles have a 15-minute cache TTL; news has one hour. These are deliberately conservative polling intervals, not a real-time streaming service. A quote's source timestamp is distinct from the time the app checked it. Data is labelled reference or delayed unless a future integration can establish real-time entitlements.

Server caching is bounded to 128 entries with in-flight deduplication. Per-worker counters cap prices at 8 requests/minute and 800/day, and news at 8/minute and 100/day. **Workers, restarts and deployments do not share these counters.** Before enabling a public feed at scale, add a durable shared quota/cache and appropriate endpoint abuse controls; these local guards do not guarantee an account-wide quota or hosting budget. No paid overage or billing setup has been enabled.

The separate device cache `pipwise.market.v1` stores at most 128 entries, validates persisted/provider data, and is tied to the backend endpoint. Corruption discards only market cache data, preserving watchlists, wallet and learning progress. Failed refreshes retain and label the last good values. Connection state describes feed reachability, not the phone's overall internet connection.

## Outlook methodology

The engine requires at least 60 completed candles and calculates SMA-seeded EMA20/50, Wilder RSI14, MACD12/26/9 and Wilder ATR14. It rejects malformed, duplicate, unordered and future bars. Trend and momentum alignment determines a descriptive bullish, bearish or mixed state. The prior 20 bars, excluding the latest analysed bar, define conditional breakout levels. ATR describes volatility; it is not a price target.

For intraday series, timestamps are UTC bar opens and unfinished bars are excluded. Provider daily dates are chart-date anchors rather than exact exchange-session open/close instants. Daily analysis conservatively excludes the latest daily bar until session-boundary metadata is available. Daily dates shown by the UI must not be interpreted as an exact execution timestamp.

Real series become unsuitable for a current outlook after `max(3 × timeframe, 30 minutes)` from the completed period. Market closures can therefore suppress an outlook; they do not fabricate fresh data. Only explicit sample mode bypasses that freshness check.

News displays related provider-search headlines from the previous 72 hours with publisher, publication time and original HTTPS link. Entity sentiment is attached only to an appropriately matched entity and is attributed to that entity. A positive USD story is not mechanically converted into a bearish EUR/USD forecast. Article tone cannot change the technical bias. No article body is republished.

This is an uncalibrated rules engine, not a trained price-prediction model. No success probabilities, future prices, accuracy claims or causal news forecasts are invented. Backtesting, calibrated forecasts and complete fundamental coverage remain future work.

## Verification

```bash
pnpm lint
pnpm typecheck
node --test tests/*.test.cjs
pnpm exec expo export --platform web
pnpm exec expo export --platform android
```

Tests use injected clocks/storage/fetch responses and make no paid provider calls. Check sample/provider switching, shared stars, empty watchlists, every timeframe, OHLC inspection and zoom/pan on an Android phone. With an entitled test feed, additionally verify successful data, expiry, airplane-mode recovery, malformed data and quota responses. Widget interaction still needs a physical-device check. End-to-end custom raw-feed checks remain pending provider access.

Release validation on 2026-11-05 passed lint, TypeScript, all 45 regression test files, all 20 Expo Doctor checks, Android/Expo DOM export and the web/server export. SDK 58 dependencies were updated through Expo's installer and verified with a clean frozen-lockfile install. Exported API routes were executed directly; private requests require sign-in and disabled raw-feed resources return 503. Client/upload scans found no configured private credentials. The authentication return files match their sources.

The updated browser beta is deployed at https://pipwise--beta.expo.app. Live checks confirm the intended release bundle, protected account/feedback routes, unchanged OAuth return assets and disabled automatic AI/raw-feed gates. No model request or paid provider integration was activated. Physical-device interaction and live-provider checks remain pending.

The optional TradingView display was previously checked visually for all seven mapped instruments. SP:SPX and TVC:SPX rejected embedding; FOREXCOM:SPX500 is used with an explicit CFD reference label. Sign-up, profile and Chart coach actions have mocked-account regression coverage. These checks do not replace physical-device widget, picker, order gesture and real-account verification checks.

The moving demo, account details, free local studies, manual ChatGPT handoff and disabled optional photo-review adapters are documented in [ACCOUNT_AND_CHART_COACH.md](ACCOUNT_AND_CHART_COACH.md). Install the newly rebuilt Android APK for the file picker's native module and updated SDK dependencies; Metro reload alone does not update an installed native app.
