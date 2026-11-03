const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, {
    module, exports: module.exports, Promise, process: { env: {} },
    require: name => { if (!(name in imports)) throw new Error(`Unexpected import ${name}`); return imports[name]; },
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
const persistence = load('src/lib/persistence.ts');
function workspace(storage) {
  const harness = hooks();
  const api = load('src/lib/workspace.tsx', {
    react: harness.react,
    '@react-native-async-storage/async-storage': storage,
    './simulator': { initialWallet },
    './persistence': persistence,
  });
  return { ...harness, ...api };
}

test('restoring preferences retains the saved wallet and fills missing older preferences', () => {
  const { parseWorkspaceData } = workspace({});
  const wallet = { cash: 7400, positions: [{ id: 'open-position' }], history: [{ id: 'closed-position' }] };
  const restored = parseWorkspaceData(JSON.stringify({ language: 'am', preferences: { experience: 'Intermediate' }, wallet }));
  assert.equal(restored.language, 'am');
  assert.equal(restored.preferences.experience, 'Intermediate');
  assert.equal(restored.preferences.markets.length, 0);
  assert.equal(JSON.stringify(restored.wallet), JSON.stringify(wallet));
});

test('corrupt stored roots and null or invalid markets reject instead of replacing saved data', () => {
  const { parseWorkspaceData } = workspace({});
  for (const raw of ['null', '[]', '5', '{', '{"preferences":null}', '{"preferences":{"markets":null}}', '{"preferences":{"markets":[5]}}', '{"wallet":{"cash":100}}']) {
    assert.throws(() => parseWorkspaceData(raw));
  }
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

test('onboarding completion changes only after its completion flag persists successfully', async () => {
  const harness = hooks();
  let fail = true;
  const api = load('src/lib/session.tsx', {
    react: harness.react,
    '@react-native-async-storage/async-storage': { setItem: async () => { if (fail) throw new Error('storage unavailable'); } },
    'react-native': { Platform: { OS: 'android' } },
    'react-native-purchases': { default: {} },
    './supabase': { supabase: null, supabaseConfigured: false },
  });
  const { value } = api.SessionProvider({ children: null });
  await assert.rejects(value.finishOnboarding(), /storage unavailable/);
  assert.equal(harness.states.at(-1), false);
  fail = false;
  await value.finishOnboarding();
  assert.equal(harness.states.at(-1), true);
});
