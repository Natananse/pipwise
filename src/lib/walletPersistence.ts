import { assets, usdNotional } from './market';
import type { Position, Wallet } from './simulator';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

/** Validate saved trades before portfolio arithmetic or date formatting uses them. */
function isSavedPosition(value: unknown, closed: boolean): value is Position {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()
    || !assets.some(asset => asset.symbol === value.symbol)
    || (value.direction !== 'buy' && value.direction !== 'sell')
    || !positive(value.quantity) || !positive(value.entry)
    || typeof value.fee !== 'number' || !Number.isFinite(value.fee) || value.fee < 0
    || !timestamp(value.opened)
    || (value.pricingSource !== undefined && value.pricingSource !== 'moving-demo-v1')
    || (value.stopLoss !== undefined && !positive(value.stopLoss))
    || (value.takeProfit !== undefined && !positive(value.takeProfit))
    || (value.exit !== undefined && !positive(value.exit))) return false;
  if (closed) {
    if (!timestamp(value.closed) || typeof value.pnl !== 'number' || !Number.isFinite(value.pnl)) return false;
  } else if (value.closed !== undefined || value.pnl !== undefined || value.exit !== undefined) return false;
  const asset = assets.find(asset => asset.symbol === value.symbol)!;
  return Number.isFinite(usdNotional({ ...asset, price: value.entry }, value.quantity));
}

export function isSavedWallet(value: unknown): value is Wallet {
  if (!isRecord(value) || typeof value.cash !== 'number' || !Number.isFinite(value.cash)
    || !Array.isArray(value.positions) || !Array.isArray(value.history)
    || !value.positions.every(position => isSavedPosition(position, false))
    || !value.history.every(position => isSavedPosition(position, true))) return false;
  const positions = value.positions as Position[];
  const history = value.history as Position[];
  const ids = [...positions, ...history].map(position => position.id);
  const reserved = positions.reduce((sum, position) => {
    const asset = assets.find(asset => asset.symbol === position.symbol)!;
    return sum + usdNotional({ ...asset, price: position.entry }, position.quantity);
  }, 0);
  const realized = history.reduce((sum, position) => sum + position.pnl!, 0);
  return new Set(ids).size === ids.length && Number.isFinite(reserved)
    && Number.isFinite(value.cash + reserved) && Number.isFinite(realized);
}
