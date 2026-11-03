import { Asset, assets, usdNotional } from "./market";
export type Direction = "buy" | "sell";
export type Position = {
  id: string;
  symbol: string;
  direction: Direction;
  quantity: number;
  entry: number;
  fee: number;
  opened: string;
  stopLoss?: number;
  takeProfit?: number;
  closed?: string;
  pnl?: number;
};
export type Wallet = {
  cash: number;
  positions: Position[];
  history: Position[];
};
export const initialWallet: Wallet = {
  cash: 10000,
  positions: [],
  history: [],
};
export const feeRate = 0.0002;
function collateralUSD(p: Position) {
  const asset = assets.find((a) => a.symbol === p.symbol)!;
  return usdNotional({ ...asset, price: p.entry }, p.quantity);
}
export function pnl(p: Position, quote?: number) {
  const mark = quote ?? assets.find((a) => a.symbol === p.symbol)!.price;
  const quoteProfit = (mark - p.entry) * p.quantity * (p.direction === "buy" ? 1 : -1);
  // For USD/JPY the price movement is in yen. Convert it at the current yen-per-dollar mark.
  return p.symbol.startsWith('USD/') ? quoteProfit / mark : quoteProfit;
}
export function summary(w: Wallet) {
  const reserved = w.positions.reduce((s, p) => s + collateralUSD(p), 0);
  const unrealized = w.positions.reduce((s, p) => s + pnl(p), 0);
  return {
    reserved,
    unrealized,
    equity: w.cash + reserved + unrealized,
    realized: w.history.reduce((s, p) => s + (p.pnl || 0), 0),
  };
}
export function openOrder(
  w: Wallet,
  asset: Asset,
  direction: Direction,
  quantity: number,
  stopLoss?: number,
  takeProfit?: number,
): Wallet {
  if (!Number.isFinite(quantity) || quantity <= 0)
    throw new Error("Enter a quantity greater than zero.");
  const value = usdNotional(asset, quantity);
  const fee = value * feeRate;
  if (value + fee > w.cash)
    throw new Error("Insufficient virtual funds. Reduce your quantity.");
  if (
    stopLoss !== undefined &&
    (!Number.isFinite(stopLoss) ||
      stopLoss <= 0 ||
      (direction === "buy" ? stopLoss >= asset.price : stopLoss <= asset.price))
  )
    throw new Error(
      "Stop loss must be below a buy entry or above a sell entry.",
    );
  if (
    takeProfit !== undefined &&
    (!Number.isFinite(takeProfit) ||
      takeProfit <= 0 ||
      (direction === "buy"
        ? takeProfit <= asset.price
        : takeProfit >= asset.price))
  )
    throw new Error(
      "Take profit must be above a buy entry or below a sell entry.",
    );
  const p: Position = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    symbol: asset.symbol,
    direction,
    quantity,
    entry: asset.price,
    fee,
    opened: new Date().toISOString(),
    stopLoss,
    takeProfit,
  };
  return { ...w, cash: w.cash - value - fee, positions: [p, ...w.positions] };
}
export function closePosition(w: Wallet, id: string): Wallet {
  const p = w.positions.find((p) => p.id === id);
  if (!p) throw new Error("Position already closed.");
  const gain = pnl(p);
  const exitFee = usdNotional(assets.find((a) => a.symbol === p.symbol)!, p.quantity) * feeRate;
  return {
    cash: w.cash + collateralUSD(p) + gain - exitFee,
    positions: w.positions.filter((p) => p.id !== id),
    history: [
      { ...p, closed: new Date().toISOString(), pnl: gain - p.fee - exitFee },
      ...w.history,
    ],
  };
}
