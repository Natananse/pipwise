import { router } from 'expo-router';
import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AppButton, Badge, GlassCard, Icon, Label, Page, Row, Sheet } from '../components/design';
import { Plan, useSession } from '../lib/session';

const plans: { id: Plan; name: string; description: string; features: string[] }[] = [
  { id: 'free', name: 'Free', description: 'Start with curiosity.', features: ['$10,000 starting virtual balance', 'Practice orders and portfolio history', 'Foundational lessons and quick checks', 'Favorites and practice analytics'] },
  { id: 'pro', name: 'Pro', description: 'Make room for a deeper practice.', features: ['Planned: expanded learning paths', 'Planned: deeper journal insights', 'Planned: additional practice tools'] },
  { id: 'elite', name: 'Elite', description: 'Keep building your process.', features: ['Planned: everything in Pro', 'Planned: advanced learning collections', 'Planned: extended performance reviews'] },
];
export default function Paywall() {
  const { plan } = useSession();
  const wide = useWindowDimensions().width > 900;
  const [selected, setSelected] = useState<string | null>(null);
  return <Page title="Invest in your understanding." subtitle="YOUR LEARNING. YOUR PACE.">
    <AppButton label="Back to profile" variant="ghost" icon="arrow-back" onPress={() => router.replace('/profile')} />
    <GlassCard><Badge>PLANS PREVIEW</Badge><Label size={27} bold>A strong foundation starts free.</Label><Label muted>The current simulator is available on Free. Pro and Elite are previews of future learning plans. Pricing and checkout are not available in this app.</Label></GlassCard>
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18 }}>{plans.map(p => <GlassCard key={p.id} style={{ flex: 1, borderColor: p.id === plan ? '#087D51' : undefined }}><Row><Label size={26} bold>{p.name}</Label>{p.id === plan ? <Badge>CURRENT PLAN</Badge> : <Badge>COMING LATER</Badge>}</Row><Label muted>{p.description}</Label><Label size={30} bold>{p.id === 'free' ? '$0' : 'In development'}</Label><Label muted size={12}>{p.id === 'free' ? 'No payment required' : 'Pricing to be announced'}</Label>{p.features.map(feature => <Row key={feature} style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }}><Icon name={p.id === 'free' ? 'checkmark-circle-outline' : 'ellipse-outline'} color="#087D51" /><View style={{ flex: 1 }}><Label size={13}>{feature}</Label></View></Row>)}<AppButton label={p.id === 'free' ? 'Continue practicing' : `About ${p.name}`} variant={p.id === 'free' ? 'primary' : 'secondary'} onPress={() => p.id === 'free' ? router.replace('/practice') : setSelected(p.name)} /></GlassCard>)}</View>
    <Sheet visible={!!selected} title={`${selected || 'Plan'} preview`} onClose={() => setSelected(null)}><Label bold size={22}>More ways to learn are taking shape.</Label><Label muted>This plan is not available for purchase. The listed features are planned and may change. Your current practice tools remain available.</Label><AppButton label="Keep exploring Free" onPress={() => { setSelected(null); router.replace('/practice'); }} /></Sheet>
  </Page>;
}
