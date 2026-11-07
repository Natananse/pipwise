const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, { module, exports: module.exports, Date, Math, Number, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  } });
  return module.exports;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return nodes(node.type(node.props));
  return [node, ...nodes(node.props.children)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (!node || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return text(typeof node.type === 'function' ? node.type(node.props) : node.props.children);
}

function fixture() {
  const market = load('src/lib/market.ts');
  const simulator = load('src/lib/simulator.ts', { './market': market });
  const risk = load('src/lib/orderRisk.ts', { './market': market, './simulator': simulator });
  const slots = [], orders = [], focusOffsets = [];
  let cursor = 0, tree, closed = 0, blurred = 0;
  let asset = { ...market.assets[0] };
  const workspace = { wallet: { cash: 10000, positions: [], history: [] }, trade(_asset, direction, quantity, sl, tp) {
    orders.push({ direction, quantity, sl, tp });
    workspace.wallet = simulator.openOrder(workspace.wallet, asset, direction, quantity, sl, tp, { pricingSource: 'moving-demo-v1' });
    return workspace.wallet.positions[0];
  } };
  const react = {
    Fragment: Symbol('Fragment'),
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef(initial) { const index = cursor++; return (slots[index] ??= { current: initial }); },
  };
  react.default = react;
  const { OrderBottomSheet } = load('src/components/OrderBottomSheet.tsx', {
    react, 'react-native': { View: 'View' }, '../lib/market': market, '../lib/simulator': simulator,
    '../lib/demoMarketProvider': { useDemoMarket: () => ({ snapshot: { asOf: Date.UTC(2026, 10, 8) }, ready: true }) },
    '../lib/workspace': { useWorkspace: () => workspace },
    '../lib/theme': { useTheme: () => ({ colors: { sheetUp: '#18754D' } }) },
    '../lib/orderRisk': risk, './RiskRing': { RiskRing: 'RiskRing' },
    './design': Object.fromEntries(['AppButton', 'AppInput', 'Badge', 'ErrorState', 'GlassCard', 'Icon', 'Label', 'Row', 'Sheet'].map(name => [name, name])),
  });
  const props = { embedded: true, direction: 'buy', onClose: () => { closed++; }, onInputFocus: offset => focusOffsets.push(offset), onInputBlur: () => { blurred++; } };
  function render(width = 390, height = 844, fullscreen = false) {
    cursor = 0;
    // The production route changes this pane's layout/display, retaining its child.
    tree = { type: 'View', props: { style: { width, height, display: fullscreen ? 'none' : 'flex' }, children: OrderBottomSheet({ ...props, asset }) } };
    return tree;
  }
  render();
  const field = label => nodes(tree).find(node => node.type === 'AppInput' && node.props.label === label);
  return {
    render, orders, focusOffsets, workspace, field,
    get blurred() { return blurred; }, get closed() { return closed; },
    text: () => text(tree), all: () => nodes(tree),
    input(label, value) { field(label).props.onChangeText(value); render(); },
    press(label) { const button = nodes(tree).find(node => node.type === 'AppButton' && node.props.label === label); assert.ok(button, label); button.props.onPress(); render(); },
    quote(price) { asset = { ...asset, price }; render(); },
  };
}

test('actual embedded order keeps quantity, SL/TP and review through repeated rotation/fullscreen without executing', () => {
  const h = fixture();
  h.input('Quantity (units)', '100');
  h.input('Stop loss (optional)', '1.08');
  h.input('Take profit (optional)', '1.10');
  for (let cycle = 0; cycle < 3; cycle++) {
    h.render(760, 390); h.render(760, 390, true); h.render(390, 844, true); h.render(390, 844);
    assert.equal(h.field('Quantity (units)').props.value, '100');
    assert.equal(h.field('Stop loss (optional)').props.value, '1.08');
    assert.equal(h.field('Take profit (optional)').props.value, '1.10');
    assert.equal(h.orders.length, 0);
  }
  h.press('Review order');
  assert.equal(h.orders.length, 0);
  for (let cycle = 0; cycle < 3; cycle++) {
    h.render(760, 390); h.render(760, 390, true); h.render(390, 844);
    assert.match(h.text(), /Review your order/);
    assert.match(h.text(), /100\s*units/);
    assert.match(h.text(), /1\.08/);
    assert.match(h.text(), /1\.10/);
    assert.equal(h.orders.length, 0);
  }
  h.quote(1.085);
  h.press('Confirm virtual order');
  assert.equal(h.orders.length, 1);
  const position = h.workspace.wallet.positions[0];
  assert.equal(position.entry, 1.085, 'Confirmation must retain the current-quote simulator contract');
  assert.equal(position.quantity, 100);
  assert.equal(position.stopLoss, 1.08);
  assert.equal(position.takeProfit, 1.10);
  assert.equal(position.direction, 'buy');
  h.render(760, 390); h.render(390, 844);
  assert.equal(h.orders.length, 1, 'A filled order must not execute again on layout changes');
  assert.match(h.text(), /Filled at/);
});

test('actual order fields report their measured offsets for keyboard scrolling and blur keeps drafts', () => {
  const h = fixture();
  h.input('Quantity (units)', '12.5');
  for (const [label, offset] of [['Quantity (units)', 120], ['Stop loss (optional)', 300], ['Take profit (optional)', 420]]) {
    const wrapper = h.all().find(node => node.type === 'View' && node.props.onLayout && nodes(node).some(child => child.type === 'AppInput' && child.props.label === label));
    assert.ok(wrapper, label);
    wrapper.props.onLayout({ nativeEvent: { layout: { y: offset } } });
    h.field(label).props.onFocus();
    assert.equal(h.focusOffsets.at(-1), offset);
    h.field(label).props.onBlur();
  }
  assert.equal(h.blurred, 3);
  assert.equal(h.field('Quantity (units)').props.value, '12.5');
  assert.equal(h.closed, 0);
  assert.equal(h.orders.length, 0);
});
