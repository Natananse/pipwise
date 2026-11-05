const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');

function load(file) {
  const moduleOutput = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module: moduleOutput, exports: moduleOutput.exports,
    require: name => {
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return moduleOutput.exports;
}
const { startupRedirect } = load('src/lib/startup.ts');
const { hasCompleteOnboardingAnswers, onboardingStartStep, onboardingQuestions } = load('src/lib/onboarding.ts');
const completeAnswers = {
  experience: 'Know the basics',
  markets: ['Forex', 'Gold and Silver'],
  goal: 'Practice trading',
};

function redirectWithAnswers(preferences, overrides = {}) {
  return startupRedirect({
    onboarded: true,
    answersComplete: hasCompleteOnboardingAnswers(preferences),
    authenticated: true,
    top: undefined,
    ...overrides,
  });
}

test('first-time users must finish onboarding even when opening a tab directly', () => {
  for (const top of [undefined, '(tabs)', 'auth', 'settings']) {
    for (const answersComplete of [false, true]) {
      assert.equal(startupRedirect({ onboarded: false, answersComplete, authenticated: false, top }), '/onboarding');
      assert.equal(startupRedirect({ onboarded: false, answersComplete, authenticated: true, top }), '/onboarding');
    }
  }
  assert.equal(startupRedirect({ onboarded: false, answersComplete: false, authenticated: false, top: 'onboarding' }), null);
});

test('a legacy completion flag cannot hide any unanswered question', () => {
  const incompleteAnswers = [
    { experience: '', markets: [], goal: '' },
    { ...completeAnswers, experience: '' },
    { ...completeAnswers, markets: [] },
    { ...completeAnswers, goal: '' },
  ];
  for (const preferences of incompleteAnswers) {
    for (const top of [undefined, '(tabs)', 'auth', 'settings']) {
      assert.equal(redirectWithAnswers(preferences, { top }), '/onboarding');
      assert.equal(redirectWithAnswers(preferences, { top, authenticated: false }), '/onboarding');
    }
    assert.equal(redirectWithAnswers(preferences, { top: 'onboarding' }), null);
  }
});

test('all supported answer values count as complete and require at least one valid market', () => {
  assert.equal(onboardingQuestions.length, 3);
  for (const experience of onboardingQuestions[0].options) {
    for (const market of onboardingQuestions[1].options) {
      for (const goal of onboardingQuestions[2].options) {
        assert.equal(hasCompleteOnboardingAnswers({ experience: experience.value, markets: [market.value], goal: goal.value }), true);
      }
    }
  }
  assert.equal(hasCompleteOnboardingAnswers(completeAnswers), true);
  for (const preferences of [
    { ...completeAnswers, experience: ' ' },
    { ...completeAnswers, experience: 'Unknown experience' },
    { ...completeAnswers, markets: ['Unknown market'] },
    { ...completeAnswers, markets: ['Forex', 'Unknown market'] },
    { ...completeAnswers, markets: [''] },
    { ...completeAnswers, goal: ' ' },
    { ...completeAnswers, goal: 'Unknown goal' },
  ]) {
    assert.equal(hasCompleteOnboardingAnswers(preferences), false);
    assert.equal(redirectWithAnswers(preferences), '/onboarding');
  }
});

test('returning signed-out users with complete answers skip questions and reach authentication', () => {
  for (const top of [undefined, '(tabs)', 'onboarding']) {
    assert.equal(redirectWithAnswers(completeAnswers, { authenticated: false, top }), '/auth');
  }
  assert.equal(redirectWithAnswers(completeAnswers, { authenticated: false, top: 'auth' }), null);
});

test('returning signed-in or demo users with complete answers go straight to trading and retain valid deep links', () => {
  for (const top of [undefined, 'auth', 'onboarding']) {
    assert.equal(redirectWithAnswers(completeAnswers, { top }), '/practice');
  }
  for (const top of ['(tabs)', 'settings', 'paywall']) {
    assert.equal(redirectWithAnswers(completeAnswers, { top }), null);
  }
});

test('the explicit questions entry opens question one without accepting arbitrary step values', () => {
  assert.equal(onboardingStartStep('questions'), 1);
  for (const start of [undefined, '', 'welcome', '2', '4', '5', '-1', 'Questions', [], ['questions'], ['questions', '4']]) {
    assert.equal(onboardingStartStep(start), 0);
  }
});

test('cold confirmation and recovery links finish before onboarding and authentication redirects', () => {
  for (const top of ['auth-callback', 'reset-password']) {
    for (const onboarded of [false, true]) {
      for (const answersComplete of [false, true]) {
        for (const authenticated of [false, true]) {
          assert.equal(startupRedirect({ onboarded, answersComplete, authenticated, top }), null);
        }
      }
    }
  }
});

test('recovery sessions reach the password form before ordinary app navigation', () => {
  for (const top of [undefined, '(tabs)', 'auth', 'onboarding', 'settings']) {
    for (const onboarded of [false, true]) {
      assert.equal(startupRedirect({ onboarded, answersComplete: onboarded, authenticated: true, passwordRecovery: true, top }), '/reset-password');
    }
    assert.equal(startupRedirect({ onboarded: true, answersComplete: true, authenticated: false, passwordRecovery: true, top }), top === 'auth' ? null : '/auth');
  }
});
