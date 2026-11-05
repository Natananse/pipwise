const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function harness({ platform = 'android', name = 'chart.csv', size = 100, nativeSize = size, readError, sizeError, canceled = false, modules = true } = {}) {
  const calls = [], deletions = [], revoked = [];
  const selected = { name, size, uri: platform === 'web' ? 'blob:chosen-file' : 'file:///cache/DocumentPicker/chosen-file' };
  const text = async () => { if (readError) throw readError; return 'time,open,high,low,close'; };
  if (platform === 'web') selected.file = { size, text };
  class NativeFile {
    constructor(uri) { this.uri = uri; this.exists = true; }
    get size() { if (sizeError) throw sizeError; return nativeSize; }
    text = text;
    async base64() { if (readError) throw readError; return 'aW1hZ2U='; }
    delete() { deletions.push(this.uri); this.exists = false; }
  }
  class Reader {
    readAsDataURL() { this.result = 'data:image/png;base64,aW1hZ2U='; this.onload(); }
  }
  const imports = {
    expo: { requireOptionalNativeModule: () => modules ? {} : null },
    'react-native': { Platform: { OS: platform } },
    'expo-document-picker': { getDocumentAsync: async options => { calls.push(options); return canceled ? { canceled: true, assets: null } : { canceled: false, assets: [selected] }; } },
    'expo-file-system': { File: NativeFile },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/chartUploads.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, FileReader: Reader, URL: { revokeObjectURL: uri => revoked.push(uri) },
    require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return { api: module.exports, calls, deletions, revoked, selected };
}

test('native picker copies only the selected file and removes its cache after reading', async () => {
  for (const name of ['chart.csv', 'chart.png']) {
    const h = harness({ name, size: 9999999, nativeSize: 100 });
    const result = await h.api.pickChartUpload();
    assert.equal(result.size, 100, 'actual cache size takes precedence over provider metadata');
    assert.equal(h.calls[0].copyToCacheDirectory, true);
    assert.equal(h.calls[0].multiple, false);
    assert.equal(h.calls[0].base64, false);
    assert.deepEqual(h.deletions, [h.selected.uri]);
    if (name.endsWith('.png')) assert.equal(result.uri, 'data:image/png;base64,aW1hZ2U=');
    else assert.equal(result.text, 'time,open,high,low,close');
  }
});

test('rejected and unreadable selections also release native cache and browser URLs', async () => {
  for (const platform of ['android', 'web']) {
    for (const options of [{ name: 'private.pdf' }, { size: 4 * 1024 * 1024 }, { size: 0 }, { readError: new Error('Unreadable') }]) {
      const h = harness({ platform, ...options });
      await assert.rejects(h.api.pickChartUpload());
      assert.deepEqual(platform === 'web' ? h.revoked : h.deletions, [h.selected.uri]);
    }
  }
  const metadata = harness({ sizeError: new Error('No metadata') });
  await assert.rejects(metadata.api.pickChartUpload(), /No metadata/);
  assert.deepEqual(metadata.deletions, [metadata.selected.uri]);
});

test('browser images remain displayable after their object URL is revoked', async () => {
  const h = harness({ platform: 'web', name: 'chart.png' });
  const result = await h.api.pickChartUpload();
  assert.equal(result.uri, 'data:image/png;base64,aW1hZ2U=');
  assert.equal(result.base64, 'aW1hZ2U=');
  assert.deepEqual(h.revoked, [h.selected.uri]);
  assert.deepEqual(h.deletions, []);
});

test('canceling or an older installed build never reads or deletes a file', async () => {
  const canceled = harness({ canceled: true });
  assert.equal(await canceled.api.pickChartUpload(), null);
  assert.deepEqual(canceled.deletions, []);
  const outdated = harness({ modules: false });
  await assert.rejects(outdated.api.pickChartUpload(), /updated Android build/);
  assert.deepEqual(outdated.calls, []);
  assert.deepEqual(outdated.deletions, []);
});
