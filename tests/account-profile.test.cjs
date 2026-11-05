const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/accountProfile.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { normalizeProfileName, profileNameMaxLength } = moduleUnderTest.exports;

test('profile names preserve international and single-word names while normalizing spacing', () => {
  for (const name of ['ናትናኤል', '李小明', 'محمد', 'Cher', 'Jean-Luc O’Connor', 'José Álvarez']) {
    assert.equal(normalizeProfileName(name), name);
  }
  assert.equal(normalizeProfileName('  ናትናኤል\u00a0  ተስፋዬ\u3000 '), 'ናትናኤል ተስፋዬ');
});

test('blank, control-character and overlength names are rejected without truncating real names', () => {
  for (const name of ['', '   ', '\u00a0\u3000']) assert.throws(() => normalizeProfileName(name), /Enter your name/);
  for (const name of ['Name\nOther', 'Name\tOther', 'Name\u0000Other', 'Name\u0085Other']) {
    assert.throws(() => normalizeProfileName(name), /without line breaks or control characters/);
  }
  assert.equal(profileNameMaxLength, 80);
  assert.equal(normalizeProfileName('ጽ'.repeat(80)), 'ጽ'.repeat(80));
  assert.throws(() => normalizeProfileName('ጽ'.repeat(81)), /80 characters or fewer/);
  assert.throws(() => normalizeProfileName(undefined), /Enter your name/);
});
