const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports,
    require: name => load(path.resolve(path.dirname(file), `${name}.ts`)),
  });
  return module.exports;
}

const { languages, isLanguage, languageInfo } = load('src/lib/languages.ts');
const { translations, translationKeys, translate } = load('src/lib/translations.ts');
const { onboardingQuestions } = load('src/lib/onboarding.ts');

test('ten unique supported languages retain Amharic and identify Arabic direction', () => {
  const codes = Array.from(languages, language => language.code);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  assert.deepEqual(codes, ['en', 'es', 'fr', 'pt', 'ar', 'hi', 'zh', 'id', 'sw', 'am']);
  for (const language of languages) {
    assert.equal(isLanguage(language.code), true);
    assert.equal(languageInfo(language.code).nativeName, language.nativeName);
    assert.equal(language.rtl, language.code === 'ar');
    assert(language.nativeName.trim());
    assert(language.mark.trim());
  }
  for (const value of [undefined, null, 1, {}, [], 'EN', 'en-US', '', 'constructor']) assert.equal(isLanguage(value), false);
});

test('every non-English language covers every onboarding title, detail and answer', () => {
  assert.equal(new Set(translationKeys).size, translationKeys.length, 'source keys must not overwrite one another');
  const questionKeys = onboardingQuestions.flatMap(question => [
    question.title, question.detail, ...question.options.flatMap(option => [option.value, option.detail]),
  ]);
  for (const key of questionKeys) assert(translationKeys.includes(key), `Missing source key: ${key}`);
  for (const { code } of languages) {
    if (code === 'en') continue;
    const dictionary = translations[code];
    assert.equal(Object.keys(dictionary).length, translationKeys.length);
    for (const key of translationKeys) {
      assert.equal(typeof dictionary[key], 'string', `${code}: ${key}`);
      assert(dictionary[key].trim(), `${code}: ${key} is empty`);
      assert.equal(translate(code, key), dictionary[key]);
    }
  }
});

test('translation preserves English and has a safe fallback for untranslated app content', () => {
  for (const { code } of languages) {
    for (const key of ['A lesson that is still in English', 'constructor', '__proto__', 'toString', '']) {
      assert.equal(translate(code, key), key);
    }
  }
  assert.equal(translate('en', 'Continue'), 'Continue');
  assert.equal(translate('es', 'Continue'), 'Continuar');
  assert.equal(translate('ar', 'Choose your language'), 'اختر لغتك');
  assert.equal(translate('am', 'Trade'), 'ግብይት');
});
