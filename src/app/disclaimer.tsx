import { router } from 'expo-router';
import React, { useState } from 'react';
import { AppButton, Badge, GlassCard, Icon, Label, Page } from '../components/design';
import { useSession } from '../lib/session';

export const DISCLAIMER = 'Educational content only, not financial advice. Most retail traders lose money.';
export default function Disclaimer() {
  const { acceptDisclaimer } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const continueToPractice = async () => {
    setBusy(true);
    try { await acceptDisclaimer(); router.replace('/practice'); }
    catch { setError('Could not save your acknowledgement. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Page title="Before you start." subtitle="BUILD KNOWLEDGE. UNDERSTAND THE RISKS."><GlassCard><Icon name="shield-checkmark-outline" size={42} color="#087D51" /><Badge>EDUCATIONAL SIMULATOR</Badge><Label size={24} bold>Practice with perspective.</Label><Label>{DISCLAIMER}</Label><Label muted>PipWise shows provider market charts. Its practice simulator uses virtual funds and fixed sample quotes. It does not execute real trades, accept deposits, provide trade signals, or guarantee profit.</Label><Label muted>Stop loss and take profit levels are practice targets. Close simulated positions manually. Results in this workspace do not predict real trading outcomes.</Label>{!!error && <Label color="#C43549">{error}</Label>}<AppButton label="I understand · Continue" busy={busy} onPress={continueToPractice} /></GlassCard></Page>;
}
