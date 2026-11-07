const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function screen({ signedIn = true, connected = true, identityFailure = false } = {}) {
  const slots = [];
  const calls = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ||= { value: initial };
      return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!slots[index] || dependencies.some((value, position) => value !== slots[index].dependencies[position])) {
        const previous = slots[index];
        slots[index] = { dependencies };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  react.default = react;
  const purchases = {
    isConfigured: async () => connected,
    getOfferings: async () => ({ current: { annual: { identifier: 'annual', product: { priceString: '$59.99' } } } }),
    purchasePackage: async () => { calls.push('purchase'); return { customerInfo: { entitlements: { active: { pro: {} } } } }; },
    restorePurchases: async () => { calls.push('restore'); return { entitlements: { active: { pro: {} } } }; },
  };
  purchases.default = purchases;
  const imports = {
    react,
    'expo-router': { router: { push: route => calls.push(`push:${route}`), replace: route => calls.push(`replace:${route}`) } },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': { Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), ...Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'View'].map(name => [name, name])) },
    'react-native-purchases': purchases,
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
    '../components/ScreenSystemBars': { ScreenSystemBars: 'ScreenSystemBars' },
    '../lib/navigation': { contentBottomPadding: ({ bottomInset, contentGap }) => bottomInset + contentGap },
    '../lib/responsiveLayout': (() => {
      const module = { exports: {} };
      vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/responsiveLayout.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
      return module.exports;
    })(),
    '../components/design': Object.fromEntries(['AppButton', 'Icon', 'Label', 'Sheet'].map(name => [name, name])),
    '../components/ProIllustration': { ProIllustration: 'ProIllustration' },
    '../components/ReferralCard': { ReferralCard: 'ReferralCard' },
    '../components/reference': { referenceColors: {} },
    '../lib/theme': { fonts: {}, ThemeSurface: 'ThemeSurface' },
    '../lib/session': { useSession: () => ({
      plan: 'free', ready: true, session: signedIn ? { user: { id: 'member-a' } } : null,
      leaveDemo: async () => { calls.push('leave-demo'); },
      refreshPlan: async () => { calls.push('refresh'); },
      preparePurchases: async () => { calls.push('prepare'); if (identityFailure) throw new Error('Account changed'); },
    }) },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/paywall.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, Promise, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.type === 'function') return expand(value.type(value.props));
    return { ...value, props: { ...value.props, children: expand(value.props.children) } };
  }
  const render = () => { cursor = 0; effects = []; tree = expand(module.exports.default()); effects.forEach(effect => effect()); };
  render();
  return {
    calls,
    text: () => text(tree),
    async flush() { await new Promise(resolve => setImmediate(resolve)); render(); },
    async press(label) {
      const button = find(tree, node => (node.type === 'Pressable' || node.type === 'AppButton') && (node.props.label === label || node.props.accessibilityLabel === label || text(node).trim() === label));
      assert.ok(button, `Missing button ${label}`);
      button.props.onPress();
      await this.flush();
    },
  };
}
function find(tree, predicate) {
  if (Array.isArray(tree)) { for (const child of tree) { const found = find(child, predicate); if (found) return found; } return null; }
  if (!tree || typeof tree !== 'object') return null;
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (typeof tree === 'string') return tree;
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}

test('demo purchase opens sign-in without charging an anonymous store customer', async () => {
  const h = screen({ signedIn: false });
  await h.flush();
  await h.press('Sign in to subscribe');
  assert.deepEqual(h.calls, ['leave-demo', 'push:/auth']);
});

test('demo restore keeps the store untouched and offers sign-in', async () => {
  const h = screen({ signedIn: false });
  await h.flush();
  await h.press('Restore purchases');
  assert.deepEqual(h.calls, []);
  assert.match(h.text(), /Sign in before restoring purchases/);
  await h.press('Sign in to link purchases');
  assert.deepEqual(h.calls, ['leave-demo', 'push:/auth']);
});

test('signed-in purchase and restore verify billing identity before contacting the store', async () => {
  const h = screen();
  await h.flush();
  await h.press('Start now');
  assert.deepEqual(h.calls, ['prepare', 'purchase', 'refresh']);
  await h.press('Restore purchases');
  assert.deepEqual(h.calls.slice(3), ['prepare', 'restore', 'refresh']);
});

test('a billing identity failure prevents both store operations', async () => {
  const h = screen({ identityFailure: true });
  await h.flush();
  await h.press('Start now');
  await h.press('Restore purchases');
  assert.deepEqual(h.calls, ['prepare', 'prepare']);
  assert.match(h.text(), /could not be restored/);
});

test('unconfigured purchases offer free practice without fake plans or forcing account access', async () => {
  const h = screen({ signedIn: false, connected: false });
  await h.flush();
  assert.match(h.text(), /Subscriptions are currently unavailable/);
  assert.doesNotMatch(h.text(), /\$59\.99|\$7\.99|\$5\.00|USD preview|Planned/);
  await h.press('Continue free practice');
  await h.press('Restore purchases');
  assert.deepEqual(h.calls, ['replace:/practice']);
  assert.match(h.text(), /Restore is available in the mobile app when store purchases are connected/);
});
