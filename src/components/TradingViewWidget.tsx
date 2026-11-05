'use dom';

import React, { useEffect, useRef, useState } from 'react';
import type { DOMProps } from 'expo/dom';
import { getProviderChart, providerChartOptions } from '../lib/providerCharts';

type Props = { symbol: string; height: number; dom?: DOMProps };

/** TradingView owns the isolated chart and its data; nothing is extracted from it. */
export default function TradingViewWidget({ symbol, height }: Props) {
  const chart = getProviderChart(symbol);
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    const target = container.current;
    const options = providerChartOptions(symbol);
    if (!target || !options) return;
    let active = true;
    let loaded = false;
    let frame: HTMLIFrameElement | null = null;
    const onLoad = () => {
      if (!active) return;
      loaded = true;
      clearTimeout(timer);
      // This means the hosted widget loaded, not that its market feed is live.
      setStatus('loaded');
    };
    const fail = () => { if (active) setStatus('error'); };
    const timer = setTimeout(() => { if (!loaded) fail(); }, 20000);
    const observer = new MutationObserver(() => {
      const next = target.querySelector('iframe');
      if (next && next !== frame) {
        frame?.removeEventListener('load', onLoad);
        frame = next;
        frame.addEventListener('load', onLoad);
      }
    });
    observer.observe(target, { childList: true, subtree: true });
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify(options);
    script.addEventListener('error', fail);
    target.appendChild(script);
    return () => {
      active = false;
      clearTimeout(timer);
      observer.disconnect();
      frame?.removeEventListener('load', onLoad);
      frame?.remove();
      script.removeEventListener('error', fail);
      script.remove();
    };
  }, [symbol, attempt]);

  if (!chart) return <div style={{ color: '#FF9DA5', padding: 20, fontFamily: 'sans-serif' }}>This market has no configured provider chart.</div>;
  return <div style={{ height, width: '100%', position: 'relative', background: '#131722', color: '#F4F6EF', fontFamily: 'sans-serif', overflow: 'hidden' }}>
    <style>{'html,body,#root{margin:0;width:100%;background:#131722}*{box-sizing:border-box}'}</style>
    <div ref={container} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
      <div className="tradingview-widget-container__widget" style={{ height: 'calc(100% - 32px)', width: '100%' }} />
      <div className="tradingview-widget-copyright" style={{ height: 32, fontSize: 13, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
        <a href={chart.url} rel="noopener nofollow" target="_blank" style={{ color: '#73A8FF', textDecoration: 'none' }}><span className="blue-text">{chart.title} chart</span></a><span className="trademark"> by TradingView</span>
      </div>
    </div>
    {status !== 'loaded' && <div role="status" aria-live="polite" style={{ position: 'absolute', inset: '0 0 32px', background: '#131722', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
      <strong style={{ fontSize: 15 }}>{status === 'loading' ? 'Loading provider chart…' : 'Provider chart could not be loaded'}</strong>
      <span style={{ color: '#A0AAA2', fontSize: 12, lineHeight: '18px' }}>{status === 'loading' ? 'An internet connection is needed. Data availability and delays are shown by the provider.' : 'Check your connection and retry, or open the official chart below.'}</span>
      {status === 'error' && <button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }} style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: '1px solid #47765D', color: '#6EE7BE', background: '#21382D', cursor: 'pointer' }}>Retry chart</button>}
    </div>}
  </div>;
}
