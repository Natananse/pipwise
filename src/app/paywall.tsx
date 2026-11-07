import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSystemBars } from '../components/ScreenSystemBars';
import { contentBottomPadding } from '../lib/navigation';
import { responsiveLayout } from '../lib/responsiveLayout';
import { AppButton, Icon, Label, Sheet } from '../components/design';
import { ProIllustration } from '../components/ProIllustration';
import { ReferralCard } from '../components/ReferralCard';
import { referenceColors as c } from '../components/reference';
import { useSession } from '../lib/session';
import { fonts, ThemeSurface } from '../lib/theme';

type BillingCycle = 'yearly' | 'monthly';
type Packages = Partial<Record<BillingCycle, PurchasesPackage>>;
type InfoSheet = 'terms' | null;

async function storePackages(): Promise<Packages> {
  if (Platform.OS === 'web' || !(await Purchases.isConfigured())) return {};
  const { current } = await Purchases.getOfferings();
  return {
    yearly: current?.annual || undefined,
    monthly: current?.monthly || undefined,
  };
}

const freeFeatures = [
  { title: 'Lessons and learning progress', detail: 'Study market concepts and save your progress on this device' },
  { title: 'Virtual trading practice', detail: 'Use simulated quotes and virtual funds, then review your portfolio' },
  { title: 'Chart coach studies', detail: 'On-device candle studies and manual ChatGPT prompts' },
];

export default function Paywall() {
  return <ThemeSurface tone="light"><ProScreen /></ThemeSurface>;
}

function ProScreen() {
  const compact = responsiveLayout(useWindowDimensions()).compactHeight;
  const { plan, ready, session, leaveDemo, refreshPlan, preparePurchases } = useSession();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<BillingCycle>('yearly');
  const [packages, setPackages] = useState<Packages>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState<InfoSheet>(null);
  const currentPackage = packages[selected];
  const unavailable = !packages.yearly && !packages.monthly;

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void storePackages().then(next => {
      if (!active) return;
      setPackages(next);
      if (!next.yearly && next.monthly) setSelected('monthly');
    }).catch(() => {
      if (active) setMessage('Store plans could not be loaded. Free lessons and practice remain available.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready]);

  const openSignIn = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await leaveDemo(); router.push('/auth'); }
    catch { setMessage('Sign-in could not be opened. Please try again.'); }
    finally { setBusy(false); }
  };
  const purchase = async () => {
    if (busy) return;
    if (plan !== 'free') { router.replace('/practice'); return; }
    if (!currentPackage) { router.replace('/practice'); return; }
    if (!session) { await openSignIn(); return; }
    setBusy(true);
    setMessage('');
    try {
      await preparePurchases();
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
      if (!session) {
        setMessage('Sign in before restoring purchases so your subscription is linked to your PipWise account.');
        return;
      }
      await preparePurchases();
      const customerInfo = await Purchases.restorePurchases();
      await refreshPlan();
      setMessage(customerInfo.entitlements.active.pro || customerInfo.entitlements.active.elite
        ? 'Your Pro subscription has been restored.'
        : 'No active Pro subscription was found for this store account.');
    } catch { setMessage('Your purchases could not be restored. Please try again with the store account used to subscribe.'); }
    finally { setBusy(false); }
  };
  const price = (cycle: BillingCycle) => packages[cycle]?.product.priceString;
  const monthlyEquivalent = packages.yearly?.product.pricePerMonthString;

  return <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
    <ScreenSystemBars style="dark" backgroundColor="#FFFFFF" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingBottom: contentBottomPadding({ bottomInset: insets.bottom, wide: false, tabRoute: false, contentGap: 45 }) }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => router.replace('/profile')} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, opacity: pressed ? 0.6 : 1 })}><Icon name="close" color={c.ink} size={22} /></Pressable>
        <Label bold size={13} color={c.ink}>PIPWISE <Label bold size={13} color={c.blue}>PRO</Label></Label>
        <View style={{ width: 42 }} />
      </View>
      <ProIllustration height={compact ? 140 : 220} />
      <View style={{ paddingHorizontal: 22, gap: 25 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ paddingHorizontal: 22, paddingVertical: 11, borderRadius: 99, backgroundColor: c.ink }}><Label bold size={12} color="#FFFFFF">{plan !== 'free' ? 'YOUR PRO MEMBERSHIP' : 'LEARN MORE. PRACTICE WISER.'}</Label></View>
          <Label size={28} bold color={c.ink} style={{ textAlign: 'center', fontFamily: fonts.extraBold, letterSpacing: -0.8 }}>Keep building your practice.</Label>
          <Label size={13} color={c.muted} style={{ textAlign: 'center', maxWidth: 430 }}>Learn market concepts, practice with virtual funds, and review your decisions.</Label>
        </View>
        <ReferralCard compact />
        <View style={{ gap: 18, paddingHorizontal: 2 }}>
          <Label bold size={16} color={c.ink}>INCLUDED ON FREE</Label>
          {freeFeatures.map(feature => <View key={feature.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ backgroundColor: '#E3F7EA', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}><Icon name="checkmark" color={c.green} size={19} /></View><View style={{ flex: 1, gap: 3 }}><Label size={14} color={c.ink}>{feature.title}</Label><Label size={10} color={c.muted}>{feature.detail}</Label></View></View>)}
          <Label size={11} color={c.muted}>Your simulator, lessons, practice analytics, candle-file studies and manual ChatGPT workflow stay available on Free.</Label>
        </View>
        <AppButton label="Open free Chart coach" icon="scan-outline" variant="secondary" onPress={() => router.push('/chart-coach')} />
        <AppButton label="Open free lessons" icon="book-outline" variant="secondary" onPress={() => router.push('/learn')} />
        {loading ? <View style={{ padding: 25, alignItems: 'center', gap: 10 }}><ActivityIndicator color={c.blue} /><Label muted size={12}>Checking available plans…</Label></View> : unavailable ? <View style={{ padding: 18, backgroundColor: c.bg, borderRadius: 18, gap: 8 }}><Label bold size={16}>Subscriptions are currently unavailable.</Label><Label size={12} color={c.muted}>No store plans are available to purchase. Continue with free lessons and virtual practice.</Label></View> : <View accessibilityRole="radiogroup" style={{ gap: 15 }}>
          {(['yearly', 'monthly'] as const).filter(cycle => packages[cycle]).map(cycle => <Pressable key={cycle} accessibilityRole="radio" accessibilityState={{ checked: selected === cycle, disabled: busy }} disabled={busy} onPress={() => setSelected(cycle)} style={({ pressed }) => ({ minHeight: 105, padding: 18, borderRadius: 25, borderWidth: selected === cycle ? 2 : 1.5, borderColor: selected === cycle ? c.blue : '#E1E6EC', backgroundColor: selected === cycle ? '#ECF3FE' : '#FFFFFF', gap: 5, opacity: pressed ? 0.75 : 1 })}>
            {cycle === 'yearly' && <View style={{ position: 'absolute', right: 18, top: -12, backgroundColor: c.blue, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}><Label bold size={10} color="#FFFFFF">YEARLY PLAN</Label></View>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 13, alignItems: 'center' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.blue, alignItems: 'center', justifyContent: 'center' }}>{selected === cycle && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.blue }} />}</View>
              <View style={{ flex: 1, gap: 5 }}><Label bold size={18} color={c.ink}>{cycle === 'yearly' ? 'Yearly' : 'Monthly'}</Label><Label size={10} color={c.muted}>{cycle === 'yearly' ? monthlyEquivalent ? `≈ ${monthlyEquivalent}/month · billed yearly` : 'Billed once each year' : 'Billed monthly · cancel renewal anytime'}</Label></View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}><Label bold size={20} color={c.ink}>{price(cycle)}</Label><Label size={10} color={c.muted}>{cycle === 'yearly' ? '/ year' : '/ month'}</Label></View>
            </View>
          </Pressable>)}
        </View>}
        {!!message && <View accessibilityRole="alert" style={{ padding: 16, backgroundColor: c.bg, borderRadius: 16 }}><Label size={12} color={c.ink}>{message}</Label></View>}
        {!session && Platform.OS !== 'web' && <View style={{ gap: 8 }}><Label size={11} color={c.muted}>Sign in before subscribing or restoring purchases. Your membership will be linked to your PipWise account.</Label><AppButton label="Sign in to link purchases" variant="secondary" disabled={busy} onPress={() => { void openSignIn(); }} /></View>}
        <View style={{ gap: 13 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || loading, busy }} disabled={busy || loading} onPress={() => { void purchase(); }} style={({ pressed }) => ({ minHeight: 61, borderRadius: 24, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', opacity: busy || loading ? 0.5 : pressed ? 0.8 : 1, boxShadow: '0px 12px 24px rgba(33,107,235,0.18)' })}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Label bold size={19} color="#FFFFFF">{plan !== 'free' ? 'Continue practicing' : currentPackage ? session ? 'Start now' : 'Sign in to subscribe' : 'Continue free practice'}</Label>}</Pressable>
          {currentPackage && <Label size={11} color={c.muted} style={{ textAlign: 'center' }}>{`${selected === 'yearly' ? 'Annual' : 'Monthly'} subscription · ${price(selected)} per ${selected === 'yearly' ? 'year' : 'month'}. Renews automatically until canceled in your store account.`}</Label>}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 18 }}>
          {[{ title: 'Restore', action: () => { void restore(); } }, { title: 'Terms', action: () => setInfo('terms') }, { title: 'Privacy', action: () => router.push('/privacy-policy') }].map(link => <Pressable key={link.title} accessibilityRole="button" accessibilityLabel={link.title === 'Restore' ? 'Restore purchases' : link.title} disabled={busy} onPress={link.action} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6, opacity: pressed || busy ? 0.5 : 1 })}><Label size={12} color={c.muted}>{link.title}</Label></Pressable>)}
        </View>
      </View>
    </ScrollView>
    <Sheet visible={info === 'terms'} onClose={() => setInfo(null)} title="Subscription information">
      <Label>PipWise provides educational lessons, virtual trading and chart studies. It does not execute brokerage trades, accept deposits, or guarantee returns.</Label>
      <Label muted>If a store subscription is available, its displayed price and billing period apply. Subscriptions renew automatically unless canceled through your store account. Review the store confirmation before purchasing and use Restore to reconnect an existing entitlement.</Label>
      <Label muted>Free lessons, simulator and local chart studies remain available without a subscription. Deleting your PipWise account does not cancel store renewal. Your privacy choices and account deletion instructions are available in the privacy policy.</Label>
      <AppButton label="Read privacy policy" variant="secondary" onPress={() => { setInfo(null); router.push('/privacy-policy'); }} />
    </Sheet>
  </SafeAreaView>;
}
