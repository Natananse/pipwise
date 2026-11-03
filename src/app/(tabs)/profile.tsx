import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AvatarId, AvatarPortrait } from '../../components/AvatarPortrait';
import { AppButton, AppInput, Icon, Label, Sheet } from '../../components/design';
import { referenceColors as c } from '../../components/reference';
import { lessons } from '../../lib/lessons';
import { money } from '../../lib/market';
import { useSession } from '../../lib/session';
import { initialWallet, pnl, Position, summary } from '../../lib/simulator';
import { fonts, ThemeSurface } from '../../lib/theme';
import { useWorkspace } from '../../lib/workspace';

export default function Profile() {
  return <ThemeSurface tone="light"><ProfileWorkspace /></ThemeSurface>;
}

function ProfileWorkspace() {
  const { session, demo, plan } = useSession();
  const { wallet, completed, profile, update, storageError } = useWorkspace();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const carousel = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [page, setPage] = useState(0);
  const [cardWidth, setCardWidth] = useState(Math.min(width - 32, 940));
  const [trades, setTrades] = useState<'Open' | 'Closed'>('Open');
  const [editor, setEditor] = useState(false);
  const [brokerGuide, setBrokerGuide] = useState(false);
  const [draftName, setDraftName] = useState(profile.displayName);
  const [draftAvatar, setDraftAvatar] = useState<AvatarId>(profile.avatarId);
  const [saveError, setSaveError] = useState('');
  const stats = summary(wallet);
  const gain = (stats.equity / initialWallet.cash - 1) * 100;
  const wins = wallet.history.filter(position => (position.pnl ?? 0) > 0).length;
  const complete = lessons.filter(lesson => completed.includes(lesson.id)).length;
  const positions = trades === 'Open' ? wallet.positions : wallet.history;
  const nickname = profile.displayName || (session?.user.id ? `Trader #${traderNumber(session.user.id)}` : 'Practice trader');
  const wide = width > 1050;
  const footerSpace = wide ? 40 : 104 + insets.bottom;
  const openEditor = () => { setDraftName(profile.displayName || nickname); setDraftAvatar(profile.avatarId); setSaveError(''); setEditor(true); };
  const saveProfile = () => {
    if (!draftName.trim()) { setSaveError('Enter a display name to continue.'); return; }
    update({ profile: { displayName: draftName.trim(), avatarId: draftAvatar } });
    setEditor(false);
  };

  return <View style={{ flex: 1, backgroundColor: c.bg }}>
    <StatusBar style="light" />
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: footerSpace, flexGrow: 1 }}>
      <View style={{ height: wide ? 300 : 268 + insets.top, backgroundColor: c.charcoal }}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}><Defs><LinearGradient id="profile-hero" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor={c.heroStart} /><Stop offset="1" stopColor={c.heroEnd} /></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#profile-hero)" /><Rect y="99%" width="100%" height="1%" fill={c.mint} opacity={0.35} /></Svg>
        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, alignItems: 'center', width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 20 }}>
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingTop: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Profile settings" onPress={() => router.push('/settings')} style={({ pressed }) => [styles.heroButton, { width: 42, opacity: pressed ? 0.65 : 1 }]}><Icon name="settings-outline" size={24} color="#FFFFFF" /></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Explore Pro" onPress={() => router.push('/paywall')} style={({ pressed }) => [styles.heroButton, { paddingHorizontal: 18, opacity: pressed ? 0.65 : 1 }]}><Text style={{ fontFamily: fonts.extraBold, fontSize: 15, color: c.lemon }}>{plan === 'free' ? 'PRO' : plan.toUpperCase()}</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit your profile and avatar" onPress={openEditor} style={({ pressed }) => ({ marginTop: wide ? 5 : 17, opacity: pressed ? 0.8 : 1 })}>
            <AvatarPortrait avatar={profile.avatarId} size={wide ? 104 : 94} />
            <View style={styles.editBadge}><Icon name="pencil-outline" size={16} color={c.charcoal} /></View>
          </Pressable>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{ color: '#FFFFFF', fontSize: width < 360 ? 23 : 27, lineHeight: 36, fontFamily: fonts.extraBold, textAlign: 'center', alignSelf: 'stretch', marginTop: 12 }}>{nickname}</Text>
          <Text style={{ color: '#FFFFFFD9', fontSize: 10, fontFamily: fonts.medium, marginTop: 3 }}>{demo ? 'Your virtual trading journey' : 'Your personal practice workspace'}</Text>
        </SafeAreaView>
      </View>
      <View style={{ maxWidth: 1000, width: '100%', alignSelf: 'center', paddingHorizontal: wide ? 30 : 16, marginTop: -31, gap: 20 }}>
        <View onLayout={event => setCardWidth(event.nativeEvent.layout.width)} style={styles.statsCard}>
          <ScrollView ref={carousel} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event => setPage(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, event.nativeEvent.layoutMeasurement.width)))}>
            <View style={[styles.statPage, { width: cardWidth }]}>
              <StatCell icon="trending-up-outline" value={`${Math.abs(gain) < 0.005 ? '0' : gain.toFixed(2)}%`} caption="Total return" onPress={() => router.push('/portfolio')} />
              <StatCell icon="wallet-outline" value={money(stats.equity).replace('.00', '')} caption="Portfolio" onPress={() => router.push('/portfolio')} divided />
              <StatCell icon="people-outline" caption="Friends" action="INVITE" onPress={() => router.push('/invite')} divided />
            </View>
            <View style={[styles.statPage, { width: cardWidth }]}>
              <StatCell icon="school-outline" value={`${complete}/${lessons.length}`} caption="Lessons" onPress={() => router.push('/learn')} />
              <StatCell icon="checkmark-circle-outline" value={String(wins)} caption="Winning trades" onPress={() => router.push('/portfolio')} divided />
              <StatCell icon="layers-outline" value={String(wallet.positions.length)} caption="Open trades" onPress={() => setTrades('Open')} divided />
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 13 }}>{[0, 1].map(index => <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Profile statistics page ${index + 1}`} accessibilityState={{ selected: page === index }} onPress={() => { carousel.current?.scrollTo({ x: index * cardWidth, animated: true }); setPage(index); }} hitSlop={10} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: page === index ? c.ink : '#CAD2DE' }} />)}</View>
        </View>
        {!!storageError && <View accessibilityRole="alert"><Label size={12} color={c.red}>{storageError}</Label></View>}
        <Pressable accessibilityRole="button" accessibilityLabel="Explore the broker comparison guide" onPress={() => setBrokerGuide(true)} style={({ pressed }) => [styles.brokerBanner, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ width: 76, height: 38, flexDirection: 'row', alignItems: 'center' }}>
            {([{ icon: 'swap-horizontal-outline', color: '#70EDAB' }, { icon: 'flash-outline', color: '#D3F94B' }, { icon: 'shield-checkmark-outline', color: '#FFFFFF' }] as const).map((badge, index) => <View key={badge.icon} style={{ position: 'absolute', left: index * 22, width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: badge.color, alignItems: 'center', justifyContent: 'center' }}><Icon name={badge.icon} size={18} color={c.ink} /></View>)}
          </View>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ fontFamily: fonts.extraBold, color: c.ink, fontSize: 14 }}>Find your broker fit</Text><Text style={{ fontFamily: fonts.medium, color: c.muted, fontSize: 11, lineHeight: 17 }}>Know what to compare before you choose a broker.</Text></View>
          <Icon name="chevron-forward" size={22} color="#BFC8D2" />
        </Pressable>
        <View style={styles.tradesCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontFamily: fonts.extraBold, color: c.ink, fontSize: 18 }}>My trades</Text>
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, backgroundColor: '#E9EDF3', borderRadius: 24 }}>
              {(['Open', 'Closed'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityLabel={`${value} trades`} accessibilityState={{ selected: trades === value }} onPress={() => setTrades(value)} style={({ pressed }) => ({ minHeight: 34, paddingHorizontal: width < 360 ? 11 : 15, justifyContent: 'center', borderRadius: 20, backgroundColor: trades === value ? '#FFFFFF' : 'transparent', opacity: pressed ? 0.7 : 1 })}><Text style={{ fontFamily: fonts.bold, color: trades === value ? c.ink : '#5D6877', fontSize: 12 }}>{value}</Text></Pressable>)}
            </View>
          </View>
          {!positions.length ? <View style={{ minHeight: 94, justifyContent: 'center', alignItems: 'center', paddingTop: 18, gap: 3 }}>
            <Text style={{ fontFamily: fonts.medium, color: c.muted, fontSize: 12, textAlign: 'center' }}>No {trades.toLowerCase()} trades yet</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open a new practice trade" onPress={() => router.push('/practice')} style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Text style={{ fontFamily: fonts.semibold, color: '#3478B5', textDecorationLine: 'underline', fontSize: 13 }}>open a new one</Text></Pressable>
          </View> : <View style={{ paddingTop: 18, gap: 12 }}>{positions.slice(0, 5).map(position => <ProfileTrade key={position.id} position={position} closed={trades === 'Closed'} />)}<Pressable accessibilityRole="button" accessibilityLabel="View portfolio and performance" onPress={() => router.push('/portfolio')} style={({ pressed }) => ({ minHeight: 38, justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.6 : 1 })}><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.blue }}>View full portfolio →</Text></Pressable></View>}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, gap: 10 }}><Text style={{ color: c.muted, fontFamily: fonts.medium, fontSize: 10, flex: 1 }}>Practice money · Simulated market quotes</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile settings" onPress={() => router.push('/settings')} style={({ pressed }) => ({ minHeight: 40, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Text style={{ fontFamily: fonts.bold, color: c.blue, fontSize: 11 }}>Settings</Text></Pressable></View>
      </View>
    </ScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel="Scroll profile to top" onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })} style={({ pressed }) => ({ position: 'absolute', right: 16, bottom: wide ? 20 : 91 + Math.max(insets.bottom, 8), width: 40, height: 40, borderRadius: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1, borderWidth: 2, borderColor: '#FFFFFF' })}><Icon name="arrow-up" size={21} color="#FFFFFF" /></Pressable>
    <Sheet visible={editor} title="Make it yours" onClose={() => setEditor(false)}>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}><AvatarPortrait avatar={draftAvatar} size={100} /></View>
      <AppInput label="Display name" value={draftName} onChangeText={setDraftName} maxLength={32} autoCapitalize="words" placeholder="Your trader name" />
      <Label bold size={13}>Choose an avatar</Label>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 14, justifyContent: 'center' }}>{(['trader', 'bull', 'owl'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} avatar`} accessibilityState={{ checked: draftAvatar === value }} onPress={() => setDraftAvatar(value)} style={{ borderWidth: 2, borderColor: draftAvatar === value ? c.blue : 'transparent', borderRadius: 44, padding: 4 }}><AvatarPortrait avatar={value} size={66} /></Pressable>)}</View>
      {!!saveError && <View accessibilityRole="alert"><Label color={c.red} size={12}>{saveError}</Label></View>}
      <AppButton label="Save profile" onPress={saveProfile} />
    </Sheet>
    <Sheet visible={brokerGuide} title="Find your broker fit" onClose={() => setBrokerGuide(false)}>
      <Label muted>Personal broker matching is not connected. Start with these questions when comparing services available in your country.</Label>
      {[['Account access', 'Which products, account types and demo tools are available where you live?'], ['Costs to compare', 'Review spreads, commissions, currency conversion, inactivity charges and withdrawal fees.'], ['Your practice routine', 'Try the platform’s charting and order controls in a demo account before committing funds.']].map(([title, detail]) => <View key={title} style={{ gap: 6, padding: 16, borderRadius: 18, backgroundColor: '#F1F5FA' }}><Label bold color={c.ink}>{title}</Label><Label muted size={12}>{detail}</Label></View>)}
      <AppButton label="Keep practicing" onPress={() => { setBrokerGuide(false); router.push('/practice'); }} />
    </Sheet>
  </View>;
}

function StatCell({ icon, value, caption, action, onPress, divided = false }: {
  icon: React.ComponentProps<typeof Icon>['name']; value?: string; caption: string; action?: string; onPress: () => void; divided?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${caption}${value ? ` ${value}` : ''}`} onPress={onPress} style={({ pressed }) => ({ flex: 1, minWidth: 0, paddingHorizontal: 8, alignItems: 'center', gap: 6, minHeight: 80, borderLeftWidth: divided ? 1 : 0, borderColor: '#E8ECF0', opacity: pressed ? 0.65 : 1 })}>
    <Icon name={icon} size={21} color={c.ink} />
    {action ? <View style={{ backgroundColor: c.blue, paddingVertical: 3, paddingHorizontal: 13, borderRadius: 15, marginTop: 3 }}><Text style={{ color: '#FFFFFF', fontFamily: fonts.extraBold, fontSize: 11 }}>{action}</Text></View> : <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: c.ink, fontFamily: fonts.extraBold, fontSize: 20, marginTop: 2 }}>{value}</Text>}
    <Text numberOfLines={2} style={{ color: c.muted, fontFamily: fonts.semibold, fontSize: 11, textAlign: 'center' }}>{caption}</Text>
  </Pressable>;
}

function ProfileTrade({ position, closed }: { position: Position; closed: boolean }) {
  const result = closed ? position.pnl ?? 0 : pnl(position);
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${position.symbol} ${position.direction} trade`} onPress={() => router.push('/portfolio')} style={({ pressed }) => ({ paddingVertical: 10, borderTopWidth: 1, borderColor: '#EBEFF4', flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.65 : 1 })}>
    <View style={{ width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: position.direction === 'buy' ? '#E5F7EC' : '#FDEBEC' }}><Icon name={position.direction === 'buy' ? 'arrow-up' : 'arrow-down'} color={position.direction === 'buy' ? c.green : c.red} size={16} /></View>
    <View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.bold, color: c.ink, fontSize: 12 }}>{position.symbol}</Text><Text style={{ color: c.muted, fontFamily: fonts.medium, fontSize: 10 }}>{position.direction.toUpperCase()} · {position.quantity} units</Text></View>
    <View style={{ alignItems: 'flex-end' }}><Text style={{ color: result < 0 ? c.red : c.green, fontFamily: fonts.bold, fontSize: 12 }}>{result > 0 ? '+' : result < 0 ? '−' : ''}{money(Math.abs(result))}</Text><Text style={{ color: c.muted, fontFamily: fonts.medium, fontSize: 9 }}>{closed ? 'NET RESULT' : 'OPEN P&L'}</Text></View>
  </Pressable>;
}

function traderNumber(id: string) {
  let value = 0;
  for (let index = 0; index < id.length; index += 1) value = (value * 31 + id.charCodeAt(index)) >>> 0;
  return String(value % 10000000).padStart(7, '0');
}

const styles = StyleSheet.create({
  heroButton: { height: 42, borderRadius: 22, borderWidth: 1, borderColor: `${c.mint}40`, backgroundColor: `${c.mint}0F`, alignItems: 'center', justifyContent: 'center' },
  editBadge: { position: 'absolute', top: 4, right: -3, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: c.charcoal, backgroundColor: c.mint, alignItems: 'center', justifyContent: 'center' },
  statsCard: { backgroundColor: '#FFFFFF', borderRadius: 25, paddingTop: 20, shadowColor: '#213B67', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4, overflow: 'hidden' },
  statPage: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 7, paddingBottom: 15 },
  brokerBanner: { minHeight: 84, borderRadius: 21, borderWidth: 1, borderColor: '#E5EAF0', backgroundColor: '#F5F7FB', paddingHorizontal: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tradesCard: { borderWidth: 1, borderColor: '#E5EAF0', borderRadius: 24, backgroundColor: '#FFFFFF', padding: 18 },
});
