export type ProviderChartInfo = Readonly<{
  symbol: string;
  providerSymbol: string;
  title: string;
  note: string;
  url: string;
}>;

const charts: Record<string, ProviderChartInfo> = {
  'EUR/USD': { symbol: 'EUR/USD', providerSymbol: 'FX:EURUSD', title: 'Euro / U.S. Dollar', note: 'Provider forex chart. Quotes can differ between data providers.', url: 'https://www.tradingview.com/symbols/EURUSD/?exchange=FX' },
  'GBP/USD': { symbol: 'GBP/USD', providerSymbol: 'FX:GBPUSD', title: 'British Pound / U.S. Dollar', note: 'Provider forex chart. Quotes can differ between data providers.', url: 'https://www.tradingview.com/symbols/GBPUSD/?exchange=FX' },
  'USD/JPY': { symbol: 'USD/JPY', providerSymbol: 'FX:USDJPY', title: 'U.S. Dollar / Japanese Yen', note: 'Provider forex chart. Quotes can differ between data providers.', url: 'https://www.tradingview.com/symbols/USDJPY/?exchange=FX' },
  'BTC/USD': { symbol: 'BTC/USD', providerSymbol: 'BITSTAMP:BTCUSD', title: 'Bitcoin / U.S. Dollar · Bitstamp', note: 'Bitstamp market data. Other exchanges may quote different prices.', url: 'https://www.tradingview.com/symbols/BTCUSD/?exchange=BITSTAMP' },
  'XAU/USD': { symbol: 'XAU/USD', providerSymbol: 'TVC:GOLD', title: 'Gold · TradingView calculated quote', note: 'TradingView-derived gold reference chart, rather than an exchange spot execution quote.', url: 'https://www.tradingview.com/symbols/GOLD/?exchange=TVC' },
  'WTI/USD': { symbol: 'WTI/USD', providerSymbol: 'TVC:USOIL', title: 'CFD on WTI Crude Oil · TradingView', note: 'This is a WTI crude-oil CFD reference chart, not spot oil or a specific futures contract.', url: 'https://www.tradingview.com/symbols/USOIL/?exchange=TVC' },
  'SPX/USD': { symbol: 'SPX/USD', providerSymbol: 'FOREXCOM:SPX500', title: 'S&P 500 CFD reference · FOREX.com', note: 'FOREX.com S&P 500 CFD reference, different from the exchange cash index or an execution price. Provider quotes and delays can differ from other sources.', url: 'https://www.tradingview.com/symbols/SPX500/?exchange=FOREXCOM' },
};

/** Explicit display-only mappings. Unknown markets never substitute another instrument. */
export function getProviderChart(symbol: string): ProviderChartInfo | null {
  return Object.prototype.hasOwnProperty.call(charts, symbol) ? charts[symbol] : null;
}

/** Official widget configuration. This exposes no prices or programmatic data feed. */
export function providerChartOptions(symbol: string) {
  const chart = getProviderChart(symbol);
  return chart ? {
    autosize: true,
    symbol: chart.providerSymbol,
    interval: '60',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    allow_symbol_change: false,
    calendar: false,
    support_host: 'https://www.tradingview.com',
  } : null;
}
