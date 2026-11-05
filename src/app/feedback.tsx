import Constants from 'expo-constants';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import { AppButton, Icon, Label, Row } from '../components/design';
import { ReferenceCard, ReferenceScreen, referenceColors as c } from '../components/reference';
import { createFeedbackReportId, feedbackAlreadyDelivered, feedbackCategories, feedbackPayload, formatFeedbackReport, validateFeedback, type FeedbackCategory, type FeedbackPayload } from '../lib/feedback';
import { useSession } from '../lib/session';
import { withStartupTimeout } from '../lib/startupTasks';
import { feedbackConfigured, submitFeedback } from '../lib/feedbackClient';
import { fonts } from '../lib/theme';
import { useWorkspace } from '../lib/workspace';

const lime = '#C8F169';
const categoryLabels = { bug: 'Report a bug', idea: 'Suggest an idea', other: 'Other feedback' };

export default function Feedback() {
  const { session } = useSession();
  const { language } = useWorkspace();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState<FeedbackCategory>('other');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [report, setReport] = useState('');
  const working = useRef(false);
  const pendingReport = useRef<{ fingerprint: string; payload: FeedbackPayload } | null>(null);
  const metadata = { appVersion: Constants.expoConfig?.version ?? 'unknown', platform: Platform.OS, language };
  const canSend = feedbackConfigured && !!session?.user.id;
  const draft = { rating, category, message };

  const send = async () => {
    if (working.current) return;
    const invalid = validateFeedback(draft);
    setError(invalid); setNotice('');
    if (invalid) return;
    if (!feedbackConfigured || !session?.user.id) { setError('Sign in to send your review, or share a report below.'); return; }
    working.current = true; setBusy(true);
    const controller = new AbortController();
    try {
      const fingerprint = JSON.stringify({ ...draft, message: message.trim(), userId: session.user.id });
      if (pendingReport.current?.fingerprint !== fingerprint) pendingReport.current = {
        fingerprint, payload: feedbackPayload(draft, session.user.id, createFeedbackReportId(), metadata),
      };
      const result = await withStartupTimeout(
        submitFeedback(pendingReport.current.payload, controller.signal),
        'We could not confirm delivery. Your review is still here. Try again or share the report.',
        15000,
      );
      if (result.error && !feedbackAlreadyDelivered(result.error)) throw result.error;
      setSent(true);
    } catch {
      setError('We could not confirm delivery. Your review is still here. Try again or share the report.');
    } finally { controller.abort(); working.current = false; setBusy(false); }
  };

  const share = async () => {
    if (working.current) return;
    const invalid = validateFeedback(draft);
    setError(invalid); setNotice('');
    if (invalid) return;
    working.current = true; setBusy(true);
    try {
      const text = formatFeedbackReport(draft, metadata);
      setReport(text);
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setNotice('Report copied. Paste it into a message to the person who invited you.');
        } else setNotice('Your report is ready below. Select and copy it to send to the person who invited you.');
      } else {
        const result = await Share.share({ title: 'PipWise beta review', message: text });
        if (result.action !== Share.dismissedAction) setNotice('Report prepared for sharing. Delivery depends on the app you choose.');
      }
    } catch { setError('Sharing is unavailable here. Your report is ready below to select and copy.'); }
    finally { working.current = false; setBusy(false); }
  };

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ReferenceScreen contentStyle={{ maxWidth: 620 }}>
      <AppButton label="Back to settings" icon="arrow-back" variant="ghost" onPress={() => router.replace('/settings')} disabled={busy} />
      <View style={{ gap: 7 }}><Label bold size={30} color={c.ink}>Help shape PipWise.</Label><Label size={13} color={c.muted}>Share what you enjoyed, what felt confusing, or what needs fixing.</Label></View>
      {sent ? <ReferenceCard>
        <View style={{ alignSelf: 'flex-start', padding: 14, borderRadius: 22, backgroundColor: lime }}><Icon name="checkmark-outline" color={c.ink} size={26} /></View>
        <Label bold size={22} color={c.ink}>Your review was sent.</Label>
        <Label color={c.muted}>Thank you for testing PipWise. Your feedback helps improve the next version.</Label>
        <AppButton label="Back to settings" onPress={() => router.replace('/settings')} />
        <AppButton label="Write another review" variant="ghost" onPress={() => { setSent(false); setRating(0); setCategory('other'); setMessage(''); setReport(''); setError(''); setNotice(''); pendingReport.current = null; }} />
      </ReferenceCard> : <>
        <ReferenceCard>
          <Label bold size={17} color={c.ink}>How was your experience?</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel="Experience rating" style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} out of 5 stars`} accessibilityState={{ checked: rating === value, disabled: busy }} disabled={busy} onPress={() => { setRating(value); setError(''); }} style={({ pressed }) => ({ flex: 1, minWidth: 36, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: rating === value ? '#9FC34A' : c.line, backgroundColor: value <= rating ? lime : '#F4F3EF', opacity: pressed ? 0.65 : 1 })}><Icon name={value <= rating ? 'star' : 'star-outline'} color={c.ink} size={23} /></Pressable>)}
          </View>
          <Label bold color={c.ink}>What would you like to share?</Label>
          <View accessibilityRole="radiogroup" accessibilityLabel="Feedback category" style={{ gap: 8 }}>
            {feedbackCategories.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={categoryLabels[value]} accessibilityState={{ checked: category === value, disabled: busy }} disabled={busy} onPress={() => { setCategory(value); setError(''); }} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderRadius: 16, borderColor: category === value ? '#9FC34A' : c.line, backgroundColor: category === value ? '#EDF6DB' : 'white', flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.65 : 1 })}><Icon name={value === 'bug' ? 'bug-outline' : value === 'idea' ? 'bulb-outline' : 'chatbubble-outline'} color={c.ink} size={19} /><Label bold size={13} color={c.ink} style={{ flex: 1 }}>{categoryLabels[value]}</Label><Icon name={category === value ? 'radio-button-on' : 'radio-button-off'} size={18} color={c.ink} /></Pressable>)}
          </View>
          <View style={{ gap: 8 }}>
            <Label bold color={c.ink}>Your review</Label>
            <TextInput accessibilityLabel="Your review" value={message} onChangeText={value => { setMessage(value); setError(''); setNotice(''); setReport(''); }} editable={!busy} multiline maxLength={2000} placeholder="What happened? What did you expect? Which screen were you using?" placeholderTextColor={c.muted} textAlignVertical="top" style={{ minHeight: 150, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: '#F4F3EF', color: c.ink, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21 }} />
            <Label size={10} color={c.muted} style={{ textAlign: 'right' }}>{message.length} / 2,000</Label>
          </View>
          {!!error && <View accessibilityRole="alert"><Label size={12} color={c.red}>{error}</Label></View>}
          {!!notice && <View accessibilityRole="alert"><Label size={12} color={c.ink}>{notice}</Label></View>}
          {canSend ? <>
            <AppButton label="Send review" icon="send-outline" onPress={() => { void send(); }} busy={busy} />
            <Label size={10} color={c.muted}>Your review is linked to your signed-in account. App version and platform help us reproduce issues.</Label>
          </> : <Label size={12} color={c.muted}>You’re using local practice. Copy or share your report with the person who invited you.</Label>}
          <AppButton label={Platform.OS === 'web' ? 'Copy review report' : 'Share review report'} variant="secondary" icon={Platform.OS === 'web' ? 'copy-outline' : 'share-outline'} onPress={() => { void share(); }} disabled={busy} />
        </ReferenceCard>
        {!!report && <ReferenceCard><Label bold color={c.ink}>Your report</Label><Text selectable style={{ color: c.muted, fontSize: 12, lineHeight: 19, fontFamily: fonts.medium }}>{report}</Text></ReferenceCard>}
        <Row><Label size={10} color={c.muted}>PipWise {metadata.appVersion}</Label><Label size={10} color={c.muted}>{Platform.OS}</Label></Row>
      </>}
    </ReferenceScreen>
  </KeyboardAvoidingView>;
}
