# Google Play listing assets

| File | Format | Source |
| --- | --- | --- |
| `feature-graphic.png` | 1024 × 500, 24-bit RGB PNG; no alpha | Original `feature-graphic.svg` below |
| `feature-graphic.svg` | Editable 1024 × 500 vector | Original grid, ring, candles and typesetting created for PipWise; no app screenshot or third-party illustration |
| `store-icon.png` | 512 × 512, 32-bit RGBA PNG; 216,321 bytes | Technical export of the existing `../android-icon-backgrounds.png` through the installed `@expo/image-utils` asset pipeline; source artwork unchanged |

The feature graphic uses `#F7F5EF`, `#202622` and `#C8F169`. Text uses the installed `@expo-google-fonts/manrope` 700 Bold and 800 ExtraBold TTF files, licensed under the package's `LICENSE_FONT` (SIL Open Font License 1.1). Install/load those fonts when editing the SVG to preserve its typography.

The PNG was rendered from the SVG with `@resvg/resvg-js` 2.6.2, loading those two local font files with system fonts disabled. Its fully opaque RGBA output was exported as RGB PNG. Rendering tooling was installed only in `/tmp`; app dependencies and lockfiles were unchanged. See the renderer's [documented font-loading API](https://github.com/thx/resvg-js#nodejs).

Upload the PNG, not the SVG, as the feature graphic. This is a promotional illustration and does **not** replace store screenshots. Capture at least two real app screenshots from the final release build, with no fabricated UI or unsupported claims. Google documents the [listing image and screenshot specifications](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).

Native QA captures from APK **1.0.0 / code 8** are preserved in [qa/2026-11-09](qa/2026-11-09/), with original/saved SHA-256 values in [captures.json](qa/2026-11-09/captures.json). The 1080×2400 / 2400×1080 captures are for QA evidence, not Play upload. See the [native smoke-test report](../../docs/ANDROID_NATIVE_SMOKE_TEST.md) for observed results and remaining acceptance.

Four actual **1080×1920 RGB** product screenshot candidates and a Settings version-evidence image are in [screenshots](screenshots/README.md). They show real Trade, order review, Learn and Analyse UI from installed APK 8; capture details, hashes and layout limitations are recorded there. Complete native acceptance before selecting/uploading the final listing images.
