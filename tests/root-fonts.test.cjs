const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

test('root registers the icon font before the first font-dependent SSR markup', () => {
  const registered = new Map();
  const passthrough = ({ children }) => React.createElement('div', null, children);
  const iconFont = { ionicons: 'ionicons-font-asset' };
  const imports = {
    react: { ...React, default: React },
    '@expo/vector-icons': { Ionicons: { font: iconFont } },
    'expo-font': { useFonts(map) { for (const [key, value] of Object.entries(map)) registered.set(key, value); return [true, null]; } },
    'expo-router': { Slot: () => React.createElement('span', { 'data-icon': true }, registered.has('ionicons') ? '\uf100' : ''), useRouter: () => ({}), useSegments: () => ['(tabs)'] },
    'expo-splash-screen': { preventAutoHideAsync: async () => {}, hide() {} },
    'react-native': { View: passthrough, StyleSheet: { absoluteFill: {} } },
    'react-native-safe-area-context': { SafeAreaProvider: passthrough, SafeAreaView: passthrough },
    '../components/LaunchSplash': { LaunchSplash: () => null },
    '../components/WelcomeArtwork': { WelcomeArtwork: () => null },
    '../components/OrientationCoordinator': { OrientationCoordinator: () => null, OrientationScope: () => null, PortraitRouteGuard: passthrough, PortraitStartupGate: passthrough },
    '../components/design': { AppButton: () => null, Label: passthrough },
    '../lib/onboarding': { hasCompleteOnboardingAnswers: () => true },
    '../lib/session': { SessionProvider: passthrough, useSession: () => ({ ready: true, demo: true, onboarded: true }) },
    '../lib/startup': { startupRedirect: () => null },
    '../lib/persistence': { resumePersistenceAfterAccountDeletion() {} },
    '../lib/theme': { ThemeProvider: passthrough, ThemeSurface: passthrough },
    '../lib/workspace': { CURRENT_ONBOARDING_VERSION: 1, WorkspaceProvider: passthrough, useWorkspace: () => ({ loaded: true, language: 'en', preferences: {}, onboardingVersion: 1 }) },
    '../lib/demoMarketProvider': { DemoMarketProvider: passthrough, useDemoMarketStatus: () => ({ ready: true }) },
  };
  for (const [weight, name] of [['500Medium', 'Manrope_500Medium'], ['600SemiBold', 'Manrope_600SemiBold'], ['700Bold', 'Manrope_700Bold'], ['800ExtraBold', 'Manrope_800ExtraBold']]) imports[`@expo-google-fonts/manrope/${weight}`] = { [name]: `asset-${weight}` };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/_layout.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, {
    module, exports: module.exports, __DEV__: false,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  const html = renderToStaticMarkup(React.createElement(module.exports.default));
  assert.equal(registered.get('ionicons'), iconFont.ionicons);
  assert.equal(registered.size, 5, 'all four Manrope faces remain loaded with Ionicons');
  assert.ok(html.includes('\uf100'), 'a late icon CSS load must not change empty SSR text into a glyph during hydration');
});
