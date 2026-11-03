import type { Asset } from './market';

export type MarketVisual = {
  color: string;
  ink: string;
  tint: string;
  label: string;
  mark: string;
};

const ink = '#161A19';
const visuals: Record<string, MarketVisual> = {
  'EUR/USD': { color: '#ACA7FF', ink, tint: '#29263E', label: 'Euro', mark: '€' },
  'BTC/USD': { color: '#FFAA53', ink, tint: '#382A1D', label: 'Bitcoin', mark: '₿' },
  'USD/JPY': { color: '#FF8C9E', ink, tint: '#38242C', label: 'Dollar / Yen', mark: '$' },
  'WTI/USD': { color: '#6EE7BE', ink, tint: '#1D332B', label: 'Crude oil', mark: 'Oil' },
  'GBP/USD': { color: '#D4A3FF', ink, tint: '#31263D', label: 'British pound', mark: '£' },
  'XAU/USD': { color: '#F3D66C', ink, tint: '#36301D', label: 'Gold', mark: 'Au' },
  'SPX/USD': { color: '#79D7F7', ink, tint: '#1D3038', label: 'S&P 500', mark: 'S&P' },
};

/** A pair keeps its identity across the market rail, quote and chart. */
export function marketVisual(asset: Asset): MarketVisual {
  return visuals[asset.symbol] ?? {
    color: '#C8F169', ink, tint: '#2B3422', label: asset.name, mark: asset.mark,
  };
}
