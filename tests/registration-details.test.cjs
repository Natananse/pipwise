const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/registrationDetails.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports, Error });
const { normalizeRegistrationDetails, registrationCountries, registrationCountry, searchRegistrationCountries } = moduleUnderTest.exports;

test('country catalog supports international regions and searching by name, code and calling code', () => {
  assert.ok(registrationCountries.length > 240);
  assert.equal(new Set(registrationCountries.map(item => item.code)).size, registrationCountries.length);
  assert.equal(registrationCountry('ET').dialCode, '+251');
  assert.equal(registrationCountry('US').dialCode, '+1');
  assert.equal(registrationCountry('GB').dialCode, '+44');
  for (const query of ['ethiopia', ' ET ', '+251']) assert.ok(searchRegistrationCountries(query).some(item => item.code === 'ET'));
  assert.equal(searchRegistrationCountries('no-such-country').length, 0);
});

test('signup requires a known country while contact phone remains optional', () => {
  assert.throws(() => normalizeRegistrationDetails({ countryCode: '' }), /Choose your country/);
  assert.throws(() => normalizeRegistrationDetails({ countryCode: 'ZZ' }), /Choose your country/);
  assert.equal(normalizeRegistrationDetails({ countryCode: ' et ', phoneNumber: ' ' }).phoneNumber, null);
  assert.equal(normalizeRegistrationDetails({ countryCode: ' et ' }).countryCode, 'ET');
  assert.equal(normalizeRegistrationDetails({ countryCode: '' }, { requireCountry: false }).countryCode, '');
});

test('international contact numbers normalize formatting without pretending to verify ownership', () => {
  const result = normalizeRegistrationDetails({ countryCode: 'ET', phoneNumber: ' +251 (912) 345-678 ' });
  assert.equal(result.phoneNumber, '+251912345678');
  assert.equal(normalizeRegistrationDetails({ countryCode: 'US', phoneNumber: '+1 202 555 0123' }).phoneNumber, '+12025550123');
  assert.equal(normalizeRegistrationDetails({ countryCode: 'GB', phoneNumber: '+44 20 7946 0123' }).phoneNumber, '+442079460123');
  for (const phoneNumber of ['0912345678', '+0251912345678', '+25112', '+2511234567890123', '+251912345678 ext 1', '++251912345678', '+251912\u0000345678']) {
    assert.throws(() => normalizeRegistrationDetails({ countryCode: 'ET', phoneNumber }), /international phone|calling code/);
  }
  assert.throws(() => normalizeRegistrationDetails({ countryCode: 'ET', phoneNumber: '+12025550123' }), /\+251 calling code/);
  assert.throws(() => normalizeRegistrationDetails({ countryCode: '', phoneNumber: '+251912345678' }, { requireCountry: false }), /before adding a phone/);
});
