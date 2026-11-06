import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';

const profiles = {
  preview: { distribution: 'internal', environment: 'preview' },
  testflight: { distribution: 'store', environment: 'preview' },
  production: { distribution: 'store', environment: 'production' },
};
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function publicServiceUrl(value) {
  if (!nonempty(value)) return false;
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    // Release services use public DNS names, never a device/LAN address or IP literal.
    const local = isIP(hostname) !== 0 || !hostname.includes('.')
      || hostname === 'localhost' || hostname.endsWith('.localhost');
    const placeholder = /example\.(com|org|net)$|your[-_]?(project|neon)|<|>/i.test(url.hostname);
    return url.protocol === 'https:' && !local && !placeholder && !url.username && !url.password
      && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** Local release configuration checks. Never returns environment values. */
export function checkBetaConfig({ appConfig, easConfig, env = {}, profile = 'preview', platform } = {}) {
  const errors = [];
  const warnings = [];
  const app = isRecord(appConfig?.expo) ? appConfig.expo : {};
  const eas = isRecord(easConfig) ? easConfig : {};
  const expected = Object.hasOwn(profiles, profile) ? profiles[profile] : null;
  const build = isRecord(eas.build?.[profile]) ? eas.build[profile] : {};
  const targetPlatform = platform ?? (profile === 'testflight' ? 'ios' : profile === 'preview' ? 'android' : 'all');
  if (!['android', 'ios', 'all'].includes(targetPlatform)) errors.push('Choose the android, ios, or all target platform.');
  if (!expected) errors.push('Choose the preview, testflight, or production build profile.');
  if (!nonempty(app.extra?.eas?.projectId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(app.extra.eas.projectId)) {
    errors.push('Link this app to Expo: run pnpm dlx eas-cli@latest login, then pnpm dlx eas-cli@latest init to set expo.extra.eas.projectId.');
  }
  if (!nonempty(app.name) || !nonempty(app.slug) || !nonempty(app.version)) {
    errors.push('Set expo.name, expo.slug, and expo.version in app.json.');
  }
  const schemes = Array.isArray(app.scheme) ? app.scheme : [app.scheme];
  if (!schemes.includes('pipwise')) errors.push('Keep the pipwise URL scheme in app.json so account links can open the installed app.');
  if (!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(app.android?.package ?? '')) {
    errors.push('Set a valid expo.android.package in app.json.');
  }
  if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(app.ios?.bundleIdentifier ?? '')) {
    errors.push('Set a valid expo.ios.bundleIdentifier in app.json.');
  }
  if (eas.cli?.appVersionSource !== 'remote') errors.push('Set cli.appVersionSource to remote in eas.json for managed build numbering.');
  if (expected) {
    if (build.distribution !== expected.distribution) errors.push(`Set build.${profile}.distribution to ${expected.distribution} in eas.json.`);
    if (build.environment !== expected.environment) errors.push(`Set build.${profile}.environment to ${expected.environment} in eas.json.`);
    if (build.developmentClient !== false) errors.push(`Set build.${profile}.developmentClient to false so testers receive a standalone app.`);
    if (build.env?.EXPO_PUBLIC_PREVIEW_ONBOARDING !== '0') errors.push(`Set build.${profile}.env.EXPO_PUBLIC_PREVIEW_ONBOARDING to "0" for returning-user navigation.`);
    if (profile === 'preview' && build.android?.buildType !== 'apk') errors.push('Set build.preview.android.buildType to apk for direct Android installation.');
    if (build.android?.gradleCommand && !/:assembleRelease$/.test(build.android.gradleCommand)) {
      errors.push(`Remove the custom build.${profile}.android.gradleCommand or use :app:assembleRelease for a standalone release.`);
    }
    if (profile !== 'preview' && build.ios?.simulator === true) errors.push(`Disable build.${profile}.ios.simulator to distribute to physical iPhones.`);
  }
  const effective = { ...env, ...(isRecord(build.env) ? build.env : {}) };
  for (const [name, value] of Object.entries(effective)) {
    if (name.startsWith('EXPO_PUBLIC_') && nonempty(value)
      && /(?:DATABASE|SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|SERVICE_ACCOUNT|(?:OPENAI|GEMINI|TWELVE_DATA|MARKETAUX)_API_KEY)/i.test(name)) {
      errors.push(`Remove ${name} from client build variables. Privileged credentials belong only in the server environment.`);
    }
  }
  if (!publicServiceUrl(effective.EXPO_PUBLIC_NEON_AUTH_URL)
    || !new URL(effective.EXPO_PUBLIC_NEON_AUTH_URL.trim()).pathname.replace(/\/+$/, '').endsWith('/auth')) {
    errors.push('Set EXPO_PUBLIC_NEON_AUTH_URL to the public HTTPS Neon Auth URL, including its /auth service path, in the selected EAS environment and your local .env. Do not include credentials, query parameters, or fragments.');
  }
  const backend = effective.EXPO_PUBLIC_APP_API_URL;
  const backendValid = publicServiceUrl(backend) && new URL(backend.trim()).pathname === '/';
  if (!backendValid) {
    errors.push('Set EXPO_PUBLIC_APP_API_URL explicitly to your public HTTPS application backend origin in the selected EAS environment. Do not rely on the social return URL or include credentials, query parameters, or fragments.');
  }
  const enabledProviders = {};
  for (const name of ['EXPO_PUBLIC_GOOGLE_AUTH_ENABLED', 'EXPO_PUBLIC_APPLE_AUTH_ENABLED']) {
    const value = effective[name];
    if (value !== undefined && value !== '' && value !== '0' && value !== '1') {
      errors.push(`Set ${name} to "0" or "1"; leave it off until the provider and return page have been configured and tested.`);
    }
    enabledProviders[name] = value === '1';
  }
  const googleEnabled = enabledProviders.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED;
  const appleEnabled = enabledProviders.EXPO_PUBLIC_APPLE_AUTH_ENABLED;
  if (googleEnabled || appleEnabled) {
    const callback = effective.EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL;
    let validReturn = publicServiceUrl(callback);
    if (validReturn) validReturn = new URL(callback.trim()).pathname === '/native-auth.html';
    if (!validReturn) {
      errors.push('Set EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL to the deployed public HTTPS /native-auth.html page on a Neon trusted domain, with no credentials, query parameters, or fragment.');
    }
    warnings.push('Verify custom OAuth credentials, the Neon trusted domain, the deployed native-auth.html return page, and each provider on physical devices before enabling social sign-in for users.');
  } else {
    warnings.push('Google and Apple sign-in are disabled by default; their buttons remain hidden until the corresponding EXPO_PUBLIC_ flag is "1".');
  }
  if (googleEnabled && !appleEnabled && ['ios', 'all'].includes(targetPlatform) && (profile === 'testflight' || profile === 'production')) {
    errors.push('Enable EXPO_PUBLIC_APPLE_AUTH_ENABLED="1" and configure Sign in with Apple before shipping Google sign-in in an iOS testflight/production build. This app uses Apple as the equivalent login option required by App Review guideline 4.8.');
  }
  warnings.push('Local checks do not verify Expo login, remote EAS environment values, database migrations, OAuth providers, email delivery, or real-device signup.');
  return { errors, warnings };
}

function readJson(file, errors) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    errors.push(`Create a valid ${file} in the project root.`);
    return {};
  }
}

function main(args) {
  let profile = 'preview';
  let platform;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--profile' && args[index + 1]) profile = args[++index];
    else if (args[index] === '--platform' && args[index + 1]) platform = args[++index];
    else if (args[index] === '--offline') continue; // All preflight checks are local.
    else if (args[index] === '--help') {
      console.log('Usage: node scripts/check-beta.mjs [--profile preview|testflight|production] [--platform android|ios|all] [--offline]');
      console.log('Default platform: preview=android, testflight=ios, production=all. Use --platform android for an Android-only store release.');
      console.log('Checks local app, build, public Neon Auth and application backend configuration. Does not contact external services.');
      return 0;
    } else {
      console.error('Unknown or incomplete option. Use --help for usage.');
      return 2;
    }
  }
  const errors = [];
  // Match release-mode Expo file priority; inherited shell values take precedence.
  for (const file of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    if (!existsSync(file)) continue;
    if (typeof process.loadEnvFile !== 'function') {
      errors.push('Use the project Node.js 24 runtime to load local environment files.');
      break;
    }
    try { process.loadEnvFile(file); }
    catch { errors.push(`Could not load ${file}; check its format without sharing its contents.`); }
  }
  const appConfig = readJson('app.json', errors);
  const easConfig = readJson('eas.json', errors);
  const result = checkBetaConfig({ appConfig, easConfig, env: process.env, profile, platform });
  errors.push(...result.errors);
  console.log(`PipWise ${Object.hasOwn(profiles, profile) ? profile : 'build'} preflight — local configuration only`);
  for (const error of errors) console.error(`FAIL: ${error}`);
  for (const warning of result.warnings) console.log(`NOTE: ${warning}`);
  if (errors.length) {
    console.error(`Preflight found ${errors.length} configuration requirement(s). No build was started.`);
    return 1;
  }
  console.log('PASS: Local release configuration is ready. Verify the remaining account and backend requirements before sharing a build.');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
