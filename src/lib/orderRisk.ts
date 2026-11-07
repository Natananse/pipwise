import { type Asset, usdNotional } from './market';
import { feeRate, pnl, type Direction } from './simulator';

export type OrderRisk = { amount: number; percent: number; band: 'green' | 'amber' | 'red' } | { reason: string };

/** An illustrative manual close at the target, including both simulator fees. */
export function estimateOrderRisk(asset: Asset, direction: Direction, quantity: number, stop: number | undefined, cash: number): OrderRisk {
  if (!Number.isFinite(quantity) || quantity <= 0) return { reason: 'Enter a size to estimate risk' };
  if (stop === undefined) return { reason: 'Add a stop target to estimate risk' };
  if (!Number.isFinite(stop) || stop <= 0 || (direction === 'buy' ? stop >= asset.price : stop <= asset.price)) return { reason: 'Stop target must be on the loss side' };
  if (!Number.isFinite(cash) || cash <= 0) return { reason: 'No available virtual balance' };
  const collateral = usdNotional(asset, quantity);
  const exitFee = usdNotional({ ...asset, price: stop }, quantity) * feeRate;
  const loss = -pnl({ id: 'risk-preview', symbol: asset.symbol, direction, quantity, entry: asset.price, opened: '', fee: 0 }, stop);
  const amount = Math.max(0, loss + collateral * feeRate + exitFee);
  if (!Number.isFinite(amount)) return { reason: 'Risk estimate unavailable' };
  const percent = amount / cash * 100;
  return { amount, percent, band: percent <= 1 ? 'green' : percent <= 2 ? 'amber' : 'red' };
}
