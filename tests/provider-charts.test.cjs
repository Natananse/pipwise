const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}, context = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, URL, ...context,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  }, { filename: file });
  return module.exports;
}
const charts = load('src/lib/providerCharts.ts');
const expected = { 'EUR/USD': 'FX:EURUSD', 'GBP/USD': 'FX:GBPUSD', 'USD/JPY': 'FX:USDJPY', 'BTC/USD': 'BITSTAMP:BTCUSD', 'XAU/USD': 'TVC:GOLD', 'WTI/USD': 'TVC:USOIL', 'SPX/USD': 'FOREXCOM:SPX500' };

test('all seven canonical markets use explicit provider identities and official fixed HTTPS URLs', () => {
  for (const [symbol, providerSymbol] of Object.entries(expected)) {
    const item = charts.getProviderChart(symbol);
    assert.equal(item.symbol, symbol);
    assert.equal(item.providerSymbol, providerSymbol);
    const url = new URL(item.url);
    assert.equal(url.origin, 'https://www.tradingview.com');
    assert.ok(url.pathname.startsWith('/symbols/'));
    assert.equal(url.searchParams.get('exchange'), providerSymbol.split(':')[0]);
    assert.ok(item.title && item.note);
    const options = charts.providerChartOptions(symbol);
    assert.equal(options.symbol, providerSymbol);
    assert.equal(options.allow_symbol_change, false, 'a different provider instrument must not silently replace the selected market');
    assert.equal(options.support_host, 'https://www.tradingview.com');
    assert.equal(options.interval, '60');
    assert.equal(options.timezone, 'Etc/UTC');
    assert.equal(options.autosize, true);
  }
  assert.match(charts.getProviderChart('WTI/USD').title, /CFD/);
  assert.match(charts.getProviderChart('WTI/USD').note, /not spot oil/);
  assert.match(charts.getProviderChart('XAU/USD').title, /calculated/);
  const index = charts.getProviderChart('SPX/USD');
  assert.equal(index.title, 'S&P 500 CFD reference · FOREX.com');
  assert.match(index.note, /different from the exchange cash index/);
  assert.match(index.note, /execution price/);
  assert.match(index.note, /delays/);
  assert.equal(index.url, 'https://www.tradingview.com/symbols/SPX500/?exchange=FOREXCOM');
});

test('unknown, inherited, and injected symbol strings cannot create a chart or arbitrary destination', () => {
  for (const symbol of ['BTC/USDT', 'NASDAQ:AAPL', '__proto__', 'constructor', 'eur/usd', '<script>alert(1)</script>', '']) {
    assert.equal(charts.getProviderChart(symbol), null);
    assert.equal(charts.providerChartOptions(symbol), null);
  }
});

class Element {
  constructor(tag) { this.tag = tag; this.listeners = new Map(); this.children = []; this.removed = false; }
  appendChild(child) { this.children.push(child); child.parent = this; }
  querySelector() { return this.frame ?? null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) { if (this.listeners.get(type) === listener) this.listeners.delete(type); }
  emit(type) { this.listeners.get(type)?.(); }
  remove() { this.removed = true; }
}
function harness(symbol = 'EUR/USD') {
  const values = [];
  const refs = [];
  const effects = [];
  const timers = new Map();
  const observers = [];
  const created = [];
  let cursor = 0;
  let refCursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }]; },
    useRef(initial) { const index = refCursor++; refs[index] ??= { current: initial }; return refs[index]; },
    useEffect(effect) { effects.push(effect); },
  };
  react.default = react;
  const { default: Widget } = load('src/components/TradingViewWidget.tsx', { react, '../lib/providerCharts': charts }, {
    document: { createElement: tag => { const element = new Element(tag); created.push(element); return element; } },
    MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
    setTimeout: callback => { const id = {}; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const render = () => { cursor = 0; refCursor = 0; return Widget({ symbol, height: 420 }); };
  const tree = render();
  const target = new Element('div');
  refs[0].current = target;
  return { render, tree, target, created, timers, effects, observers, mount: () => effects[0]() };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...tree.children.flat(Infinity).flatMap(nodes)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree?.children?.flat(Infinity).map(text).join(' ') ?? '';
}

test('hosted widget initializes with official script and config, retaining visible attribution', () => {
  const h = harness();
  const cleanup = h.mount();
  const script = h.created[0];
  assert.equal(script.src, 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js');
  assert.equal(JSON.parse(script.textContent).symbol, 'FX:EURUSD');
  assert.ok(text(h.tree).includes('by TradingView'));
  const attribution = nodes(h.tree).find(node => node.type === 'a');
  assert.equal(attribution.props.href, charts.getProviderChart('EUR/USD').url);
  assert.equal(attribution.props.rel, 'noopener nofollow');
  assert.equal(h.timers.size, 1);
  const frame = h.target.frame = new Element('iframe');
  h.observers[0].callback();
  frame.emit('load');
  assert.equal(h.timers.size, 0);
  assert.ok(!text(h.render()).includes('Loading provider chart'));
  assert.ok(!text(h.render()).includes('Live connected'));
  cleanup();
  assert.equal(h.observers[0].disconnected, true);
  assert.equal(frame.removed, true);
  assert.equal(script.removed, true);
});

test('network failure and timeout show retry instead of a fabricated or silently substituted chart', () => {
  for (const failure of ['network', 'timeout']) {
    const h = harness('WTI/USD');
    const cleanup = h.mount();
    if (failure === 'network') h.created[0].emit('error');
    else [...h.timers.values()][0]();
    const failed = h.render();
    assert.ok(text(failed).includes('Provider chart could not be loaded'));
    const button = nodes(failed).find(node => node.type === 'button');
    assert.ok(button);
    button.props.onClick();
    assert.ok(text(h.render()).includes('Loading provider chart'));
    cleanup();
    const nextCleanup = h.effects.at(-1)();
    assert.equal(h.created.length, 2);
    assert.equal(JSON.parse(h.created[1].textContent).symbol, 'TVC:USOIL');
    nextCleanup();
    assert.equal(h.timers.size, 0);
  }
});

test('unmount removes listeners and ignores late iframe and timeout callbacks', () => {
  const h = harness();
  const cleanup = h.mount();
  const frame = h.target.frame = new Element('iframe');
  h.observers[0].callback();
  const lateLoad = frame.listeners.get('load');
  const lateTimeout = [...h.timers.values()][0];
  cleanup();
  lateLoad();
  lateTimeout();
  assert.ok(text(h.render()).includes('Loading provider chart'));
  assert.equal(frame.listeners.size, 0);
  assert.equal(h.timers.size, 0);
});

test('unmapped markets never load a third-party script', () => {
  const h = harness('unsupported');
  assert.equal(h.mount(), undefined);
  assert.equal(h.created.length, 0);
  assert.ok(text(h.tree).includes('no configured provider chart'));
});
