import React from 'react';
import { MarketDesk } from '../components/MarketDesk';
import { MarketDataProvider } from '../lib/marketProvider';
import { ThemeSurface } from '../lib/theme';

export default function MarketTools() {
  return <ThemeSurface tone="dark"><MarketDataProvider><MarketDesk /></MarketDataProvider></ThemeSurface>;
}
