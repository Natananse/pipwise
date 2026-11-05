import React from 'react';
import { LiveMarkets } from '../components/LiveMarkets';
import { ThemeSurface } from '../lib/theme';

export default function Markets() {
  return <ThemeSurface tone="dark"><LiveMarkets /></ThemeSurface>;
}
