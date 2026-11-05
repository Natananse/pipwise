import { initialWallet, summary, Wallet } from './simulator';

/** Closed results include entry and exit fees. Open P/L is reported separately. */
export function portfolioAnalytics(wallet: Wallet, quotes?: Record<string, number>) {
  const chronological = [...wallet.history].sort((a, b) =>
    Date.parse(a.closed || a.opened) - Date.parse(b.closed || b.opened));
  const results = chronological.map(p => p.pnl ?? 0);
  const wins = results.filter(v => v > 0);
  const losses = results.filter(v => v < 0);
  const grossProfit = wins.reduce((sum, v) => sum + v, 0);
  const grossLoss = -losses.reduce((sum, v) => sum + v, 0);
  let balance = initialWallet.cash;
  let peak = balance;
  let maxDrawdown = 0;
  const curve = [balance];
  for (const result of results) {
    balance += result;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, (peak - balance) / peak * 100);
    curve.push(balance);
  }
  return {
    ...summary(wallet, quotes), chronological, curve, wins: wins.length, losses: losses.length,
    breakeven: results.length - wins.length - losses.length,
    winRate: results.length ? wins.length / results.length * 100 : null,
    profitFactor: grossLoss ? grossProfit / grossLoss : null,
    grossProfit, grossLoss, maxDrawdown,
    averageWin: wins.length ? grossProfit / wins.length : null,
    averageLoss: losses.length ? -grossLoss / losses.length : null,
    bestTrade: results.length ? Math.max(...results) : null,
    worstTrade: results.length ? Math.min(...results) : null,
    expectancy: results.length ? (grossProfit - grossLoss) / results.length : null,
    openFees: wallet.positions.reduce((sum, p) => sum + p.fee, 0),
  };
}
