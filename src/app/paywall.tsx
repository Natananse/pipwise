import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, Icon, Label, Sheet } from '../components/design';
import { ProIllustration } from '../components/ProIllustration';
import { ReferralCard } from '../components/ReferralCard';
import { referenceColors as c } from '../components/reference';
import { useSession } from '../lib/session';
import { fonts, ThemeSurface } from '../lib/theme';

type BillingCycle = 'yearly' | 'monthly';
type Packages = Partial<Record<BillingCycle, PurchasesPackage>>;
type InfoSheet = 'preview' | 'terms' | 'privacy' | null;

async function storePackages(): Promise<Packages> {
  if (Platform.OS === 'web' || !(await Purchases.isConfigured())) return {};
  const { current } = await Purchases.getOfferings();
  return {
    yearly: current?.annual || undefined,
    monthly: current?.monthly || undefined,
  };
}

const roadmap = [
  { title: '50 chart screenshot reviews each month', detail: 'Planned · understand trends and possible scenarios' },
  { title: 'Your saved analysis collection', detail: 'Planned · revisit reports and learning notes' },
  { title: 'Deeper performance reviews', detail: 'Planned · reflect on your practice and trading habits' },
];

export default function Paywall() {
  return <ThemeSurface tone="light"><ProScreen /></ThemeSurface>;
}

function ProScreen() {
  const { plan, ready, refreshPlan } = useSession();
  const [selected, setSelected] = useState<BillingCycle>('yearly');
  const [packages, setPackages] = useState<Packages>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState<InfoSheet>(null);
  const currentPackage = packages[selected];
  const preview = !packages.yearly && !packages.monthly;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void storePackages().then(next => {
      if (!active) return;
      setPackages(next);
      if (!next.yearly && next.monthly) setSelected('monthly');
    }).catch(() => {
      if (active) setMessage('Store plans could not be loaded. You can still explore the preview below.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready]);

  const purchase = async () => {
    if (busy) return;
    if (plan !== 'free') { router.replace('/practice'); return; }
    if (!currentPackage) { setInfo('preview'); return; }
    setBusy(true);
    setMessage('');
    try {
      const { customerInfo } = await Purchases.purchasePackage(currentPackage);
      await refreshPlan();
      setMessage(customerInfo.entitlements.active.pro || customerInfo.entitlements.active.elite
        ? 'Your Pro access is active. Welcome to your next chapter.'
        : 'Your purchase was received. If access is still pending, use Restore to check again.');
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'userCancelled' in error && error.userCancelled))
        setMessage('The purchase could not be completed. Check your store connection and try again.');
    } finally { setBusy(false); }
  };
  const restore = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (Platform.OS === 'web' || !(await Purchases.isConfigured())) {
        setMessage('Restore is available in the mobile app when store purchases are connected. Your Free practice account remains available.');
        return;
      }
      const customerInfo = await Purchases.restorePurchases();
      await refreshPlan();
      setMessage(customerInfo.entitlements.active.pro || customerInfo.entitlements.active.elite
        ? 'Your Pro subscription has been restored.'
        : 'No active Pro subscription was found for this store account.');
    } catch { setMessage('Your purchases could not be restored. Please try again with the store account used to subscribe.'); }
    finally { setBusy(false); }
  };
  const price = (cycle: BillingCycle) => packages[cycle]?.product.priceString || (cycle === 'yearly' ? '$59.99' : '$7.99');
  const monthlyEquivalent = packages.yearly?.product.pricePerMonthString || (preview ? '$5.00' : null);

  return <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
    <StatusBar style="dark" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: 45 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => router.replace('/profile')} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, opacity: pressed ? 0.6 : 1 })}><Icon name="close" color={c.ink} size={22} /></Pressable>
        <Label bold size={13} color={c.ink}>PIPWISE <Label bold size={13} color={c.blue}>PRO</Label></Label>
        <View style={{ width: 42 }} />
      </View>
      <ProIllustration />
      <View style={{ paddingHorizontal: 22, gap: 25 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ paddingHorizontal: 22, paddingVertical: 11, borderRadius: 99, backgroundColor: c.ink }}><Label bold size={12} color="#FFFFFF">{plan !== 'free' ? 'YOUR PRO MEMBERSHIP' : preview ? 'YOUR NEXT CHAPTER · PREVIEW' : 'LEARN MORE. PRACTICE WISER.'}</Label></View>
          <Label size={28} bold color={c.ink} style={{ textAlign: 'center', fontFamily: fonts.extraBold, letterSpacing: -0.8 }}>Make room for your next level.</Label>
          <Label size={13} color={c.muted} style={{ textAlign: 'center', maxWidth: 430 }}>More ways to learn, review your decisions, and build a thoughtful trading process.</Label>
        </View>
        <ReferralCard compact />
        <View style={{ gap: 18, paddingHorizontal: 2 }}>
          <Label bold size={16} color={c.ink}>THE PIPWISE PRO ROADMAP</Label>
          {roadmap.map(feature => <View key={feature.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ backgroundColor: '#E3F7EA', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Icon name="checkmark" color={c.green} size={19} /></View><View style={{ flex: 1, gap: 3 }}><Label size={14} color={c.ink}>{feature.title}</Label><Label size={10} color={c.muted}>{feature.detail}</Label></View></View>)}
          <Label size={11} color={c.muted}>These additions are in development. Your current simulator, lesson challenge, portfolio, and practice analytics stay available on Free.</Label>
        </View>
        {loading ? <View style={{ padding: 25, alignItems: 'center', gap: 10 }}><ActivityIndicator color={c.blue} /><Label muted size={12}>Checking available plans…</Label></View> : <View accessibilityRole="radiogroup" style={{ gap: 15 }}>
          {(['yearly', 'monthly'] as const).map(cycle => <Pressable key={cycle} accessibilityRole="radio" accessibilityState={{ checked: selected === cycle, disabled: busy }} disabled={busy} onPress={() => setSelected(cycle)} style={({ pressed }) => ({ minHeight: 105, padding: 18, borderRadius: 25, borderWidth: selected === cycle ? 2 : 1.5, borderColor: selected === cycle ? c.blue : '#E1E6EC', backgroundColor: selected === cycle ? '#ECF3FE' : '#FFFFFF', gap: 5, opacity: pressed ? 0.75 : 1 })}>
            {cycle === 'yearly' && <View style={{ position: 'absolute', right: 18, top: -12, backgroundColor: c.blue, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}><Label bold size={10} color="#FFFFFF">YEARLY PLAN</Label></View>}
            <View style={{ flexDirection: 'row', gap: 13, alignItems: 'center' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.blue, alignItems: 'center', justifyContent: 'center' }}>{selected === cycle && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.blue }} />}</View>
              <View style={{ flex: 1, gap: 5 }}><Label bold size={18} color={c.ink}>{cycle === 'yearly' ? 'Yearly' : 'Monthly'}</Label><Label size={10} color={c.muted}>{cycle === 'yearly' ? monthlyEquivalent ? `≈ ${monthlyEquivalent}/month · billed yearly` : 'Billed once each year' : 'Billed monthly · cancel renewal anytime'}</Label></View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}><Label bold size={20} color={c.ink}>{price(cycle)}</Label><Label size={10} color={c.muted}>{packages[cycle] ? cycle === 'yearly' ? '/ year' : '/ month' : 'USD preview'}</Label></View>
            </View>
          </Pressable>)}
        </View>}
        {!!message && <View accessibilityRole="alert" style={{ padding: 16, backgroundColor: c.bg, borderRadius: 16 }}><Label size={12} color={c.ink}>{message}</Label></View>}
        <View style={{ gap: 13 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || loading, busy }} disabled={busy || loading} onPress={() => { void purchase(); }} style={({ pressed }) => ({ minHeight: 61, borderRadius: 24, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', opacity: busy || loading ? 0.5 : pressed ? 0.8 : 1, boxShadow: '0px 12px 24px rgba(33,107,235,0.18)' })}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Label bold size={19} color="#FFFFFF">{plan !== 'free' ? 'Continue practicing' : currentPackage ? 'Start now' : 'Explore Pro preview'}</Label>}</Pressable>
          <Label size={11} color={c.muted} style={{ textAlign: 'center' }}>{currentPackage ? `${selected === 'yearly' ? 'Annual' : 'Monthly'} subscription · ${price(selected)} per ${selected === 'yearly' ? 'year' : 'month'}. Renews automatically until canceled in your store account.` : 'Illustrative USD pricing. No charge or subscription starts from this preview.'}</Label>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 18 }}>
          {[{ title: 'Restore', action: () => { void restore(); } }, { title: 'Terms', action: () => setInfo('terms') }, { title: 'Privacy', action: () => setInfo('privacy') }].map(link => <Pressable key={link.title} accessibilityRole="button" disabled={busy} onPress={link.action} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6, opacity: pressed || busy ? 0.5 : 1 })}><Label size={12} color={c.muted}>{link.title}</Label></Pressable>)}
        </View>
      </View>
    </ScrollView>
    <Sheet visible={!!info} onClose={() => setInfo(null)} title={info === 'terms' ? 'Subscription information' : info === 'privacy' ? 'Your practice, your privacy' : 'Pro is taking shape'}>
      {info === 'preview' ? <><Label bold size={21}>A stronger practice starts free.</Label><Label muted>The Pro features and USD prices shown here are a product preview. A subscription is not available for this selected plan. No payment has been taken.</Label><Label muted>Keep learning, open virtual positions, and review your portfolio while these additions take shape.</Label><AppButton label="Keep practicing for free" onPress={() => { setInfo(null); router.replace('/practice'); }} /></> : info === 'terms' ? <><Label>Pipwise is an educational simulator. It uses virtual funds and sample quotes and does not execute brokerage trades, accept deposits, or guarantee returns.</Label><Label muted>Where a store plan is available, review the exact price, billing period, and renewal information in the Apple or Google confirmation before purchasing. Subscription access is checked through your store receipt and RevenueCat.</Label><Label muted>Preview prices and planned features can change. This summary describes the current product; it is not a complete published Terms of Service agreement.</Label></> : <><Label>Your onboarding preferences, lesson progress, profile, and virtual wallet are saved on this device using local app storage.</Label><Label muted>If you sign in, Supabase manages account authentication. Store purchases are managed by Apple or Google and RevenueCat. This app does not collect payment-card details.</Label><Label muted>Chart screenshot uploads and referral reward tracking are not active in this preview. This summary explains current behavior; a complete privacy policy is needed before a public subscription launch.</Label></>}
    </Sheet>
  </SafeAreaView>;
}
