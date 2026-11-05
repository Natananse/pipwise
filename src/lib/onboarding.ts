import type { Preferences } from './workspace';
import { translate } from './translations';

export const onboardingQuestions = [
  {
    title: 'How experienced are you with trading?',
    detail: 'We’ll meet you where you are. Everyone starts somewhere.',
    options: [
      { value: 'Complete beginner', detail: 'I’m ready to learn from the beginning.', icon: 'leaf-outline' },
      { value: 'Know the basics', detail: 'I know a little and want to practice.', icon: 'bulb-outline' },
      { value: 'Intermediate', detail: 'I’ve traded before and want to improve.', icon: 'trending-up-outline' },
      { value: 'Experienced', detail: 'I’m here to refine my approach.', icon: 'ribbon-outline' },
    ],
  },
  {
    title: 'Which markets interest you?',
    detail: 'Choose one or more. You can explore every market later.',
    options: [
      { value: 'Forex', detail: 'Global currencies', icon: 'swap-horizontal-outline' },
      { value: 'Cryptocurrency', detail: 'Bitcoin and digital assets', icon: 'logo-bitcoin' },
      { value: 'Gold and Silver', detail: 'Precious metals', icon: 'diamond-outline' },
      { value: 'Oil and Commodities', detail: 'Energy and raw materials', icon: 'flame-outline' },
      { value: 'Stocks and Indices', detail: 'Companies and global indices', icon: 'bar-chart-outline' },
    ],
  },
  {
    title: 'What is your main goal?',
    detail: 'Choose the focus that matters most to you right now.',
    options: [
      { value: 'Learn financial markets', detail: 'Build a strong foundation.', icon: 'book-outline' },
      { value: 'Practice trading', detail: 'Try ideas with virtual money.', icon: 'stats-chart-outline' },
      { value: 'Improve strategies', detail: 'Review results and refine my process.', icon: 'options-outline' },
      { value: 'Understand market analysis', detail: 'Get comfortable reading charts.', icon: 'analytics-outline' },
    ],
  },
] as const;

/** A legacy completion flag alone does not mean the three questions were saved. */
export function hasCompleteOnboardingAnswers(preferences: Preferences) {
  return onboardingQuestions[0].options.some(option => option.value === preferences.experience)
    && preferences.markets.length > 0
    && preferences.markets.every(market => onboardingQuestions[1].options.some(option => option.value === market))
    && onboardingQuestions[2].options.some(option => option.value === preferences.goal);
}

export function onboardingStartStep(start: string | string[] | undefined): 0 | 1 {
  return start === 'questions' ? 1 : 0;
}

export const onboardingText = translate;
