const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return module.exports;
}

const { formatBuildIdentity, TRADE_UI_MARKER } = load('src/lib/buildIdentity.ts');
const native = { platform: 'android', executionEnvironment: 'standalone', nativeVersion: '1.2.3', nativeBuild: '17' };

test('installed Android and iOS builds show native binary values and the exact UI marker', () => {
  assert.equal(TRADE_UI_MARKER, 'Trade UI: Bright 1');
  for (const platform of ['android', 'ios']) {
    const result = formatBuildIdentity({ ...native, platform });
    assert.equal(result.marker, 'Trade UI: Bright 1');
    assert.equal(result.details, 'App version: 1.2.3 · Build: 17');
    assert.equal(result.preview, false);
  }
});

test('missing or blank native metadata is honest and each field falls back independently', () => {
  assert.equal(formatBuildIdentity({ ...native, nativeVersion: null }).details, 'App version: Unknown · Build: 17');
  assert.equal(formatBuildIdentity({ ...native, nativeBuild: null }).details, 'App version: 1.2.3 · Build: Unknown');
  assert.equal(formatBuildIdentity({ ...native, nativeVersion: '  ', nativeBuild: '' }).details, 'App version: Unknown · Build: Unknown');
  assert.equal(formatBuildIdentity({ ...native, nativeVersion: ' 1.2.3 ', nativeBuild: ' 0017 ' }).details, 'App version: 1.2.3 · Build: 0017');
});

test('browser and Expo Go previews cannot present the host native metadata as PipWise build identity', () => {
  for (const input of [
    { ...native, platform: 'web' },
    { ...native, executionEnvironment: 'storeClient' },
    { ...native, platform: 'unsupported' },
  ]) {
    const result = formatBuildIdentity(input);
    assert.equal(result.preview, true);
    assert.match(result.details, /^Preview · /);
    assert.ok(!result.details.includes('1.2.3'));
    assert.ok(!result.details.includes('17'));
  }
  assert.equal(formatBuildIdentity({ ...native, platform: 'web' }).details, 'Preview · Browser');
  assert.match(formatBuildIdentity({ ...native, executionEnvironment: 'storeClient' }).details, /Expo Go/);
});

function component(platform, executionEnvironment, version, build) {
  return load('src/components/BuildIdentity.tsx', {
    react: { ...React, default: React },
    'expo-application': { nativeApplicationVersion: version, nativeBuildVersion: build },
    'expo-constants': { __esModule: true, default: { executionEnvironment, expoConfig: { version: 'CONFIG_VERSION', android: { versionCode: 999 } } } },
    'react-native': { Platform: { OS: platform }, View: 'View' },
    '../lib/buildIdentity': { formatBuildIdentity },
    './design': { Label: 'Label' },
  }).BuildIdentity();
}

test('Settings marker component reads expo-application values rather than config or OTA versions', () => {
  const tree = component('android', 'standalone', '2.0.1', '27');
  assert.equal(tree.props.children[0].props.children, 'Trade UI: Bright 1');
  assert.equal(tree.props.children[1].props.children, 'App version: 2.0.1 · Build: 27');
  assert.equal(component('android', 'standalone', null, null).props.children[1].props.children, 'App version: Unknown · Build: Unknown');
  assert.equal(component('web', 'standalone', 'EXPO_HOST', '999').props.children[1].props.children, 'Preview · Browser');
  assert.equal(component('android', 'storeClient', 'EXPO_HOST', '999').props.children[1].props.children, 'Preview · Expo Go / development client');
});
