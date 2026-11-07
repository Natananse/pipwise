/** Trade-only presentation tokens; shared light/dark themes and setup stay intact. */
export const tradeColors = {
  bg: '#F7F5EF',
  surface: '#FFFFFF',
  raised: '#ECEFE6',
  text: '#202622',
  sub: '#62695F',
  border: '#DDE2D7',
  grid: '#E8ECE3',
  primary: '#C8F169',
  onPrimary: '#202622',
  mint: '#D7EEDD',
  lime: '#C8F169',
  up: '#18754D',
  down: '#B33F48',
  average: '#8A641B',
  sell: '#ECEFE6',
  sellText: '#202622',
  positiveTint: '#EAF4D8',
  negativeTint: '#FAE6E2',
  overlay: '#20262233',
} as const;

export const tradeSpace = { xs: 8, sm: 16, md: 24, lg: 32, xl: 40 } as const;
export const tradeRadii = { pill: 999, card: 28, control: 14 } as const;
export const tradeType = { caption: 11, label: 12, body: 14, title: 22, hero: 56 } as const;
