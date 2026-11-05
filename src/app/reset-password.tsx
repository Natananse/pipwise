import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { AuthFlowScreen } from '../components/AuthFlowScreen';
import { AppButton, AppInput, Label } from '../components/design';
import { useSession } from '../lib/session';
import { requestPasswordReset, resetPassword } from '../lib/neonAuth';
import { withStartupTimeout } from '../lib/startupTasks';

export default function ResetPassword() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const { clearPasswordRecovery } = useSession();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  const leave = () => { clearPasswordRecovery(); router.replace('/auth'); };
  const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const save = async () => {
    if (submitting.current) return;
    setError(''); setNotice('');
    if (!token && !validEmail()) { setError('Enter your account email address.'); return; }
    if (!token && !code.trim()) { setError('Enter the recovery code from your email.'); return; }
    if (password.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    if (password !== confirmation) { setError('Your passwords do not match.'); return; }
    submitting.current = true; setBusy(true);
    try {
      await withStartupTimeout(resetPassword(token || code.trim(), password, token ? undefined : email.trim()), 'Updating your password took too long. Check your connection and try again.');
      clearPasswordRecovery(); setSaved(true); setPassword(''); setConfirmation(''); setCode('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your password could not be updated. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const resend = async () => {
    if (submitting.current) return;
    setError(''); setNotice('');
    if (!validEmail()) { setError('Enter your account email address.'); return; }
    submitting.current = true; setBusy(true);
    try {
      await withStartupTimeout(requestPasswordReset(email.trim()), 'The request took too long. Check your connection and try again.');
      setNotice('If an account exists, a new recovery code has been requested. Check your inbox and spam folder.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The recovery code could not be requested. Please try again.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <AuthFlowScreen title={saved ? 'Password updated' : 'Choose a new password'} detail={saved ? 'Your account is ready. Use your new password the next time you sign in.' : token ? 'Create a password you have not used for this account before.' : 'If an account exists, check its email for a recovery code. Enter the code and choose your new password.'} icon="key-outline">
    {saved ? <><Label color="#4B6334">Your new password has been saved.</Label><AppButton label="Back to sign in" onPress={leave} /></> : <>
      {!token && <>
        <AppInput label="Account email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" editable={!busy} />
        <AppInput label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} autoComplete="one-time-code" keyboardType="number-pad" editable={!busy} />
      </>}
      <AppInput label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy} />
      <AppInput label="Confirm new password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!busy} onSubmitEditing={() => { void save(); }} />
      {!!error && <View accessibilityRole="alert"><Label color="#A33F32">{error}</Label></View>}
      {!!notice && <View accessibilityRole="alert"><Label color="#4B6334">{notice}</Label></View>}
      <AppButton label="Save new password" onPress={() => { void save(); }} busy={busy} />
      {!token && <AppButton label="Request another code" onPress={() => { void resend(); }} variant="secondary" disabled={busy} />}
      <AppButton label="Back to sign in" onPress={leave} variant="secondary" disabled={busy} />
    </>}
  </AuthFlowScreen>;
}
