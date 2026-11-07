const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { AndroidConfig } = require('expo/config-plugins');

test('native launch starts portrait without changing rotation handling, keyboard flags or other activities', () => {
  let action;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('plugins/withPortraitLaunch.cjs', 'utf8'), { module, exports: module.exports,
    require(name) { assert.equal(name, 'expo/config-plugins'); return { AndroidConfig, withAndroidManifest(config, callback) { action = callback; return config; } }; } });
  const config = { name: 'PipWise', slug: 'pipwise', orientation: 'default' };
  assert.equal(module.exports(config), config);
  const activity = { $: { 'android:name': '.MainActivity', 'android:screenOrientation': 'unspecified', 'android:configChanges': 'keyboard|orientation|screenSize', 'android:windowSoftInputMode': 'adjustResize', 'android:exported': 'true' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }], category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }] }] };
  const other = { $: { 'android:name': '.AuthActivity', 'android:screenOrientation': 'unspecified' } };
  const manifest = { manifest: { application: [{ activity: [activity, other] }] } };
  const before = structuredClone(activity.$);
  assert.equal(action({ modResults: manifest }).modResults, manifest);
  assert.deepEqual(activity.$, { ...before, 'android:screenOrientation': 'portrait' });
  assert.equal(other.$['android:screenOrientation'], 'unspecified');
  action({ modResults: manifest });
  assert.equal(manifest.manifest.application[0].activity.length, 2);
  assert.equal(config.orientation, 'default');
});
