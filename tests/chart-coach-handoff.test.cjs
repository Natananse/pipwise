const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, TextEncoder, AbortController, ...globals,
    require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } });
  return module.exports;
}
const types = load('src/lib/marketTypes.ts');
const review = load('src/lib/chartReview.ts', { './marketTypes': types });
const handoff = load('src/lib/chartCoachHandoff.ts', { './chartReview': review });
const now = Date.now();
const bars = Array.from({ length: 100 }, (_, i) => ({ time: now - (100 - i) * 3600000, open: 100, high: 101, low: 99, close: 100 }));
const input = { symbol: 'EUR/USD', timeframe: '1h', strategy: 'SMC', context: 'Unverified CPI notes' };

test('manual file prompt includes the local study and only its last sixty completed candles', () => {
  const report = review.reviewCandles(bars, input, 'private-filename@example.test.csv', now);
  const forming = { time: now, open: 900, high: 999, low: 800, close: 950 };
  const prompt = handoff.buildChartCoachHandoff({ input, report, candles: [...bars, forming], simulated: true });
  assert.match(prompt, /100 completed candles/);
  assert.match(prompt, /60 of 100 studied candles; not the full file/);
  assert.match(prompt, /simulated practice prices/);
  assert.match(prompt, /unverified context/);
  assert.match(prompt, /not an AI result/);
  assert.ok(prompt.includes(input.context));
  const csv = prompt.split('time,open,high,low,close\n')[1].split('\n\n')[0].split('\n');
  assert.equal(csv.length, 60);
  assert.ok(csv[0].startsWith(new Date(bars[40].time).toISOString()));
  assert.ok(!csv.some(row => row.startsWith(`${new Date(forming.time).toISOString()},`)));
  assert.ok(!prompt.includes('private-filename@example.test.csv'), 'filenames may contain personal information');
});

test('photo and empty prompts require a manual attachment and never claim a chart was analyzed', () => {
  const report = review.reviewCandles(bars, input, 'private.csv', now);
  const photo = handoff.buildChartCoachHandoff({ input, report, candles: bars, photo: true });
  assert.match(photo, /attach the original chart image separately/);
  assert.match(photo, /has not transferred this image/);
  assert.ok(!photo.includes('time,open,high,low,close'));
  assert.ok(!photo.includes('On-device study'));
  const empty = handoff.buildChartCoachHandoff({ input: { ...input, context: '' } });
  assert.match(empty, /Ask for it before making chart-specific observations/);
  assert.ok(!empty.includes('My fundamental notes'));
  assert.throws(() => handoff.buildChartCoachHandoff({ input: { ...input, timeframe: 'invalid' } }));
});

function screen({ signedIn = false, coachStatus = { available: false, provider: null, requiresSubscription: false, monthlyLimit: 10, message: 'Disabled' } } = {}) {
  const slots = [], effects = [], calls = [];
  let cursor = 0, tree;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const i = cursor++; const slot = slots[i] ||= { value: initial }; return [slot.value, value => { slot.value = typeof value === 'function' ? value(slot.value) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useEffect(effect, dependencies) {
      const i = cursor++;
      if (!slots[i] || dependencies.some((value, j) => value !== slots[i].dependencies[j])) {
        const previous = slots[i]; slots[i] = { dependencies };
        effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  react.default = react;
  const imports = {
    react,
    'expo-router': { router: { back() {}, push: value => calls.push({ route: value }) } },
    'expo-linking': { openURL: async value => calls.push({ url: value }) },
    'react-native': { ...Object.fromEntries(['Image', 'Pressable', 'ScrollView', 'Text', 'View'].map(value => [value, value])),
      Share: { dismissedAction: 'dismissedAction', share: async value => { calls.push({ share: value }); return { action: 'sharedAction' }; } } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../components/design': Object.fromEntries(['AppButton', 'AppInput', 'Badge', 'Chip', 'ErrorState', 'GlassCard', 'Icon', 'Label', 'Row'].map(value => [value, value])),
    '../components/TradingChart': { TradingChart: 'TradingChart' },
    '../lib/chartCoachClient': {
      getCoachStatus: async () => coachStatus,
      reviewChartPhoto: async (_input, _upload, _signal, account, provider) => { calls.push({ connectedReview: { account, provider } }); return { review: 'A completed study', source: 'OpenAI', generatedAt: now }; },
    },
    '../lib/chartCoachHandoff': handoff,
    '../lib/chartReview': review,
    '../lib/chartUploads': { pickChartUpload: async () => ({ name: 'private-photo.png', base64: 'PRIVATE_IMAGE_BYTES', uri: 'data:image/png;base64,PRIVATE_IMAGE_BYTES', size: 100, mimeType: 'image/png' }) },
    '../lib/demoMarket': { demoMarket: { getSeries: () => ({ candles: bars }) } },
    '../lib/market': { assets: [{ symbol: 'EUR/USD' }] },
    '../lib/marketTypes': types,
    '../lib/session': { useSession: () => ({ plan: 'free', session: signedIn ? { user: { id: 'verified-free-account' } } : null }) },
    '../lib/theme': { ThemeSurface: 'ThemeSurface' },
  };
  const app = load('src/app/chart-coach.tsx', imports, { setTimeout: () => 1, clearTimeout() {} });
  function expand(value) {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.type === 'function') return expand(value.type(value.props));
    return { ...value, props: { ...value.props, children: expand(value.props.children) } };
  }
  const render = () => { cursor = 0; tree = expand(app.default()); effects.splice(0).forEach(effect => effect()); };
  const visit = (value, predicate) => {
    if (Array.isArray(value)) { for (const child of value) { const found = visit(child, predicate); if (found) return found; } return null; }
    if (!value || typeof value !== 'object') return null;
    return predicate(value) ? value : visit(value.props?.children, predicate);
  };
  render();
  return { calls,
    async press(label) {
      const button = visit(tree, node => node.type === 'AppButton' && node.props.label === label);
      assert.ok(button, `Missing button ${label}`); assert.ok(!button.props.disabled);
      button.props.onPress(); await new Promise(resolve => setImmediate(resolve)); render();
    },
    prompt: () => visit(tree, node => node.type === 'Text' && node.props.accessibilityLabel === 'ChatGPT study prompt'),
    consent() {
      const checkbox = visit(tree, node => node.type === 'Pressable' && node.props.accessibilityRole === 'checkbox');
      assert.ok(checkbox, 'Provider consent must be shown'); checkbox.props.onPress(); render();
    },
  };
}

test('free users share text only and open the official ChatGPT root through separate explicit actions', async () => {
  const app = screen();
  assert.equal(app.calls.length, 0, 'nothing is shared or opened on mount');
  await app.press('Choose chart photo or candle file');
  await app.press('Prepare ChatGPT prompt');
  assert.equal(app.calls.length, 0, 'preparing a prompt stays on-device');
  assert.equal(app.prompt().props.selectable, true);
  await app.press('Share text prompt');
  assert.equal(app.calls.length, 1);
  assert.deepEqual(Object.keys(app.calls[0].share).sort(), ['message', 'title']);
  assert.match(app.calls[0].share.message, /attach the original chart image separately/);
  assert.ok(!JSON.stringify(app.calls).includes('PRIVATE_IMAGE_BYTES'));
  assert.ok(!JSON.stringify(app.calls).includes('private-photo.png'));
  await app.press('Open ChatGPT');
  assert.deepEqual(app.calls[1], { url: 'https://chatgpt.com/' });
});

test('a configured owner-funded OpenAI review is accessible to verified free accounts only after consent', async () => {
  const app = screen({ signedIn: true, coachStatus: { available: true, provider: 'openai', requiresSubscription: false, monthlyLimit: 10, message: 'Connected' } });
  await app.press('Choose chart photo or candle file');
  assert.equal(app.calls.length, 0);
  app.consent();
  await app.press('Request connected photo review');
  assert.deepEqual(app.calls, [{ connectedReview: { account: 'verified-free-account', provider: 'openai' } }]);
});
