import { assets, generateCandles } from './market';

export const practiceRoundCount = 10;
export type Prediction = 'up' | 'down';
/** Future candles are held back until a choice is made; the exercise has no wallet stakes. */
export function chartPracticeRound(index: number) {
  const symbols = ['USD/JPY', 'EUR/USD', 'BTC/USD', 'GBP/USD', 'XAU/USD', 'WTI/USD', 'SPX/USD'];
  const asset = assets.find(item => item.symbol === symbols[index % symbols.length])!;
  const frame = ['4h', '1h', '15m', '1D'][index % 4];
  const candles = generateCandles(asset, frame);
  const split = 58 + index % practiceRoundCount * 3;
  const visible = candles.slice(split - 48, split);
  const future = candles.slice(split, split + 5);
  const entry = visible[visible.length - 1].close;
  const exit = future[future.length - 1].close;
  const result: Prediction = exit >= entry ? 'up' : 'down';
  return { id: `chart-practice-v1-${index}`, asset, frame, visible, future, entry, exit, result };
}
