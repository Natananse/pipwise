# Google Play listing assets

| File | Format | Source |
| --- | --- | --- |
| `feature-graphic.png` | 1024 × 500, 24-bit RGB PNG; no alpha | Original `feature-graphic.svg` below |
| `feature-graphic.svg` | Editable 1024 × 500 vector | Original grid, ring, candles and typesetting created for PipWise; no app screenshot or third-party illustration |
| `store-icon.png` | 512 × 512, 32-bit RGBA PNG; 216,321 bytes | Technical export of the existing `../android-icon-backgrounds.png` through the installed `@expo/image-utils` asset pipeline; source artwork unchanged |

The feature graphic uses `#F7F5EF`, `#202622` and `#C8F169`. Text uses the installed `@expo-google-fonts/manrope` 700 Bold and 800 ExtraBold TTF files, licensed under the package's `LICENSE_FONT` (SIL Open Font License 1.1). Install/load those fonts when editing the SVG to preserve its typography.

The PNG was rendered from the SVG with `@resvg/resvg-js` 2.6.2, loading those two local font files with system fonts disabled. Its fully opaque RGBA output was exported as RGB PNG. Rendering tooling was installed only in `/tmp`; app dependencies and lockfiles were unchanged. See the renderer's [documented font-loading API](https://github.com/thx/resvg-js#nodejs).

Upload the PNG, not the SVG, as the feature graphic. This is a promotional illustration and does **not** replace store screenshots. Capture at least two real app screenshots from the final release build, with no fabricated UI or unsupported claims. Google documents the [listing image and screenshot specifications](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
