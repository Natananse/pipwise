# Android edge-to-edge: Stage 1 phone acceptance

Stage 1 covers system bars, safe areas, floating dock clearance and keyboard handling. Stage 2 (bright surfaces, theme tokens and redesign) is waiting for the owner's APK test. Existing screen palettes, tab names, lesson content and simulator calculations stay as they were.

## What changed

- SDK 58 official `expo-status-bar`, `expo-navigation-bar` and `expo-system-ui` configuration. Bars stay visible; the three-button contrast scrim is disabled so existing screen backgrounds extend beneath transparent bars. No obsolete edge-to-edge toggle or hand-edited native files.
- Focused routes own icon contrast. Dark headers can use light status icons with dark navigation buttons over a light bottom surface. Startup covers have priority even if a route finishes loading underneath them. Profile switches status icons after its full dark hero scrolls away.
- Shared bottom spacing distinguishes tab docks from standalone pages and wide side rails. Floating footers reserve their measured height and the actual system inset. Existing cutout/side padding is retained or completed.
- Forms use one keyboard-avoidance layer on both native platforms, with scrollable fields/actions and no second automatic keyboard inset. Sheets have their own native safe-area measurement; web retains its existing provider. The floating dock hides while the native keyboard is open and returns on dismissal.

The launch animation file, artwork, timing and reduced-motion behavior are unchanged. Onboarding's only direct change is its system-bar controller; its styles, ten languages/Arabic RTL, questions, save/back/resume/retry/version behavior are unchanged. Startup's only direct change marks its existing cover as the system-bar owner. Existing preference persistence, startup and simulator tests were not edited. Some other test fixtures gained mocks for the new presentation components; their assertions remain intact.

Sources checked for Expo 58: [system bars](https://docs.expo.dev/develop/user-interface/system-bars/), [NavigationBar](https://docs.expo.dev/versions/v58.0.0/sdk/navigation-bar/), [safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/), [keyboard handling](https://docs.expo.dev/guides/keyboard-handling/). Native keyboard behavior and OEM system bars still need a physical phone; JavaScript checks do not certify their appearance.

## Build and install

1. Run the checks below, then start a standalone preview build:

   ```bash
   pnpm beta:android
   ```

2. Open the EAS build link on your phone, download its APK and install it over the previous beta. Keep your current app data to test returning-user behavior. This APK runs without a cable or Metro after installation; online features still use the internet.
3. Check the native splash → animated welcome handoff in the new APK. Expo Go, a web preview, an old APK and a JavaScript reload cannot verify the changed native bar plugins. No native splash image, color, size or resize mode was changed.
4. For first-launch testing, use another test device or clear only a disposable test installation's app data. Clearing app data removes local demo wallet and lesson progress; do not use your only saved installation for that test.

EAS uses remote Android versioning and automatic increments. Before a store build, verify the effective versionCode is higher than the previous Play upload; local `app.json` alone is not authoritative. No Play upload or new release is part of this stage.

## Required checks

```bash
pnpm lint
pnpm typecheck
node --test tests/*.test.cjs
pnpm dlx expo-doctor
```

New regression coverage checks focused/blurred bars, startup cover priority, mixed dark-header/light-bottom icons, web isolation, modal ownership, route-aware clearance, measured footers, Profile's top-surface boundary, and native keyboard avoidance.

## Phone checklist

- [ ] First launch: native icon hands off smoothly to the same logo reveal, lime orbits and market artwork, then language selection. Animation fills the window with no visible bars/gaps. Repeat with reduced motion enabled.
- [ ] Language selection includes all ten languages; check Arabic RTL. Answer experience, markets and goals in that order. Go back and verify saved answers.
- [ ] Close the app midway through setup and reopen it: resume at the saved step. If a save fails, retry without losing answers. Check the existing retry screen if startup fails.
- [ ] Finish setup. Test Replay onboarding and Settings → Onboarding questions independently.
- [ ] Cold-start as a returning signed-in or demo user: expected destination, wallet and learning progress. Sign-out/account access still works. Release APK returning behavior differs from development's intentional onboarding preview.
- [ ] Repeat using gesture navigation and three-button navigation. Check status/navigation icons on dark Trade/Markets, light legal/auth pages, mixed shared headers, and Profile before/after scrolling its hero away.
- [ ] Check a camera cutout and small/tall screen. Scroll every main tab and standalone page to its final action; nothing should sit beneath the dock or bottom system inset. Repeat at large text size.
- [ ] Open login/signup/reset, feedback, public account deletion, Chart coach notes/CSV, profile/contact editors, practice search and order quantity/stop/take-profit. Focus the last field, scroll to submit, open/close the keyboard and press Android Back. No covered actions, double movement or stuck dock.
- [ ] Open and close a sheet over dark and light screens. Check its cutout spacing and bottom buttons; verify route icon colors return afterward.
- [ ] Change the device's light/dark setting, rotate and return from the authentication browser/background. Existing screen themes and portrait orientation remain stable; bars stay visible and readable.
- [ ] Public `/privacy-policy` and `/delete-account` stay accessible without completing onboarding. Purchase/restore controls and deletion confirmation remain reachable.

There is no full-screen chart route yet. Immersive chart behavior will be implemented and tested in its separately approved stage; this stage keeps system bars visible throughout.

Record phone model, Android version, navigation mode and any screen with a problem before approving Stage 2.
