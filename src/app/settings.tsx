import { router } from 'expo-router';
import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { AppButton, Chip, ConfirmationDialog, Label, Row, Sheet } from '../components/design';
import { ReferenceCard, ReferenceScreen, referenceColors as c } from '../components/reference';
import { onboardingText } from '../lib/onboarding';
import { useSession } from '../lib/session';
import { useWorkspace } from '../lib/workspace';

export default function Settings() {
  const { language, notifications, update, preferences } = useWorkspace();
  const { signOut, resetOnboarding, session, demo } = useSession();
  const [dialog, setDialog] = useState<'logout' | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const review = async (questions: boolean) => {
    setBusy(true); setError('');
    try { await resetOnboarding(); router.replace({ pathname: '/onboarding', params: questions ? { start: 'questions' } : {} }); }
    catch { setError('Could not open your preferences. Please try again.'); }
    finally { setBusy(false); }
  };
  return <ReferenceScreen>
    <AppButton label="Back to profile" icon="arrow-back" variant="ghost" onPress={() => router.replace('/profile')} />
    <Label bold size={28} color={c.ink}>Settings</Label>
    <ReferenceCard><Label bold size={18}>Your account</Label><Label muted size={13}>{demo ? 'Local practice profile' : session?.user.email || 'Practice explorer'}</Label><Label muted size={11}>Your goal: {preferences.goal || 'Explore financial markets'}</Label></ReferenceCard>
    <ReferenceCard><Label bold size={18}>Language</Label><Row style={{ justifyContent: 'flex-start' }}>{(['en', 'am'] as const).map(value => <Chip key={value} label={value === 'en' ? 'English' : 'አማርኛ'} selected={language === value} onPress={() => update({ language: value })} />)}</Row><Label muted size={11}>Amharic covers onboarding and core navigation. Learning content is currently in English.</Label></ReferenceCard>
    <ReferenceCard><Row><View style={{ flex: 1, gap: 5 }}><Label bold>Practice reminders</Label><Label muted size={11}>Saved preference · Push delivery is not connected.</Label></View><Switch accessibilityLabel="Practice reminders" value={notifications} onValueChange={value => update({ notifications: value })} trackColor={{ true: c.blue, false: '#DCE2EA' }} /></Row></ReferenceCard>
    <ReferenceCard>
      <AppButton label={onboardingText(language, 'Onboarding questions')} variant="secondary" icon="options-outline" onPress={() => { void review(true); }} busy={busy} />
      <AppButton label="Replay welcome & language setup" variant="secondary" icon="refresh-outline" onPress={() => { void review(false); }} disabled={busy} />
      <AppButton label="Portfolio & performance" variant="secondary" icon="pie-chart-outline" onPress={() => router.push('/portfolio')} />
      <AppButton label="Market reading" variant="secondary" icon="newspaper-outline" onPress={() => router.push('/news')} />
      <AppButton label="About your data" variant="secondary" icon="shield-checkmark-outline" onPress={() => setPrivacy(true)} />
      <AppButton label="Trading disclaimer" variant="secondary" icon="information-circle-outline" onPress={() => router.push('/disclaimer')} />
      <AppButton label="Sign out" variant="ghost" icon="log-out-outline" onPress={() => setDialog('logout')} />
      {!!error && <View accessibilityRole="alert"><Label color={c.red}>{error}</Label></View>}
    </ReferenceCard>
    <ConfirmationDialog visible={dialog === 'logout'} title="Leave your workspace?" detail="Your local virtual trades, learning progress and preferences remain on this device." onClose={() => setDialog(null)} onConfirm={() => { setDialog(null); void signOut().catch(() => setError('Could not sign out. Please try again.')); }} />
    <Sheet visible={privacy} title="Your practice data" onClose={() => setPrivacy(false)}><Label>Preferences, virtual trades, chart exercises, avatar and lesson progress are stored locally on this device. Local app storage is not encrypted.</Label><Label muted>Supabase handles account authentication when configured. This version does not sync practice records across devices. Referral verification, live market data and AI screenshot analysis are not connected.</Label><AppButton label="Close" onPress={() => setPrivacy(false)} /></Sheet>
  </ReferenceScreen>;
}
