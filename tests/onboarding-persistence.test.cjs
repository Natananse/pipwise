const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');

function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Promise, setTimeout, clearTimeout, process: { env: {} }, ...globals,
    require: name => {
      if (name in imports) return imports[name];
      if (name === './accountDetails') return { syncPendingRegistrationDetails: async () => {} };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return module.exports;
}

function hooks() {
  const states = [];
  const react = {
    createContext: () => ({ Provider: 'provider' }),
    createElement: (_type, props) => props,
    useState: initial => {
      const index = states.length;
      states.push(initial);
      return [initial, value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: value => ({ current: value }),
    useEffect: () => {},
    useCallback: callback => callback,
  };
  return { states, react: { ...react, default: react } };
}

const initialWallet = { cash: 10000, positions: [], history: [] };
const savedPosition = (id, closed = false) => ({ id, symbol: 'EUR/USD', direction: 'buy', quantity: 100, entry: 1.08472,
  fee: 0.0216944, opened: '2026-11-05T06:00:00.000Z', ...(closed ? { closed: '2026-11-05T07:00:00.000Z', pnl: -0.0433888 } : {}) });
const persistence = load('src/lib/persistence.ts');
const startupTasks = load('src/lib/startupTasks.ts');
const secureStorage = load('src/lib/secureStorage.ts', { expo: { requireOptionalNativeModule: () => null } });
function workspace(storage, imports = {}) {
  const harness = hooks();
  const api = load('src/lib/workspace.tsx', {
    react: harness.react,
    '@react-native-async-storage/async-storage': storage,
    './simulator': { initialWallet },
    './persistence': persistence,
    './demoMarketProvider': { useDemoMarketStatus: () => ({ ready: true }), persistDemoMarket: async () => {} },
    ...imports,
  });
  return { ...harness, ...api };
}

function controlledTimeouts() {
  const attempts = [];
  return {
    attempts,
    imports: {
      ...startupTasks,
      withStartupTimeout(task, message) {
        let settled = false;
        let rejectTimeout;
        const result = new Promise((resolve, reject) => {
          rejectTimeout = reject;
          Promise.resolve(task).then(value => {
            settled = true;
            resolve(value);
          }, error => {
            settled = true;
            reject(error);
          });
        });
        attempts.push({ expire: () => {
          if (settled) return false;
          settled = true;
          rejectTimeout(new startupTasks.StartupTimeoutError(message));
          return true;
        } });
        return result;
      },
    },
  };
}

const flushTasks = () => new Promise(resolve => setImmediate(resolve));

test('a later trade cannot be saved with the marks captured for an earlier wallet', async () => {
  const writes = [];
  const marks = [];
  let quote = 1.1;
  let releaseFirst;
  const firstSave = new Promise(resolve => { releaseFirst = resolve; });
  const harness = workspace({ setItem: async (_key, raw) => { writes.push(JSON.parse(raw)); } }, {
    './demoMarketProvider': {
      useDemoMarketStatus: () => ({ ready: true }),
      persistDemoMarket: async () => { marks.push(quote); if (marks.length === 1) await firstSave; },
    },
  });
  const { value } = harness.WorkspaceProvider({ children: null });
  const first = { ...savedPosition('first'), pricingSource: 'moving-demo-v1', entry: quote };
  value.update({ wallet: { cash: 9000, positions: [first], history: [] } });
  await flushTasks();
  quote = 1.2;
  const second = { ...savedPosition('second'), pricingSource: 'moving-demo-v1', entry: quote };
  value.update({ wallet: { cash: 8000, positions: [second, first], history: [] } });
  releaseFirst();
  await flushTasks();
  assert.deepEqual(marks, [1.1, 1.2]);
  assert.deepEqual(writes.map(write => write.wallet.positions.map(position => position.id)), [['first'], ['second', 'first']]);
  assert.equal(writes[0].wallet.positions[0].entry, marks[0]);
  assert.equal(writes[1].wallet.positions[0].entry, marks[1]);
});

test('setup writes preserve the moving wallet only after its demo marks save successfully', async () => {
  const events = [];
  let failPrices = false;
  const harness = workspace({ setItem: async (_key, raw) => { events.push(JSON.parse(raw).language); } }, {
    './demoMarketProvider': {
      useDemoMarketStatus: () => ({ ready: true }),
      persistDemoMarket: async () => { events.push('prices'); if (failPrices) throw new Error('price storage unavailable'); },
    },
  });
  const { value } = harness.WorkspaceProvider({ children: null });
  value.update({ wallet: { cash: 9000, positions: [{ ...savedPosition('moving'), pricingSource: 'moving-demo-v1' }], history: [] } });
  await flushTasks();
  events.length = 0;
  await value.persistOnboardingDraft({ experience: '', markets: [], goal: '' }, 'fr', 0);
  assert.deepEqual(events, ['prices', 'fr']);
  events.length = 0;
  failPrices = true;
  await assert.rejects(value.persistOnboardingDraft({ experience: '', markets: [], goal: '' }, 'es', 0), /price storage unavailable/);
  assert.deepEqual(events, ['prices']);
  assert.equal(harness.states[0].language, 'fr');
});

test('restoring preferences retains the saved wallet and fills missing older preferences', () => {
  const { parseWorkspaceData } = workspace({});
  const wallet = { cash: 7400, positions: [savedPosition('open-position')], history: [savedPosition('closed-position', true)] };
  const restored = parseWorkspaceData(JSON.stringify({ language: 'am', preferences: { experience: 'Intermediate' }, wallet }));
  assert.equal(restored.language, 'am');
  assert.equal(restored.preferences.experience, 'Intermediate');
  assert.equal(restored.preferences.markets.length, 0);
  assert.equal(restored.onboardingDraft, null);
  assert.equal(restored.onboardingVersion, 0);
  assert.equal(JSON.stringify(restored.wallet), JSON.stringify(wallet));
});

test('corrupt stored roots and null or invalid markets reject instead of replacing saved data', () => {
  const { parseWorkspaceData } = workspace({});
  for (const raw of ['null', '[]', '5', '{', '{"preferences":null}', '{"preferences":{"markets":null}}', '{"preferences":{"markets":[5]}}', '{"wallet":{"cash":100}}']) {
    assert.throws(() => parseWorkspaceData(raw));
  }
});

test('all ten language choices survive storage restoration and unsupported locales reject', () => {
  const { parseWorkspaceData } = workspace({});
  const { languages } = load('src/lib/languages.ts');
  assert.equal(languages.length, 10);
  for (const language of languages) {
    assert.equal(parseWorkspaceData(JSON.stringify({ language: language.code })).language, language.code);
  }
  for (const language of ['xx', 'EN', '', 5, null]) {
    assert.throws(() => parseWorkspaceData(JSON.stringify({ language })), /Invalid saved language/);
  }
});

test('legacy setup needs the current onboarding revision without losing saved progress', () => {
  const { parseWorkspaceData, CURRENT_ONBOARDING_VERSION } = workspace({});
  const wallet = { cash: 6500, positions: [savedPosition('legacy-position')], history: [] };
  const restored = parseWorkspaceData(JSON.stringify({
    language: 'am', preferences: { experience: 'Intermediate', markets: ['Forex'], goal: 'Practice trading' },
    wallet, completed: ['lesson-1'], bookmarks: ['lesson-2'],
  }));
  assert.equal(CURRENT_ONBOARDING_VERSION, 1);
  assert.equal(restored.onboardingVersion, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.wallet)), wallet);
  assert.deepEqual(Array.from(restored.completed), ['lesson-1']);
  assert.deepEqual(Array.from(restored.bookmarks), ['lesson-2']);
  for (const onboardingVersion of [0, 1, 2]) {
    assert.equal(parseWorkspaceData(JSON.stringify({ onboardingVersion })).onboardingVersion, onboardingVersion);
  }
  for (const onboardingVersion of [-1, 0.5, '1', null]) {
    assert.throws(() => parseWorkspaceData(JSON.stringify({ onboardingVersion })), /Invalid saved onboarding version/);
  }
});

test('partial onboarding progress restores independently from committed preferences', () => {
  const { parseWorkspaceData } = workspace({});
  const preferences = { experience: 'Intermediate', markets: [], goal: '' };
  const onboardingDraft = { language: 'es', preferences, step: 2 };
  const restored = parseWorkspaceData(JSON.stringify({ language: 'es', onboardingDraft, completed: ['lesson-1'] }));
  assert.equal(JSON.stringify(restored.onboardingDraft), JSON.stringify(onboardingDraft));
  assert.equal(restored.preferences.experience, '');
  assert.equal(restored.completed[0], 'lesson-1');
});

test('corrupt draft progress cannot skip steps or overwrite a workspace', () => {
  const { parseWorkspaceData } = workspace({});
  const valid = { language: 'es', preferences: { experience: '', markets: [], goal: '' }, step: 1 };
  for (const onboardingDraft of [
    false, [], 'progress', {},
    { ...valid, step: -1 }, { ...valid, step: 4 }, { ...valid, step: 1.5 }, { ...valid, step: '2' },
    { ...valid, language: 'unknown' }, { ...valid, preferences: null },
    { ...valid, preferences: { ...valid.preferences, markets: [5] } },
    { ...valid, preferences: { markets: [] } },
  ]) {
    assert.throws(() => parseWorkspaceData(JSON.stringify({ onboardingDraft })), /Invalid saved onboarding progress/);
  }
});

test('a failed draft save preserves memory and retry durably saves the resume step and language', async () => {
  let fail = true;
  const writes = [];
  const harness = workspace({ setItem: async (key, value) => {
    if (fail) throw new Error('storage unavailable');
    writes.push({ key, value });
  } });
  const { value } = harness.WorkspaceProvider({ children: null });
  const preferences = { experience: 'Know the basics', markets: [], goal: '' };
  await assert.rejects(value.persistOnboardingDraft(preferences, 'fr', 2), /storage unavailable/);
  assert.equal(harness.states[0].language, 'en');
  assert.equal(harness.states[0].onboardingDraft, null);
  fail = false;
  await value.persistOnboardingDraft(preferences, 'fr', 2);
  const saved = JSON.parse(writes.at(-1).value);
  assert.equal(saved.language, 'fr');
  assert.deepEqual(saved.onboardingDraft, { language: 'fr', preferences, step: 2 });
  assert.equal(harness.states[0].preferences.experience, '');
  assert.equal(harness.states[0].onboardingDraft.step, 2);
  assert.equal(saved.onboardingVersion, 0);
});

test('final setup clears the draft only after saving and retains trading and learning data', async () => {
  let fail = false;
  const writes = [];
  const harness = workspace({ setItem: async (key, value) => {
    if (fail) throw new Error('storage unavailable');
    writes.push({ key, value });
  } });
  const { value } = harness.WorkspaceProvider({ children: null });
  const wallet = { cash: 7300, positions: [{ id: 'saved-trade' }], history: [] };
  value.update({ wallet, completed: ['lesson-1'], bookmarks: ['lesson-2'] });
  const answers = { experience: 'Intermediate', markets: ['Forex'], goal: 'Practice trading' };
  await value.persistOnboardingDraft(answers, 'pt', 3);
  fail = true;
  await assert.rejects(value.persistOnboarding(answers, 'pt'), /storage unavailable/);
  assert.equal(harness.states[0].onboardingDraft.step, 3);
  assert.equal(harness.states[0].preferences.experience, '');
  assert.equal(harness.states[0].onboardingVersion, 0);
  fail = false;
  await value.persistOnboarding(answers, 'pt');
  const saved = JSON.parse(writes.at(-1).value);
  assert.equal(saved.onboardingDraft, null);
  assert.equal(saved.onboardingVersion, 1);
  assert.deepEqual(saved.preferences, answers);
  assert.deepEqual(saved.wallet, wallet);
  assert.deepEqual(saved.completed, ['lesson-1']);
  assert.deepEqual(saved.bookmarks, ['lesson-2']);
  assert.equal(harness.states[0].onboardingDraft, null);
  assert.equal(harness.states[0].onboardingVersion, 1);
});

test('reviewing a completed setup preserves its onboarding revision while saving a draft', async () => {
  const writes = [];
  const harness = workspace({ setItem: async (_key, value) => { writes.push(JSON.parse(value)); } });
  const { value } = harness.WorkspaceProvider({ children: null });
  value.update({ onboardingVersion: 1, completed: ['lesson-1'] });
  await value.persistOnboardingDraft({ experience: 'Intermediate', markets: ['Forex'], goal: '' }, 'es', 3);
  assert.equal(writes.at(-1).onboardingVersion, 1);
  assert.deepEqual(writes.at(-1).completed, ['lesson-1']);
  assert.equal(harness.states[0].onboardingVersion, 1);
});

test('failed preference save leaves memory untouched and a retry saves language and answers together', async () => {
  let fail = true;
  const writes = [];
  const harness = workspace({ setItem: async (key, value) => {
    if (fail) throw new Error('storage unavailable');
    writes.push({ key, value });
  } });
  const { value } = harness.WorkspaceProvider({ children: null });
  const answers = { experience: 'Intermediate', markets: ['Forex', 'Gold and Silver'], goal: 'Practice trading' };
  await assert.rejects(value.persistOnboarding(answers, 'am'), /storage unavailable/);
  assert.equal(harness.states[0].language, 'en');
  assert.equal(harness.states[0].preferences.experience, '');
  fail = false;
  await value.persistOnboarding(answers, 'am');
  assert.equal(writes.length, 1);
  const saved = JSON.parse(writes[0].value);
  assert.equal(saved.language, 'am');
  assert.deepEqual(saved.preferences, answers);
  assert.equal(harness.states[0].preferences.experience, answers.experience);
  assert.equal(harness.states[0].wallet.cash, 10000);
});

for (const final of [false, true]) {
  test(`pending ${final ? 'final' : 'draft'} saves time out without releasing native write order or committing expired attempts`, async () => {
    const timeouts = controlledTimeouts();
    const writes = [];
    const events = [];
    let saved;
    let blockNext = false;
    let releaseWrite;
    const blockedWrite = new Promise(resolve => { releaseWrite = resolve; });
    const harness = workspace({ setItem: async (_key, raw) => {
      const data = JSON.parse(raw);
      writes.push(data);
      events.push(`${data.language}:start`);
      if (blockNext) {
        blockNext = false;
        await blockedWrite;
      }
      saved = data;
      events.push(`${data.language}:saved`);
    } }, { './startupTasks': timeouts.imports });
    const { value } = harness.WorkspaceProvider({ children: null });
    const wallet = { cash: 6400, positions: [{ id: 'retained-trade' }], history: [] };
    value.update({ wallet, completed: ['lesson-1'], bookmarks: ['lesson-2'] });
    const baselineAnswers = { experience: '', markets: [], goal: '' };
    await value.persistOnboardingDraft(baselineAnswers, 'en', 0);
    const before = JSON.parse(JSON.stringify(harness.states[0]));
    const startingWrites = writes.length;
    const startingTimeouts = timeouts.attempts.length;
    events.length = 0;
    const answers = { experience: 'Intermediate', markets: ['Forex'], goal: 'Practice trading' };
    const save = (language, preferences = answers) => final
      ? value.persistOnboarding(preferences, language)
      : value.persistOnboardingDraft(preferences, language, 2);

    blockNext = true;
    const pending = save('fr');
    const pendingRejection = assert.rejects(pending, startupTasks.StartupTimeoutError);
    await flushTasks();
    assert.equal(timeouts.attempts.length, startingTimeouts + 1, 'the caller must have a bounded wait');
    assert.equal(writes.length, startingWrites + 1);
    assert.equal(timeouts.attempts[startingTimeouts].expire(), true);
    await pendingRejection;
    assert.deepEqual(JSON.parse(JSON.stringify(harness.states[0])), before);
    assert.match(harness.states[2], /could not save|too long|try again/i);

    const blockedRetry = save('es');
    const blockedRejection = assert.rejects(blockedRetry, startupTasks.StartupTimeoutError);
    await flushTasks();
    assert.equal(timeouts.attempts.length, startingTimeouts + 2);
    assert.equal(writes.length, startingWrites + 1, 'a retry must not overtake the pending physical write');
    assert.equal(timeouts.attempts[startingTimeouts + 1].expire(), true);
    await blockedRejection;

    releaseWrite();
    await flushTasks();
    assert.deepEqual(events, ['fr:start', 'fr:saved']);
    assert.equal(saved.language, 'fr', 'the old native operation may still finish after its caller times out');
    assert.equal(writes.length, startingWrites + 1, 'an expired queued retry must never start a write');
    assert.deepEqual(JSON.parse(JSON.stringify(harness.states[0])), before, 'a late successful write must not commit expired state');

    const freshAnswers = { experience: 'Know the basics', markets: ['Cryptocurrency'], goal: 'Learn financial markets' };
    await save('am', freshAnswers);
    assert.deepEqual(events, ['fr:start', 'fr:saved', 'am:start', 'am:saved']);
    assert.equal(writes.length, startingWrites + 2);
    assert.equal(saved.language, 'am');
    assert.deepEqual(saved.wallet, wallet);
    assert.deepEqual(saved.completed, ['lesson-1']);
    assert.deepEqual(saved.bookmarks, ['lesson-2']);
    assert.deepEqual(JSON.parse(JSON.stringify(harness.states[0])), saved);
    assert.equal(harness.states[2], '');
    if (final) {
      assert.equal(saved.onboardingDraft, null);
      assert.equal(saved.onboardingVersion, 1);
      assert.deepEqual(saved.preferences, freshAnswers);
    } else {
      assert.deepEqual(saved.onboardingDraft, { language: 'am', step: 2, preferences: freshAnswers });
      assert.equal(saved.onboardingVersion, 0);
      assert.deepEqual(saved.preferences, baselineAnswers);
    }
  });
}

test('onboarding completion changes only after its completion flag persists successfully', async () => {
  const harness = hooks();
  let fail = true;
  const api = load('src/lib/session.tsx', {
    react: harness.react,
    '@react-native-async-storage/async-storage': { setItem: async () => { if (fail) throw new Error('storage unavailable'); } },
    'react-native': { Platform: { OS: 'android' } },
    'react-native-purchases': { default: {} },
    './neonAuth': { authConfigured: false, subscribeAuth: () => () => {}, signOut: async () => {} },
    './secureStorage': secureStorage,
  });
  const { value } = api.SessionProvider({ children: null });
  await assert.rejects(value.finishOnboarding(), /storage unavailable/);
  assert.equal(harness.states.at(-1), false);
  fail = false;
  await value.finishOnboarding();
  assert.equal(harness.states.at(-1), true);
});

test('finishing setup can leave demo mode without signing out an account or deleting practice data', async () => {
  const harness = hooks();
  const removals = [];
  let accountSignOuts = 0;
  const api = load('src/lib/session.tsx', {
    react: harness.react,
    '@react-native-async-storage/async-storage': { setItem: async () => {}, removeItem: async key => removals.push(key) },
    'react-native': { Platform: { OS: 'android' } },
    'react-native-purchases': { default: {} },
    './neonAuth': { authConfigured: true, subscribeAuth: () => () => {}, signOut: async () => { accountSignOuts++; } },
    './secureStorage': secureStorage,
  });
  const { value } = api.SessionProvider({ children: null });
  await value.startDemo();
  assert.equal(harness.states[0], true);
  await value.leaveDemo();
  assert.equal(harness.states[0], false);
  assert.deepEqual(removals, ['demo']);
  assert.equal(accountSignOuts, 0);
});

test('failed demo-exit save leaves demo state unchanged for a safe retry', async () => {
  const harness = hooks();
  let fail = true;
  const api = load('src/lib/session.tsx', {
    react: harness.react,
    '@react-native-async-storage/async-storage': { setItem: async () => {}, removeItem: async () => { if (fail) throw new Error('storage unavailable'); } },
    'react-native': { Platform: { OS: 'android' } },
    'react-native-purchases': { default: {} },
    './neonAuth': { authConfigured: false, subscribeAuth: () => () => {}, signOut: async () => {} },
    './secureStorage': secureStorage,
  });
  const { value } = api.SessionProvider({ children: null });
  await value.startDemo();
  await assert.rejects(value.leaveDemo(), /storage unavailable/);
  assert.equal(harness.states[0], true);
  fail = false;
  await value.leaveDemo();
  assert.equal(harness.states[0], false);
});

test('development setup preview survives a normal restart, ends only after successful completion, and cannot enable in production', async () => {
  const importsFor = (harness, storage) => ({
    react: harness.react,
    '@react-native-async-storage/async-storage': storage,
    'react-native': { Platform: { OS: 'android' } },
    'react-native-purchases': { default: {} },
    './neonAuth': { authConfigured: false, subscribeAuth: () => () => {}, signOut: async () => {} },
    './secureStorage': secureStorage,
  });
  const harness = hooks();
  const saved = new Map([['disclaimer', '1']]);
  let fail = true;
  const api = load('src/lib/session.tsx', importsFor(harness, {
    setItem: async (key, value) => {
      if (fail) throw new Error('storage unavailable');
      saved.set(key, value);
    },
  }), { __DEV__: true, process: { env: { EXPO_PUBLIC_PREVIEW_ONBOARDING: '1' } } });
  const { value } = api.SessionProvider({ children: null });
  assert.equal(value.onboardingPreviewActive, true);
  const previewIndex = harness.states.indexOf(true);
  await assert.rejects(value.finishOnboarding(), /storage unavailable/);
  assert.equal(harness.states[previewIndex], true);
  fail = false;
  await value.finishOnboarding();
  assert.equal(harness.states[previewIndex], false);
  assert.equal(harness.states.at(-1), true);
  assert.equal(saved.get('onboarded'), '1');

  // A fresh provider models a full reload after switching back to pnpm start:
  // no preview environment flag, but completed setup metadata is still stored.
  const restarted = hooks();
  const effects = [];
  const restartReact = { ...restarted.react, useEffect: effect => effects.push(effect) };
  restartReact.default = restartReact;
  const restartedApi = load('src/lib/session.tsx', {
    ...importsFor(restarted, {
      multiGet: async keys => keys.map(key => [key, saved.get(key) ?? null]),
    }),
    react: restartReact,
  }, { __DEV__: true, process: { env: {} } });
  const restartedValue = restartedApi.SessionProvider({ children: null }).value;
  assert.equal(restartedValue.onboardingPreviewActive, true);
  const restartedPreviewIndex = restarted.states.indexOf(true);
  const cleanup = effects[0]();
  await flushTasks();
  assert.equal(restarted.states.at(-1), true, 'completed setup metadata restores normally');
  assert.equal(restarted.states[restartedPreviewIndex], true, 'saved completion must not hide the development preview');
  cleanup();

  for (const globals of [
    { __DEV__: false, process: { env: { EXPO_PUBLIC_PREVIEW_ONBOARDING: '1' } } },
    { __DEV__: false, process: { env: {} } },
    { __DEV__: true, process: { env: { EXPO_PUBLIC_PREVIEW_ONBOARDING: '0' } } },
  ]) {
    const normal = hooks();
    const normalApi = load('src/lib/session.tsx', importsFor(normal, {}), globals);
    assert.equal(normalApi.SessionProvider({ children: null }).value.onboardingPreviewActive, false);
  }
});

test('native account restoration preserves newer auth events and refreshes on foreground', async () => {
  const harness = hooks();
  const effects = [];
  const react = { ...harness.react, useEffect: effect => effects.push(effect) };
  react.default = react;
  let authEvent;
  let appStateEvent;
  let unsubscribed = false;
  let removed = false;
  let restoreSession;
  let finishForeground;
  let refreshes = 0;
  const api = load('src/lib/session.tsx', {
    react,
    '@react-native-async-storage/async-storage': { multiGet: async keys => keys.map(key => [key, null]) },
    'react-native': { Platform: { OS: 'android' }, AppState: {
      currentState: 'active',
      addEventListener: (_name, callback) => { appStateEvent = callback; return { remove: () => { removed = true; } }; },
    } },
    'react-native-purchases': { default: {} },
    './secureStorage': secureStorage,
    './neonAuth': {
      authConfigured: true,
      subscribeAuth: callback => { authEvent = callback; return () => { unsubscribed = true; }; },
      getAuthSession: () => {
        refreshes++;
        return refreshes === 1 ? new Promise(resolve => { restoreSession = resolve; })
          : new Promise(resolve => { finishForeground = resolve; });
      },
    },
  });
  const { value } = api.SessionProvider({ children: null });
  const cleanups = effects.map(effect => effect());
  assert.equal(refreshes, 1, 'initial restore is not duplicated by foreground setup');
  const signedIn = { user: { id: 'neon-user' } };
  authEvent(signedIn);
  restoreSession(null);
  await flushTasks();
  assert(harness.states.includes(signedIn), 'late initial read must not erase a newer sign-in');
  const before = [...harness.states];
  value.beginPasswordRecovery();
  const recoveryIndex = harness.states.findIndex((state, index) => state === true && before[index] === false);
  assert.notEqual(recoveryIndex, -1);
  value.clearPasswordRecovery();
  assert.equal(harness.states[recoveryIndex], false);
  value.beginPasswordRecovery();
  authEvent(null);
  assert.equal(harness.states[recoveryIndex], false);
  appStateEvent('background');
  assert.equal(refreshes, 1);
  appStateEvent('active');
  const socialSession = { user: { id: 'google-user' } };
  authEvent(socialSession);
  finishForeground(null);
  await flushTasks();
  assert.equal(refreshes, 2);
  assert(harness.states.includes(socialSession), 'foreground read started during browser return must not erase completed social sign-in');
  cleanups.forEach(cleanup => cleanup?.());
  assert.equal(unsubscribed, true);
  assert.equal(removed, true);
});

test('a rejected account sign-out is surfaced without silently dropping local demo state', async () => {
  const harness = hooks();
  let removed = false;
  const failure = new Error('Could not sign out');
  const api = load('src/lib/session.tsx', {
    react: harness.react,
    '@react-native-async-storage/async-storage': {
      setItem: async () => {}, removeItem: async () => { removed = true; },
    },
    'react-native': { Platform: { OS: 'android' } },
    'react-native-purchases': { default: {} },
    './neonAuth': { authConfigured: true, subscribeAuth: () => () => {}, signOut: async () => { throw failure; } },
    './secureStorage': secureStorage,
  });
  const { value } = api.SessionProvider({ children: null });
  await value.startDemo();
  await assert.rejects(value.signOut(), /Could not sign out/);
  assert.equal(harness.states[0], true);
  assert.equal(removed, false);
});
