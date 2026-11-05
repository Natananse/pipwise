const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const checker = import('../scripts/check-beta.mjs');
const publicEnv = {
  EXPO_PUBLIC_NEON_AUTH_URL: 'https://ep-pipwise-test.neonauth.us-east-2.aws.neon.tech/neondb/auth',
  EXPO_PUBLIC_APP_API_URL: 'https://pipwise-beta.expo.app',
};
const app = {
  expo: {
    name: 'PipWise', slug: 'pipwise', version: '1.0.0', scheme: 'pipwise',
    android: { package: 'io.pipwise.app' }, ios: { bundleIdentifier: 'io.pipwise.app' },
    extra: { eas: { projectId: '12345678-1234-4234-8234-123456789abc' } },
  },
};
const releaseProfile = (distribution, environment) => ({
  distribution, environment, developmentClient: false,
  env: { EXPO_PUBLIC_PREVIEW_ONBOARDING: '0' },
});
const easFixture = () => ({
  cli: { appVersionSource: 'remote' },
  build: {
    preview: { ...releaseProfile('internal', 'preview'), android: { buildType: 'apk' } },
    testflight: releaseProfile('store', 'preview'),
    production: releaseProfile('store', 'production'),
  },
});

test('the checked-in profiles produce standalone Android and physical-device iOS distributions', async () => {
  const { checkBetaConfig } = await checker;
  const config = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  const actualApp = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  // EAS init adds the real project ID after login; other checked-in settings must be ready now.
  actualApp.expo.extra = { ...actualApp.expo.extra, eas: { projectId: app.expo.extra.eas.projectId } };
  for (const profile of ['preview', 'testflight', 'production']) {
    const result = checkBetaConfig({ appConfig: actualApp, easConfig: config, env: publicEnv, profile });
    assert.deepEqual(result.errors, [], `${profile}: ${result.errors.join('; ')}`);
  }
});

test('preflight catches a development APK, mismatched environment, or simulator-only iPhone build', async () => {
  const { checkBetaConfig } = await checker;
  const easConfig = easFixture();
  easConfig.build.preview.developmentClient = true;
  easConfig.build.preview.android = { buildType: 'app-bundle', gradleCommand: ':app:assembleDebug' };
  easConfig.build.preview.env.EXPO_PUBLIC_PREVIEW_ONBOARDING = '1';
  easConfig.build.preview.environment = 'production';
  const errors = checkBetaConfig({ appConfig: app, easConfig, env: publicEnv }).errors.join('\n');
  assert.match(errors, /standalone/);
  assert.match(errors, /buildType to apk/);
  assert.match(errors, /assembleRelease/);
  assert.match(errors, /returning-user/);
  assert.match(errors, /environment to preview/);
  easConfig.build.testflight.ios = { simulator: true };
  assert.match(checkBetaConfig({ appConfig: app, easConfig, env: publicEnv, profile: 'testflight' }).errors.join('\n'), /physical iPhones/);
});

test('Neon Auth and the application backend are required without a Data API', async () => {
  const { checkBetaConfig } = await checker;
  const check = env => checkBetaConfig({ appConfig: app, easConfig: easFixture(), env }).errors;
  assert.deepEqual(check(publicEnv), []);
  for (const name of Object.keys(publicEnv)) {
    assert(check({ ...publicEnv, [name]: '' }).some(error => error.includes(name)));
  }
  const obsolete = check({ EXPO_PUBLIC_SUPABASE_URL: 'https://old-project.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'old-public-key' });
  assert(obsolete.some(error => error.includes('EXPO_PUBLIC_NEON_AUTH_URL')));
  assert(obsolete.some(error => error.includes('EXPO_PUBLIC_APP_API_URL')));
  const fallback = { EXPO_PUBLIC_NEON_AUTH_URL: publicEnv.EXPO_PUBLIC_NEON_AUTH_URL, EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://pipwise-beta.expo.app/native-auth.html' };
  assert.deepEqual(check(fallback), []);
});

test('release endpoint checks reject local, insecure, placeholder, or credential-bearing URLs without printing them', async () => {
  const { checkBetaConfig } = await checker;
  const invalidUrls = [
    'http://ep-pipwise-test.neon.tech/neondb/auth', 'https://localhost/neondb/auth',
    'https://192.168.1.4', 'https://your-neon-auth-host/neondb/auth', 'https://example.com',
    'https://user:private-password@ep-pipwise-test.neon.tech/neondb/auth',
    'https://ep-pipwise-test.neon.tech/neondb/auth?token=private-token',
    'https://ep-pipwise-test.neon.tech/neondb/auth#private-token', 'not a URL', 42,
  ];
  for (const name of Object.keys(publicEnv)) {
    for (const url of invalidUrls) {
      const errors = checkBetaConfig({ appConfig: app, easConfig: easFixture(), env: { ...publicEnv, [name]: url } }).errors;
      assert(errors.some(error => error.includes(name) && error.includes('public HTTPS')));
      if (typeof url === 'string') assert.equal(errors.join('\n').includes(url), false, 'diagnostics must not print supplied values');
    }
  }
});

test('Auth URLs need the service path and explicit backend URLs need an origin', async () => {
  const { checkBetaConfig } = await checker;
  const check = env => checkBetaConfig({ appConfig: app, easConfig: easFixture(), env }).errors;
  for (const value of [new URL(publicEnv.EXPO_PUBLIC_NEON_AUTH_URL).origin, publicEnv.EXPO_PUBLIC_APP_API_URL, `${publicEnv.EXPO_PUBLIC_NEON_AUTH_URL}/callback`]) {
    const errors = check({ ...publicEnv, EXPO_PUBLIC_NEON_AUTH_URL: value });
    assert(errors.some(error => error.includes('EXPO_PUBLIC_NEON_AUTH_URL')));
    assert(!errors.join('\n').includes(value));
  }
  assert.deepEqual(check({ ...publicEnv, EXPO_PUBLIC_NEON_AUTH_URL: `${publicEnv.EXPO_PUBLIC_NEON_AUTH_URL}/` }), []);
  assert(check({ ...publicEnv, EXPO_PUBLIC_APP_API_URL: `${publicEnv.EXPO_PUBLIC_APP_API_URL}/api/feedback` }).some(error => error.includes('EXPO_PUBLIC_APP_API_URL')));
});

test('the selected EAS build environment overrides local Neon endpoints', async () => {
  const { checkBetaConfig } = await checker;
  const easConfig = easFixture();
  easConfig.build.preview.env.EXPO_PUBLIC_NEON_AUTH_URL = 'http://localhost/auth';
  const result = checkBetaConfig({ appConfig: app, easConfig, env: publicEnv });
  assert(result.errors.some(error => error.includes('EXPO_PUBLIC_NEON_AUTH_URL')));
  assert.equal(result.errors.some(error => error.includes('EXPO_PUBLIC_APP_API_URL')), false);
});

test('social login stays off by default and enabled providers require the deployed HTTPS return page', async () => {
  const { checkBetaConfig } = await checker;
  const check = env => checkBetaConfig({ appConfig: app, easConfig: easFixture(), env });
  assert(check(publicEnv).warnings.some(warning => warning.includes('disabled by default')));
  for (const flag of ['EXPO_PUBLIC_GOOGLE_AUTH_ENABLED', 'EXPO_PUBLIC_APPLE_AUTH_ENABLED']) {
    const enabled = { ...publicEnv, [flag]: '1' };
    assert(check(enabled).errors.some(error => error.includes('EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL')));
    const valid = check({ ...enabled, EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://pipwise--beta.expo.app/native-auth.html' });
    assert.deepEqual(valid.errors, []);
    assert(valid.warnings.some(warning => warning.includes('physical devices')));
    for (const invalid of ['true', 1, 'yes']) {
      assert(check({ ...publicEnv, [flag]: invalid }).errors.some(error => error.includes(flag)));
    }
  }
});

test('native social return URLs reject unsafe addresses and unexpected paths without exposing values', async () => {
  const { checkBetaConfig } = await checker;
  const invalidUrls = [
    '', 'http://pipwise--beta.expo.app/native-auth.html', 'pipwise://auth-callback',
    'https://localhost/native-auth.html', 'https://192.168.1.4/native-auth.html',
    'https://example.com/native-auth.html', 'https://pipwise--beta.expo.app/auth-callback',
    'https://pipwise--beta.expo.app/native-auth.html/other',
    'https://user:private-password@pipwise--beta.expo.app/native-auth.html',
    'https://pipwise--beta.expo.app/native-auth.html?token=private-token',
    'https://pipwise--beta.expo.app/native-auth.html#private-token', 42,
  ];
  for (const value of invalidUrls) {
    const errors = checkBetaConfig({
      appConfig: app, easConfig: easFixture(),
      env: { ...publicEnv, EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: '1', EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: value },
    }).errors;
    assert(errors.some(error => error.includes('EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL')));
    if (typeof value === 'string' && value) assert.equal(errors.join('\n').includes(value), false);
  }
});

test('iOS release profiles require Apple as an equivalent option when Google is enabled', async () => {
  const { checkBetaConfig } = await checker;
  const env = {
    ...publicEnv, EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: '1',
    EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://pipwise--beta.expo.app/native-auth.html',
  };
  for (const profile of ['testflight', 'production']) {
    const result = checkBetaConfig({ appConfig: app, easConfig: easFixture(), env, profile });
    assert(result.errors.some(error => error.includes('EXPO_PUBLIC_APPLE_AUTH_ENABLED') && error.includes('4.8')));
    assert.deepEqual(checkBetaConfig({ appConfig: app, easConfig: easFixture(), env: { ...env, EXPO_PUBLIC_APPLE_AUTH_ENABLED: '1' }, profile }).errors, []);
  }
  const easConfig = easFixture();
  easConfig.build.testflight.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED = '0';
  assert(checkBetaConfig({ appConfig: app, easConfig, env: { ...env, EXPO_PUBLIC_APPLE_AUTH_ENABLED: '1' }, profile: 'testflight' }).errors.some(error => error.includes('EXPO_PUBLIC_APPLE_AUTH_ENABLED')));
});

test('Android-only production supports Google without Apple and accepts explicit platform selection', async () => {
  const { checkBetaConfig } = await checker;
  const env = {
    ...publicEnv, EXPO_PUBLIC_GOOGLE_AUTH_ENABLED: '1', EXPO_PUBLIC_APPLE_AUTH_ENABLED: '0',
    EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://pipwise--beta.expo.app/native-auth.html',
  };
  const options = { appConfig: app, easConfig: easFixture(), env, profile: 'production' };
  assert.deepEqual(checkBetaConfig({ ...options, platform: 'android' }).errors, []);
  for (const platform of ['ios', 'all']) {
    assert(checkBetaConfig({ ...options, platform }).errors.some(error => error.includes('EXPO_PUBLIC_APPLE_AUTH_ENABLED')));
  }
  assert.deepEqual(checkBetaConfig({ ...options, profile: 'preview' }).errors, []);
});

test('unsupported target platforms are rejected with an actionable diagnostic', async () => {
  const { checkBetaConfig } = await checker;
  for (const platform of ['', 'web', 'constructor', '__proto__', 42]) {
    const result = checkBetaConfig({ appConfig: app, easConfig: easFixture(), env: publicEnv, platform });
    assert(result.errors.some(error => error.includes('android, ios, or all')));
  }
});

test('an unlinked Expo project gives concrete login/init instructions without an account lookup', async () => {
  const { checkBetaConfig } = await checker;
  const unlinked = structuredClone(app);
  delete unlinked.expo.extra;
  const result = checkBetaConfig({ appConfig: unlinked, easConfig: easFixture(), env: publicEnv });
  assert(result.errors.some(error => error.includes('eas-cli@latest login') && error.includes('eas-cli@latest init')));
  assert(result.warnings.some(warning => warning.includes('email delivery')));
});

test('unsupported profiles and malformed configuration produce actionable failures', async () => {
  const { checkBetaConfig } = await checker;
  for (const profile of ['unknown', 'constructor', '__proto__']) {
    assert(checkBetaConfig({ appConfig: app, easConfig: easFixture(), env: publicEnv, profile }).errors.some(error => error.includes('Choose the preview')));
  }
  const invalid = checkBetaConfig({ appConfig: null, easConfig: null, env: { EXPO_PUBLIC_NEON_AUTH_URL: 42 } });
  assert(invalid.errors.some(error => error.includes('app.json')));
  assert(invalid.errors.some(error => error.includes('EXPO_PUBLIC_NEON_AUTH_URL')));
});
