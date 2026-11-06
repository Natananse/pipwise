import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { AppButton, AppInput, ConfirmationDialog, Label, Sheet } from '../components/design';
import { LanguageSelector } from '../components/LanguageSelector';
import { ReferenceCard, ReferenceScreen, referenceColors as c } from '../components/reference';
import { onboardingText } from '../lib/onboarding';
import { useSession } from '../lib/session';
import { useWorkspace } from '../lib/workspace';
import { AccountDeletionError, requestAccountDeletion } from '../lib/accountDeletion';
import { googleAuthEnabled, signIn, signInWithGoogle } from '../lib/neonAuth';

export default function Settings() {
  const { language, update, preferences } = useWorkspace();
  const { signOut, resetOnboarding, session, demo, finishAccountDeletion } = useSession();
  const [dialog, setDialog] = useState<'logout' | 'delete' | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [reauthenticate, setReauthenticate] = useState(false);
  const [password, setPassword] = useState('');
  const deletionTarget = useRef<string | undefined>(undefined);
  const serverDeleted = useRef(false);
  const [deletedOnServer, setDeletedOnServer] = useState(false);
  const deletionPending = useRef(false);
  const openDeletion = () => {
    deletionTarget.current = session?.user.id;
    serverDeleted.current = false;
    setDeletedOnServer(false);
    setDeleteError(''); setPassword(''); setReauthenticate(false); setDialog('delete');
  };
  const deleteAccount = async () => {
    if (deletionPending.current || !deletionTarget.current) return;
    deletionPending.current = true; setDeleting(true); setDeleteError('');
    try {
      if (!serverDeleted.current) {
        if (reauthenticate) {
          if (!session?.user.email || !password) throw new Error('Enter your password or use Google to confirm your identity.');
          const signedIn = await signIn(session.user.email, password);
          if (signedIn.user.id !== deletionTarget.current) throw new Error('Sign in to the account you chose to delete.');
          setPassword('');
        }
        await requestAccountDeletion(deletionTarget.current);
        serverDeleted.current = true;
        setDeletedOnServer(true);
      }
      await finishAccountDeletion(deletionTarget.current);
      setDialog(null);
      router.replace('/onboarding');
    } catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'DELETED_ACCOUNT_CHANGED') {
        setDialog(null); setError('Your previous account was deleted. Your current account and local data have been preserved.');
        return;
      }
      if (cause instanceof AccountDeletionError && cause.code === 'REAUTHENTICATION_REQUIRED') setReauthenticate(true);
      setDeleteError(serverDeleted.current ? 'Your account was deleted. Tap Confirm deletion again to finish clearing this device.'
        : cause instanceof Error ? cause.message : 'Your account could not be deleted. Please try again.');
    } finally { deletionPending.current = false; setDeleting(false); }
  };
  const confirmGoogle = async () => {
    if (deletionPending.current) return;
    deletionPending.current = true; setDeleting(true); setDeleteError('');
    try {
      const destination = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/delete-account` : '/delete-account';
      await signInWithGoogle(destination);
      setDialog(null);
      router.replace('/delete-account');
    }
    catch { setDeleteError('Google could not confirm your identity. Please try again.'); }
    finally { deletionPending.current = false; setDeleting(false); }
  };
  const review = async (questions: boolean) => {
    setBusy(true); setError('');
    try { await resetOnboarding(); router.replace({ pathname: '/onboarding', params: { start: questions ? 'questions' : 'language' } }); }
    catch { setError('Could not open your preferences. Please try again.'); }
    finally { setBusy(false); }
  };
  return <ReferenceScreen>
    <AppButton label="Back to profile" icon="arrow-back" variant="ghost" onPress={() => router.replace('/profile')} />
    <Label bold size={28} color={c.ink}>Settings</Label>
    <ReferenceCard><AppButton label="Replay onboarding" icon="refresh-outline" onPress={() => { void review(false); }} disabled={busy} /><Label muted size={11}>See the 10-language selection and three setup questions again. Your virtual funds and lesson progress are kept.</Label></ReferenceCard>
    <ReferenceCard><Label bold size={18}>Your account</Label><Label muted size={13}>{demo ? 'Local practice profile' : session?.user.email || 'Practice explorer'}</Label><Label muted size={11}>Your goal: {preferences.goal || 'Explore financial markets'}</Label></ReferenceCard>
    <ReferenceCard><Label bold size={18}>Language</Label><LanguageSelector light value={language} onSelect={value => update({ language: value })} /><Label muted size={11}>10 languages for onboarding and core navigation. Lesson content is currently in English.</Label></ReferenceCard>
    <ReferenceCard>
      <AppButton label={onboardingText(language, 'Onboarding questions')} variant="secondary" icon="options-outline" onPress={() => { void review(true); }} busy={busy} />
      <AppButton label="Portfolio & performance" variant="secondary" icon="pie-chart-outline" onPress={() => router.push('/portfolio')} />
      <AppButton label="Market reading" variant="secondary" icon="newspaper-outline" onPress={() => router.push('/news')} />
      <AppButton label="Send feedback" variant="secondary" icon="chatbubble-ellipses-outline" onPress={() => router.push('/feedback')} />
      <AppButton label="About your data" variant="secondary" icon="shield-checkmark-outline" onPress={() => setPrivacy(true)} />
      <AppButton label="Privacy policy" variant="secondary" icon="document-text-outline" onPress={() => router.push('/privacy-policy')} />
      <AppButton label="Account deletion website" variant="secondary" icon="globe-outline" onPress={() => router.push('/delete-account')} />
      <AppButton label="Trading disclaimer" variant="secondary" icon="information-circle-outline" onPress={() => router.push('/disclaimer')} />
      <AppButton label="Sign out" variant="ghost" icon="log-out-outline" onPress={() => setDialog('logout')} />
      {!!session && <AppButton label="Delete account" variant="danger" icon="trash-outline" onPress={openDeletion} disabled={busy || deleting} />}
      {!!error && <View accessibilityRole="alert"><Label color={c.red}>{error}</Label></View>}
    </ReferenceCard>
    <ConfirmationDialog visible={dialog === 'logout'} title="Leave your workspace?" detail="Your local virtual trades, learning progress and preferences remain on this device." onClose={() => setDialog(null)} onConfirm={() => { setDialog(null); void signOut().catch(() => setError('Could not sign out. Please try again.')); }} />
    <Sheet visible={dialog === 'delete'} title="Permanently delete your account?" onClose={() => { if (!deleting && !deletedOnServer) setDialog(null); }}>
      <Label>All your account data will be permanently deleted, including your profile, feedback and saved review usage. Your local trades, lessons and preferences on this device will also be deleted. This cannot be undone.</Label>
      <Label muted>Local practice data on other devices and files you shared elsewhere must be removed there. If you have a Google Play subscription, cancel its renewal in Google Play separately.</Label>
      <Label bold>{session?.user.email}</Label>
      {reauthenticate && !deletedOnServer && <><Label muted>For your security, sign in again before deleting your account.</Label><AppInput label="Confirm password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" editable={!deleting} />{googleAuthEnabled && <AppButton label="Confirm with Google" variant="secondary" disabled={deleting} onPress={() => { void confirmGoogle(); }} />}</>}
      {!!deleteError && <View accessibilityRole="alert"><Label color={c.red}>{deleteError}</Label></View>}
      <AppButton label="Confirm deletion" variant="danger" busy={deleting} onPress={() => { void deleteAccount(); }} />
      {!deletedOnServer && <AppButton label="Keep my account" variant="secondary" disabled={deleting} onPress={() => setDialog(null)} />}
    </Sheet>
    <Sheet visible={privacy} title="About your data" onClose={() => setPrivacy(false)}><Label>Preferences, virtual trades, chart exercises, avatar and lesson progress stay on this device and do not sync across devices. Local practice storage is not encrypted. Native sign-in credentials use secure device storage.</Label><Label muted>When you create an account, Neon Auth processes your name, email and authentication information. Your country and optional phone number are saved to the account backend. Feedback you submit includes your message, account identifier, rating, category, app version, platform and language.</Label><Label muted>Provider charts can load TradingView content. Store purchases use Google Play and RevenueCat when enabled. Chart files are read only after you select them; automatic photo reviews send the selected image and notes to the configured AI provider only when that feature is enabled and you request a review.</Label><Label muted>Read the privacy policy for operator contact details, retention and account deletion instructions.</Label><AppButton label="Close" onPress={() => setPrivacy(false)} /></Sheet>
  </ReferenceScreen>;
}
