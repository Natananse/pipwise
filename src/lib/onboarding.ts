import type { Language, Preferences } from './workspace';

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

export function onboardingStartStep(start: string | string[] | undefined): 0 | 2 {
  return start === 'questions' ? 2 : 0;
}

const am: Record<string, string> = {
  'Trade smarter.': 'በብልሃት ይገበያዩ።',
  'Practice wiser.': 'በጥበብ ይለማመዱ።',
  'Build confidence, one practice trade at a time.': 'በእያንዳንዱ የልምምድ ግብይት እምነትዎን ያሳድጉ።',
  'YOUR NEXT CHAPTER STARTS HERE': 'አዲሱ ጉዞዎ እዚህ ይጀምራል',
  'Explore markets. Build confidence. Find your rhythm with $10,000 in virtual funds.': 'ገበያዎችን ያስሱ። በራስዎ ይተማመኑ። በ10,000 ዶላር ምናባዊ ገንዘብ ይለማመዱ።',
  'Virtual money': 'ምናባዊ ገንዘብ',
  'Your pace': 'በእርስዎ ፍጥነት',
  'Get started': 'ይጀምሩ',
  'Language + 3 quick questions': 'ቋንቋ እና 3 አጭር ጥያቄዎች',
  'Continue to questions': 'ወደ ጥያቄዎች ቀጥል',
  'Onboarding questions': 'የመነሻ ጥያቄዎች',
  Continue: 'ቀጥል', Back: 'ተመለስ',
  'Let’s make it yours.': 'ለእርስዎ እናብጅ።',
  'Choose your language': 'ቋንቋዎን ይምረጡ',
  'A familiar language. A clearer start. You can change this in your profile.': 'በሚያውቁት ቋንቋ ይጀምሩ። በኋላ በመገለጫዎ ውስጥ መቀየር ይችላሉ።',
  'A LITTLE ABOUT YOU': 'ስለ እርስዎ ጥቂት ነገር',
  'Question': 'ጥያቄ', 'of': 'ከ', 'Select all that apply': 'የሚመለከቱዎትን ሁሉ ይምረጡ',
  'How experienced are you with trading?': 'በግብይት ምን ያህል ልምድ አለዎት?',
  'We’ll meet you where you are. Everyone starts somewhere.': 'ካሉበት ደረጃ እንጀምራለን። ሁሉም ሰው የሚጀምርበት ቦታ አለው።',
  'Complete beginner': 'ሙሉ በሙሉ ጀማሪ', 'Know the basics': 'መሠረታዊ እውቀት አለኝ', Intermediate: 'መካከለኛ', Experienced: 'ልምድ ያለኝ',
  'I’m ready to learn from the beginning.': 'ከመጀመሪያው ለመማር ዝግጁ ነኝ።',
  'I know a little and want to practice.': 'ጥቂት አውቃለሁ፤ መለማመድ እፈልጋለሁ።',
  'I’ve traded before and want to improve.': 'ከዚህ በፊት ተገበያይቻለሁ፤ መሻሻል እፈልጋለሁ።',
  'I’m here to refine my approach.': 'የግብይት ዘዴዬን ለማሻሻል መጥቻለሁ።',
  'Which markets interest you?': 'የትኞቹ ገበያዎች ያስደስቱዎታል?',
  'Choose one or more. You can explore every market later.': 'አንድ ወይም ከዚያ በላይ ይምረጡ። በኋላ ሁሉንም ገበያዎች ማሰስ ይችላሉ።',
  Forex: 'የውጭ ምንዛሬ', Cryptocurrency: 'ክሪፕቶ ምንዛሬ', 'Gold and Silver': 'ወርቅ እና ብር', 'Oil and Commodities': 'ነዳጅ እና ሸቀጦች', 'Stocks and Indices': 'አክሲዮኖች እና ኢንዴክሶች',
  'Global currencies': 'ዓለም አቀፍ ምንዛሬዎች', 'Bitcoin and digital assets': 'ቢትኮይን እና ዲጂታል ንብረቶች', 'Precious metals': 'ውድ ማዕድናት', 'Energy and raw materials': 'ኃይል እና ጥሬ ዕቃዎች', 'Companies and global indices': 'ኩባንያዎች እና ዓለም አቀፍ ኢንዴክሶች',
  'What is your main goal?': 'ዋና ዓላማዎ ምንድን ነው?',
  'Choose the focus that matters most to you right now.': 'አሁን ለእርስዎ በጣም አስፈላጊውን ዓላማ ይምረጡ።',
  'Learn financial markets': 'የፋይናንስ ገበያዎችን መማር', 'Practice trading': 'ግብይትን መለማመድ', 'Improve strategies': 'ስልቶችን ማሻሻል', 'Understand market analysis': 'የገበያ ትንታኔን መረዳት',
  'Build a strong foundation.': 'ጠንካራ መሠረት ይገንቡ።', 'Try ideas with virtual money.': 'ሃሳቦችዎን በምናባዊ ገንዘብ ይሞክሩ።', 'Review results and refine my process.': 'ውጤቶችን በመገምገም ዘዴዬን ማሻሻል።', 'Get comfortable reading charts.': 'ገበታዎችን በማንበብ ልምድ ማግኘት።',
  'Save & continue': 'አስቀምጥና ቀጥል',
  'Preferences stay on this device. Change them anytime in your profile.': 'ምርጫዎችዎ በዚህ መሣሪያ ይቀመጣሉ። በመገለጫዎ ውስጥ እንደገና ማዘጋጀት ይችላሉ።',
  'Educational simulator · No real money or live quotes.': 'የትምህርት ማስመሰያ · እውነተኛ ገንዘብ ወይም ቀጥታ ዋጋዎች የሉም።',
  'Could not save your setup. Please try again.': 'ምርጫዎችዎን ማስቀመጥ አልተቻለም። እንደገና ይሞክሩ።',
};

export const onboardingText = (language: Language, text: string) => language === 'am' ? am[text] || text : text;
