const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

test('native public legal routes hide the splash on layout without waiting for account or workspace readiness', () => {
  let hidden = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useEffect: () => {},
  };
  react.default = react;
  const imports = {
    react,
    'expo-router': { Slot: 'Slot' },
    'expo-splash-screen': { preventAutoHideAsync: async () => {}, hide: () => { hidden++; } },
    'react-native': { View: 'View', StyleSheet: { absoluteFill: {} } },
    '../lib/session': { useSession: () => ({ accountDataVersion: 0 }) },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('src/app/_layout.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText + '\nmodule.exports.accountWorkspace = AccountWorkspace;';
  vm.runInNewContext(source, {
    module, exports: module.exports, Promise,
    require: name => imports[name] || {},
  });
  const tree = module.exports.accountWorkspace({ fontsReady: false, publicPage: true });
  assert.equal(tree.type, 'View');
  assert.equal(tree.props.children[0].type, 'Slot');
  assert.equal(hidden, 0);
  tree.props.onLayout();
  assert.equal(hidden, 1);
});

test('navigating between public and private routes cannot resume writes during a pending account erase', async () => {
  const persistenceModule = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/persistence.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    module: persistenceModule, exports: persistenceModule.exports, Promise,
  });
  const persistence = persistenceModule.exports;
  let version = 0;
  let previous;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useEffect(effect, dependencies) {
      if (!previous || dependencies.some((value, index) => value !== previous[index])) { previous = dependencies; effect(); }
    },
  };
  react.default = react;
  const imports = {
    react, 'expo-router': { Slot: 'Slot' },
    'expo-splash-screen': { preventAutoHideAsync: async () => {}, hide() {} },
    'react-native': { View: 'View', StyleSheet: {} },
    '../lib/session': { useSession: () => ({ accountDataVersion: version }) },
    '../lib/persistence': persistence,
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/_layout.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText + '\nmodule.exports.accountWorkspace = AccountWorkspace;', {
    module, exports: module.exports, Promise, require: name => imports[name] || {},
  });
  const render = publicPage => module.exports.accountWorkspace({ fontsReady: false, publicPage });
  render(true);
  await persistence.pausePersistenceForAccountDeletion();
  render(false);
  let saved = false;
  const enqueue = persistence.createPersistenceQueue();
  await enqueue(async () => { saved = true; });
  assert.equal(saved, false, 'route changes must leave old and new writes paused until physical erase completes');
  version++;
  render(true);
  await enqueue(async () => { saved = true; });
  assert.equal(saved, true, 'completed account reset may resume the empty workspace');
});
