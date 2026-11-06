import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { AppButton, AppInput, Label } from '../components/design';
import { LegalPage, LegalSection, LegalText } from '../components/LegalPage';
import { requestAccountDeletion } from '../lib/accountDeletion';
import { completeAuthCallback } from '../lib/authLinks';
import { AccountAccessError, googleAuthEnabled, requestPasswordReset, resendVerification, resetPassword, signIn, signInWithGoogle, verifyEmail } from '../lib/neonAuth';
import { useSession } from '../lib/session';
import { withStartupTimeout } from '../lib/startupTasks';
import { legalDetails } from '../lib/legal';

export default function DeleteAccount() {
  const { ready, session, authConfigured, initializationError, retryInitialization, finishAccountDeletion, signOut } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [confirmationEntry, setConfirmationEntry] = useState<{ accountId?: string; value: string }>({ value: '' });
  const [verification, setVerification] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [reauthentication, setReauthentication] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [localCleared, setLocalCleared] = useState(false);
  const submitting = useRef(false);
  const deletedAccountId = useRef<string | undefined>(undefined);
  const confirmation = confirmationEntry.accountId === session?.user.id ? confirmationEntry.value : '';
  const setConfirmation = (value: string) => setConfirmationEntry({ accountId: session?.user.id, value });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined'
      || !new URLSearchParams(window.location.search).has('neon_auth_session_verifier')) return;
    let active = true;
    void completeAuthCallback(window.location.href).then(() => {
      if (active) router.replace('/delete-account');
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Google sign-in could not finish. Please try again.');
    });
    return () => { active = false; };
  }, []);

  const run = async (task: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setMessage(''); setError('');
    try { await task(); }
    catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'DELETED_ACCOUNT_CHANGED') {
        setDeleted(false); setLocalCleared(false); deletedAccountId.current = undefined;
        setMessage('Your previous account was deleted. Your current account and local data have been preserved.');
        return;
      }
      if (cause instanceof AccountAccessError && cause.code === 'EMAIL_NOT_VERIFIED') setVerification(true);
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'REAUTHENTICATION_REQUIRED') {
        setReauthentication(true); setConfirmation(''); setEmail(session?.user.email || '');
      }
      setError(cause instanceof Error ? cause.message : 'The request failed. Please try again.');
    } finally { submitting.current = false; setBusy(false); }
  };
  const address = () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Enter the email address for your PipWise account.');
    return value;
  };
  const login = () => run(async () => {
    if (password.length < 8) throw new Error('Enter your account password.');
    await withStartupTimeout(signIn(address(), password), 'Sign-in took too long. Please try again.');
    setPassword(''); setCode(''); setVerification(false); setRecovery(false); setReauthentication(false);
  });
  const google = () => run(async () => {
    const callback = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/delete-account` : '/delete-account';
    await signInWithGoogle(callback);
  });
  const requestRecovery = () => run(async () => {
    await withStartupTimeout(requestPasswordReset(address()), 'The recovery request took too long. Please try again.');
    setRecovery(true); setVerification(false); setPassword(''); setCode('');
    setMessage('If the account can use password recovery, a code will be sent to its email address. Enter the code and a new password below.');
  });
  const recover = () => run(async () => {
    if (!code.trim()) throw new Error('Enter the recovery code from your email.');
    if (password.length < 8) throw new Error('Choose a new password of at least 8 characters.');
    await withStartupTimeout(resetPassword(code.trim(), password, address()), 'Password reset took too long. Please try again.');
    await withStartupTimeout(signIn(address(), password), 'Sign-in took too long. Please try again.');
    setPassword(''); setCode(''); setRecovery(false); setReauthentication(false);
  });
  const confirmEmail = () => run(async () => {
    if (!code.trim()) throw new Error('Enter the verification code from your email.');
    await withStartupTimeout(verifyEmail(address(), code.trim()), 'Verification took too long. Please try again.');
    setVerification(false); setCode('');
    setMessage('Your email is verified. Sign in to review and delete the account.');
  });
  const clearLocal = async () => {
    await finishAccountDeletion(deletedAccountId.current);
    setLocalCleared(true);
  };
  const remove = () => run(async () => {
    if (!session) throw new Error('Sign in to verify ownership before deleting your account.');
    if (confirmation !== 'DELETE') throw new Error('Type DELETE exactly to confirm permanent deletion.');
    await requestAccountDeletion(session.user.id);
    deletedAccountId.current = session.user.id;
    setDeleted(true); setConfirmation('');
    try { await clearLocal(); }
    catch (cause) {
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'DELETED_ACCOUNT_CHANGED') {
        setDeleted(false); setMessage('Your previous account was deleted. Your current account and local data have been preserved.');
        return;
      }
      throw new Error('Your account was deleted. Clearing saved data in this browser or device did not finish. Use the button below to retry.');
    }
  });

  return <LegalPage title="Delete your PipWise account" subtitle="Use this page without installing PipWise. Sign in to verify ownership, then confirm permanent deletion.">
    <LegalSection title="What deletion removes">
      <LegalText>Your authentication account and sessions, saved account name, email, country and phone, private feedback, and account-linked chart-review usage are permanently deleted from the active service.</LegalText>
      <LegalText>The app also clears local PipWise data on the device or browser where you confirm deletion. Local-only practice records on your other devices need to be cleared there. Independently shared files and app-store subscription billing are not removed by this action. Cancel any subscription through your store account.</LegalText>
      <LegalText>Backup and provider security-log retention is described in the privacy policy. This page never asks for payment information or a new account.</LegalText>
      <LegalText>If you cannot sign in, email {legalDetails.contactEmail} from your account email address with the subject “PipWise account deletion”. We verify ownership and complete account-data deletion within 30 days. Feedback is kept for up to 12 months unless your account is deleted sooner.</LegalText>
      <AppButton label="Email a deletion request" variant="secondary" onPress={() => { void run(async () => { await Linking.openURL(`mailto:${legalDetails.contactEmail}?subject=PipWise%20account%20deletion`); }); }} />
    </LegalSection>
    {deleted ? <LegalSection title="Account deleted">
      <LegalText>Your PipWise account and associated active service data have been deleted.</LegalText>
      <LegalText>{localCleared ? 'Saved PipWise information on this browser or device has also been cleared.' : 'Finish clearing saved information on this browser or device below.'}</LegalText>
      {!localCleared && <AppButton label="Finish clearing this device" busy={busy} onPress={() => { void run(clearLocal); }} />}
      <AppButton label="Return to onboarding" variant="secondary" disabled={busy || !localCleared} onPress={() => router.replace('/onboarding')} />
    </LegalSection> : <LegalSection title={session ? 'Confirm your account' : 'Verify account ownership'}>
      {!ready && <LegalText>Restoring account access… You can read the instructions while this finishes.</LegalText>}
      {!!initializationError && <><View accessibilityRole="alert"><Label color="#A33F32">{initializationError}</Label></View><AppButton label="Retry restoring account" variant="secondary" disabled={busy} onPress={retryInitialization} /></>}
      {ready && !authConfigured && <LegalText>Account access is temporarily unavailable. Please try this page again after the service connection is restored.</LegalText>}
      {ready && authConfigured && (!session || reauthentication) && <>
        {reauthentication && <LegalText>For your security, sign in again before deleting this account.</LegalText>}
        <AppInput label="Account email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" editable={!busy} />
        <AppInput label={recovery ? 'New password' : 'Account password'} value={password} onChangeText={setPassword} secureTextEntry autoComplete={recovery ? 'new-password' : 'current-password'} editable={!busy} />
        {(verification || recovery) && <AppInput label={recovery ? 'Recovery code' : 'Verification code'} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" editable={!busy} />}
        {recovery ? <><AppButton label="Reset password and sign in" busy={busy} onPress={() => { void recover(); }} /><AppButton label="Back to sign in" variant="ghost" disabled={busy} onPress={() => { setRecovery(false); setPassword(''); setCode(''); }} /></> : <>
          <AppButton label="Sign in to manage deletion" busy={busy} onPress={() => { void login(); }} />
          {googleAuthEnabled && <AppButton label="Continue with Google" variant="secondary" disabled={busy} onPress={() => { void google(); }} />}
          <AppButton label="Send password recovery code" variant="ghost" disabled={busy} onPress={() => { void requestRecovery(); }} />
        </>}
        {verification && <><AppButton label="Verify email" variant="secondary" disabled={busy} onPress={() => { void confirmEmail(); }} /><AppButton label="Resend verification code" variant="ghost" disabled={busy} onPress={() => { void run(async () => { await resendVerification(address()); setMessage('Check your email for the verification code.'); }); }} /></>}
      </>}
      {!!session && !reauthentication && <>
        <LegalText>Signed in as {session.user.email || session.user.name || 'your PipWise account'}. Review this identity before continuing.</LegalText>
        <AppInput label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} editable={!busy} />
        <LegalText>All account data will be permanently deleted. This action cannot be undone.</LegalText>
        <AppButton label="Permanently delete account" variant="danger" disabled={busy || confirmation !== 'DELETE'} busy={busy} onPress={() => { void remove(); }} />
        <AppButton label="Sign out to use another account" variant="ghost" disabled={busy} onPress={() => { void run(signOut); }} />
      </>}
    </LegalSection>}
    {!!message && <View accessibilityRole="status"><Label color="#175C3E">{message}</Label></View>}
    {!!error && <View accessibilityRole="alert"><Label color="#A33F32">{error}</Label></View>}
  </LegalPage>;
}
