# Android release artifact verification — 10 November 2026

Latest artifacts verified on **10 November 2026 (Africa/Addis_Ababa)**. These checks establish selected properties of the downloaded artifacts; they do not approve a production release. See [FINAL_RELEASE_STATUS.md](FINAL_RELEASE_STATUS.md) for deployment prerequisites and current device acceptance.

## Current preview APK — build 10

EAS reports [build d0b9c653-b346-42bf-be36-850f96c0014d](https://expo.dev/accounts/natananse/projects/pipwise/builds/d0b9c653-b346-42bf-be36-850f96c0014d) as **FINISHED**, completed **10 November 2026, 11:51:56 Africa/Addis_Ababa** (`2026-11-10T08:51:56.403Z`). Download the [preview APK](https://expo.dev/artifacts/eas/SiUgkTm_wLmFtk8UiLlSHfjqQpph_-J_Mclhy3VDofg.apk).

| Property | Verified preview APK |
| --- | --- |
| Profile / distribution | `preview` / internal |
| Submitted source | Base commit `f7288c352c36bfac404682ff9cd8fc81ffe032ed` **with working-tree changes**; this is not a clean-checkout build of that commit |
| Package | `io.pipwise.app` |
| Version / manifest versionCode | `1.0.0` / **10** |
| File size | 106,857,459 bytes |
| Minimum / target Android API | 24 / 36 |
| Debuggable | false |
| APK signature verification | Passed; certificate SHA-256 matches historical APK 8 and AAB 9 below |
| 16KB ZIP alignment | Passed |
| Native libraries | 25 per ABI; `arm64-v8a` **25/25** and `x86_64` **25/25** pass the 16KB ELF checks |
| 32-bit ELF caveat | `armeabi-v7a` and `x86` each pass **7/25**; the other 18 libraries per ABI retain 4KB alignment |

```text
APK SHA-256: f7dc4758c5c7343e9d1e0c1faba7c0ca20b0180d09746316cebb06de5d2c8d12
Compiled bundle SHA-256: f0289efad360817049dbc995437a5c90ad1ac2956b6985324891d13214af60ba
Compiled bundle size: 7,303,240 bytes
Signer certificate SHA-256: 7e3f2f90c186eace472216f9c904e76d6a8290cb188c88e7ea0066e85f6f1c24
```

The compiled bundle differs from APK 8. The manifest requests the same six permissions enumerated in the historical manifest section below. The packaged-asset scan found zero PostgreSQL credential URI shapes; this remains a narrow pattern check, not a comprehensive secret audit.

The submitted-source record preserves these selected file SHA-256 values:

| File | SHA-256 at submission |
| --- | --- |
| `src/app/(tabs)/practice.tsx` | `3aefda7903c76ec46c1e6132417a750a9c80c76aa44a8d35fbfcefdc17e1ce74` |
| `src/components/FloatingTabBar.tsx` | `48d8ec59db5e14e176f89bddb46f0b599b63274e3578064e41c808ed009f6345` |
| `src/components/InteractiveChartPlot.tsx` | `9c0e5df089204a356d8ea9d3964ad88bd80721156423e2d26d91dfb7b89b6743` |
| `src/components/TradingChart.tsx` | `b5d7a6a6fac704dbf60f1dba4f3cd457fb95f86146ca200d6f5fe53f033bb94f` |
| `src/lib/navigation.ts` | `867a7ca236832101e0f0928d25ecb56337aab611335a210907fcdd29729599ca` |
| `package.json` | `2430fafa44235cba53a22d8f769b0731e5a49bf64234faf61abd650bf6d1cfa7` |
| `pnpm-lock.yaml` | `3893e3592bfb136ca8e4cecc37e43aa03329962ffd9024d3dfd7148c6c67ed7b` |

Local evidence is recorded in `/tmp/pipwise-preview10-audit.json` and `/tmp/pipwise-preview10-source.json`. These static checks do **not** establish that APK 10 is installed, accepted on an emulator or phone, compatible with a completed backend cutover, or approved for Play. The earlier emulator smoke test applies only to APK 8.

## Current production candidate AAB — build 11

EAS reports [build 56b3c615-4c57-4b4c-88b8-a07bed13ef6a](https://expo.dev/accounts/natananse/projects/pipwise/builds/56b3c615-4c57-4b4c-88b8-a07bed13ef6a) as **FINISHED**, completed **10 November 2026, 12:06:47 Africa/Addis_Ababa** (`2026-11-10T09:06:47.328Z`). Download the [production candidate AAB](https://expo.dev/artifacts/eas/6uYDi2HwfOdQiqdsDUXiJ8AE6PngqpC96LSkNZ1JAdI.aab).

| Property | Verified production candidate AAB |
| --- | --- |
| Profile / distribution | `production` / store |
| Submitted source | Base commit `f7288c352c36bfac404682ff9cd8fc81ffe032ed` **with working-tree changes**; this is not a clean-checkout build of that commit |
| Package | `io.pipwise.app` |
| Version / manifest versionCode | `1.0.0` / **11** |
| File size | 74,438,577 bytes |
| Minimum / target Android API | 24 / 36 |
| Debuggable / testOnly | false / false |
| Requested permissions | Same six permissions as APK 10; no additional permissions |
| Bundle validation | bundletool **1.18.3** passes |
| Signing | `jarsigner` passes; all **1,430** payload entries have signed manifest digests; **0** unsigned payload entries |
| Certificate | SHA-256 matches APK 10 and historical APK 8/AAB 9 |
| BundleConfig | Requests `PAGE_ALIGNMENT_16K` |
| Native libraries | 25 per ABI; `arm64-v8a` **25/25** and `x86_64` **25/25** pass 16KB ELF alignment and offset/address congruence checks |
| 32-bit ELF caveat | `armeabi-v7a` and `x86` each pass **7/25**; the other 18 libraries per ABI retain 4KB alignment |
| Compiled application bundle | Identical bytes to APK 10; **7,303,240** bytes |

```text
AAB SHA-256: c0e9abb59e57f069b60e6f2a77a624edf7bc3668c983f12158a0fc9ad5767c33
Compiled bundle SHA-256: f0289efad360817049dbc995437a5c90ad1ac2956b6985324891d13214af60ba
Signer certificate SHA-256: 7e3f2f90c186eace472216f9c904e76d6a8290cb188c88e7ea0066e85f6f1c24
```

The narrow credential-URI scan checked **934** packaged asset/text entries in ASCII/UTF-8 and UTF-16LE/BE and found **0** PostgreSQL user-info URI shapes. No matching values or asset contents were logged; this is not a comprehensive secret audit. Signature verification records the existing self-signed-certificate and missing-timestamp warnings. Google Play's eventual app-signing certificate, generated splits and device runtime remain separate acceptance work.

Local evidence is saved in `/tmp/pipwise-production11-audit.json`; the downloaded artifact is `/tmp/pipwise-production-build11.aab`. The same local bundletool, signing and ELF commands below can be repeated with that path. These checks do **not** establish installation or acceptance on an emulator or physical phone, compatible live service configuration, or Play eligibility. No application submission or publication was performed by this artifact audit.

## Historical artifacts — APK 8 and AAB 9

The following artifact checks were recorded on **9 November 2026** and remain separate from current APK 10 and AAB 11.

EAS status metadata reports both builds as `FINISHED`. The completion dates below use Africa/Addis_Ababa time.

| Property | Preview APK | Production candidate AAB |
| --- | --- | --- |
| EAS build | [7cb6a82c-1228-47cd-a6b9-4fcb3eaae214](https://expo.dev/accounts/natananse/projects/pipwise/builds/7cb6a82c-1228-47cd-a6b9-4fcb3eaae214) | [ea94cdee-66de-40a1-a4d3-15963e51fcb3](https://expo.dev/accounts/natananse/projects/pipwise/builds/ea94cdee-66de-40a1-a4d3-15963e51fcb3) |
| Download | [APK](https://expo.dev/artifacts/eas/2mwDFkDLTEmhod_J-nlP-XuvjrN7X1N0HPxvnbdTrzI.apk) | [AAB](https://expo.dev/artifacts/eas/0s__A6w6wvlq2Bc1ILMnNavm1aRJODce7j-_b-AmaA8.aab) |
| Profile / distribution | `preview` / internal | `production` / store |
| Source commit | `331c1aa93f967d485c1c7f85e55892285bdcfae9` | `9a9496ed595404549495dc6d9f371b7b03502ed3` |
| Completed | 8 November, 00:57:42 | 8 November, 01:09:34 |
| Package | `io.pipwise.app` | `io.pipwise.app` |
| Version / actual versionCode | `1.0.0` / **8** | `1.0.0` / **9** |
| File size | 106,857,099 bytes | 74,438,107 bytes |
| Minimum / target Android API | 24 / 36 | 24 / 36 |
| Debuggable / testOnly | false / false | false / false |

Exact file SHA-256 values:

```text
APK 485da5f85ee38607b61603339ea5d22170f194df63bba37a39103e470b63285f
AAB 38df5193b57cdb2e7e2c75912f56ea83c20d0291787a99b22ff66b32491896d3
```

The APK's `assets/index.android.bundle` and AAB's `base/assets/index.android.bundle` are identical: **7,302,880 bytes**, SHA-256 `5484b2d0e6771d0761afec3899e806742546687f9b23f48113520a459dedb79a`. Both contain the `Trade UI:` and `Rotate 1` markers. This compares compiled application bundles; it does not establish that either artifact is installed on a physical phone.

## Historical manifest, signing and native libraries

- Both manifests request only `android.permission.ACCESS_NETWORK_STATE`, `android.permission.INTERNET`, `android.permission.VIBRATE`, `com.android.vending.BILLING`, `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` and the app's signature-protected `io.pipwise.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. No storage, overlay, biometric/fingerprint or advertising-ID permissions were found.
- Android build-tools **37.0.0** verified the APK signature (v2) and `zipalign -c -P 16 4` passed. The APK's launch activity requests portrait.
- **bundletool 1.18.3** validated the AAB. Its `BundleConfig` requests `PAGE_ALIGNMENT_16K`. `jarsigner` verified its signature; all **1,430** payload entries are covered by signed manifest digests. Self-signed certificate and missing timestamp warnings were observed; signature verification still passed.
- The AAB and APK use the same certificate SHA-256: `7e3f2f90c186eace472216f9c904e76d6a8290cb188c88e7ea0066e85f6f1c24`. This verifies the inspected upload/direct-install signer. Google Play's eventual app-signing certificate was not checked.
- Each artifact has **25 native libraries in each of four ABIs**. Every ELF `LOAD` segment in `arm64-v8a` and `x86_64` has alignment of at least **16,384 bytes**, with file offset and virtual address congruent modulo 16,384. All **50/50 64-bit libraries** pass those static checks.
- **32-bit caveat:** in each of `armeabi-v7a` and `x86`, 18 of 25 libraries retain 4KB `LOAD` alignment. Do not describe these artifacts as having all-ABI 16KB ELF alignment. No 16KB-page-size device runtime test was performed by this artifact check.
- A narrow packaged-text scan found zero PostgreSQL credential URI shapes in the inspected assets/text: 908 APK entries and 934 AAB entries, checking ASCII/UTF-8 and UTF-16LE/BE. This is not a comprehensive secret audit.

## Reproduce the historical artifact checks locally

These commands inspect local artifacts without changing cloud builds, a deployment or Play Console. Keep downloaded artifacts under `/tmp`; substitute their paths if needed. The paths below match tools available on the verification machine. The bundletool JAR SHA-256 was `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`.

```bash
sha256sum /tmp/pipwise-final-release.apk /tmp/pipwise-final-release.aab
/home/natnael/Android/Sdk/build-tools/37.0.0/aapt dump badging /tmp/pipwise-final-release.apk | rg '^(package:|sdkVersion:|targetSdkVersion:|uses-permission:|application-debuggable)'
/home/natnael/Android/Sdk/build-tools/37.0.0/apksigner verify --verbose --print-certs /tmp/pipwise-final-release.apk
/home/natnael/Android/Sdk/build-tools/37.0.0/zipalign -c -P 16 4 /tmp/pipwise-final-release.apk
java -jar /tmp/bundletool-all-1.18.3.jar validate --bundle=/tmp/pipwise-final-release.aab
java -jar /tmp/bundletool-all-1.18.3.jar dump manifest --bundle=/tmp/pipwise-final-release.aab --module=base
java -jar /tmp/bundletool-all-1.18.3.jar dump config --bundle=/tmp/pipwise-final-release.aab
jarsigner -verify /tmp/pipwise-final-release.aab
keytool -printcert -jarfile /tmp/pipwise-final-release.aab
```

Compare compiled bundles and repeat the ELF checks with Python and system `readelf`. This writes only temporary extracted libraries, then removes them:

```bash
python3 - <<'PY'
import collections, hashlib, pathlib, subprocess, tempfile, zipfile

for artifact in ('/tmp/pipwise-final-release.apk', '/tmp/pipwise-final-release.aab'):
    counts = collections.defaultdict(lambda: [0, 0])
    with zipfile.ZipFile(artifact) as archive, tempfile.TemporaryDirectory() as scratch:
        for name in archive.namelist():
            if name.endswith('index.android.bundle'):
                data = archive.read(name)
                print(artifact, name, len(data), hashlib.sha256(data).hexdigest())
            if not name.endswith('.so'):
                continue
            parts = name.split('/')
            abi = parts[parts.index('lib') + 1]
            extracted = pathlib.Path(scratch) / 'library.so'
            extracted.write_bytes(archive.read(name))
            output = subprocess.check_output(['readelf', '-lW', str(extracted)], text=True)
            segments = [line.split() for line in output.splitlines()
                        if line.split() and line.split()[0] == 'LOAD']
            passed = bool(segments) and all(
                int(row[-1], 16) >= 16384 and
                (int(row[1], 16) - int(row[2], 16)) % 16384 == 0
                for row in segments)
            counts[abi][0] += 1
            counts[abi][1] += int(passed)
        print(artifact, 'ABI: [libraries, 16KB ELF passes]', dict(counts))
PY
```

Selected-metadata reports from this session are `/tmp/pipwise-nov9-apk-audit.json` and `/tmp/pipwise-nov9-aab-audit.json`. Those temporary reports and inspection scripts are local evidence, not committed dependencies.

## Remaining acceptance

This static report does not establish a compatible deployed backend, completed database-role cutover, working retention schedule, real-account flows, physical-device acceptance or Google Play approval. A separate [partial native smoke test](ANDROID_NATIVE_SMOKE_TEST.md) installed APK 8 on a 16KB x86_64 Android emulator; it does not establish APK 10 or AAB 11 acceptance. Arm64 hardware and Play-generated split alignment/runtime remain unverified. Check the current [release status](FINAL_RELEASE_STATUS.md) and [phone checklist](TRADING_ROTATION.md#phone-acceptance). Before any Play upload, compare the actual candidate versionCode with every code previously uploaded to this Play app; the higher local/EAS code alone cannot prove Play eligibility. No Play upload or publication was performed as part of these checks.
