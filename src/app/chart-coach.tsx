import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppInput, Badge, Chip, ErrorState, GlassCard, Icon, Label, Row } from '../components/design';
import { TradingChart } from '../components/TradingChart';
import { ScreenSystemBars } from '../components/ScreenSystemBars';
import { getCoachStatus, reviewChartPhoto, type CoachStatus } from '../lib/chartCoachClient';
import { buildChartCoachHandoff } from '../lib/chartCoachHandoff';
import { parseReviewCandles, reviewCandles, reviewStrategies, validateReviewInput, type FileReview, type ReviewStrategy } from '../lib/chartReview';
import { pickChartUpload, type ChartUpload } from '../lib/chartUploads';
import { demoMarket } from '../lib/demoMarket';
import { assets, type Candle } from '../lib/market';
import { marketTimeframes, type MarketTimeframe } from '../lib/marketTypes';
import { useSession } from '../lib/session';
import { ThemeSurface } from '../lib/theme';

const unavailable: CoachStatus = { available: false, provider: null, requiresSubscription: false, monthlyLimit: 10, message: 'In-app photo reviews are disabled until the owner connects a provider. Local file studies and manual ChatGPT prompts work now.' };
const format = (value: number) => value.toLocaleString(undefined, { maximumSignificantDigits: 8 });

export default function ChartCoach() { return <ThemeSurface tone="light"><CoachScreen /></ThemeSurface>; }

function CoachScreen() {
  const { plan, session } = useSession();
  const premium = plan === 'pro' || plan === 'elite';
  const [symbol, setSymbol] = useState('EUR/USD');
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('1h');
  const [strategy, setStrategy] = useState<ReviewStrategy>('SMC');
  const [context, setContext] = useState('');
  const [upload, setUpload] = useState<ChartUpload | null>(null);
  const [uploadRevision, setUploadRevision] = useState(0);
  const [text, setText] = useState('');
  const [paste, setPaste] = useState(false);
  const [example, setExample] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const studyKey = JSON.stringify([symbol, timeframe, strategy, context, uploadRevision, upload?.name, text, session?.user.id]);
  const [storedReport, storeReport] = useState<{ key: string; value: FileReview } | null>(null);
  const report = storedReport?.key === studyKey ? storedReport.value : null;
  const setReport = (value: FileReview | null) => storeReport(value ? { key: studyKey, value } : null);
  type PhotoReport = { review: string; source: string; generatedAt: number };
  const [storedPhotoReport, storePhotoReport] = useState<{ key: string; value: PhotoReport } | null>(null);
  const photoReport = storedPhotoReport?.key === studyKey ? storedPhotoReport.value : null;
  const setPhotoReport = (value: PhotoReport | null) => storePhotoReport(value ? { key: studyKey, value } : null);
  const [status, setStatus] = useState(unavailable);
  const [checking, setChecking] = useState(true);
  const [storedError, storeError] = useState({ key: '', value: '' });
  const error = storedError.key === studyKey ? storedError.value : '';
  const setError = (value: string) => storeError({ key: studyKey, value });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const busy = busyKey === studyKey;
  const setBusy = (value: boolean) => setBusyKey(value ? studyKey : null);
  const [picking, setPicking] = useState(false);
  const [consent, setConsent] = useState(false);
  const [handoffState, setHandoffState] = useState<{ key: string; prompt: string; notice: string } | null>(null);
  const handoff = handoffState?.key === studyKey ? handoffState : null;
  const [sharing, setSharing] = useState(false);
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const mounted = useRef(true);
  const image = !!upload?.base64;
  const connectedPhotoAccess = status.available && (!status.requiresSubscription || premium) && !!session;
  const photoProviderName = status.provider === 'openai' ? 'OpenAI' : 'Google Gemini';

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    void getCoachStatus(controller.signal).then(value => { if (mounted.current) setStatus(value); }).catch(() => { if (mounted.current) setStatus(unavailable); }).finally(() => { if (mounted.current) setChecking(false); });
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);
  useEffect(() => {
    // A report belongs to the input and account that requested it.
    revision.current++;
    request.current?.abort();
  }, [studyKey]);

  const choose = async () => {
    if (picking) return;
    setPicking(true); setError('');
    try {
      const selected = await pickChartUpload();
      if (!selected || !mounted.current) return;
      setUploadRevision(value => value + 1); setUpload(selected); setText(selected.text || ''); setExample(false); setConsent(false); setPaste(false);
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'The file could not be opened.'); }
    finally { if (mounted.current) setPicking(false); }
  };
  const sample = () => {
    const data = demoMarket.getSeries(symbol, timeframe).candles;
    setText(JSON.stringify(data)); setUpload(null); setExample(true); setPaste(false); setConsent(false);
  };
  const prepareHandoff = () => {
    setError('');
    try {
      const input = validateReviewInput({ symbol, timeframe, strategy, context });
      let study = report;
      let values = candles;
      if (!image && text.trim()) {
        values = parseReviewCandles(text);
        study = reviewCandles(values, input, example ? 'PipWise simulated example' : upload?.name || 'Pasted OHLC data');
        setCandles(values); setReport(study);
      }
      setHandoffState({ key: studyKey, prompt: buildChartCoachHandoff({ input, report: study, candles: values, simulated: example, photo: image }), notice: '' });
    } catch (error) { setError(error instanceof Error ? error.message : 'Your study prompt could not be prepared.'); }
  };
  const shareHandoff = async () => {
    if (!handoff || sharing) return;
    setSharing(true);
    const notice = (value: string) => setHandoffState(current => current?.key === studyKey ? { ...current, notice: value } : current);
    try {
      const result = await Share.share({ title: 'PipWise chart study', message: handoff.prompt });
      if (result?.action !== Share.dismissedAction) notice('Text prepared for sharing. Paste it into your ChatGPT conversation; attach any image or original file yourself.');
    } catch { notice('Sharing is unavailable here. Select and copy the prompt below, then paste it into ChatGPT.'); }
    finally { if (mounted.current) setSharing(false); }
  };
  const openChatGPT = async () => {
    try { await Linking.openURL('https://chatgpt.com/'); }
    catch { setError('ChatGPT could not be opened. Open https://chatgpt.com/ in your browser and paste the prepared prompt.'); }
  };
  const analyze = async () => {
    setError(''); setReport(null); setPhotoReport(null);
    const id = ++revision.current;
    let input;
    try { input = validateReviewInput({ symbol, timeframe, strategy, context }); }
    catch (error) { setError((error as Error).message); return; }
    if (!image) {
      try {
        const values = parseReviewCandles(text);
        const source = example ? 'PipWise simulated example' : upload?.name || 'Pasted OHLC data';
        const result = reviewCandles(values, input, source);
        setCandles(values); setReport(result);
      } catch (error) { setError(error instanceof Error ? error.message : 'The candle data could not be reviewed.'); }
      return;
    }
    if (!session || status.requiresSubscription && !premium) { setError('The separate in-app photo service is unavailable for this account. Use the manual ChatGPT steps below.'); return; }
    if (!status.available) { setError(status.message); return; }
    if (!consent) { setError('Confirm that your chart may be sent for AI review.'); return; }
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000); setBusy(true);
    try {
      const result = await reviewChartPhoto(input, upload!, controller.signal, session.user.id, status.provider!);
      if (mounted.current && id === revision.current) setPhotoReport(result);
    } catch (error) {
      if (mounted.current && id === revision.current) setError(controller.signal.aborted ? 'Review canceled or timed out. No complete review was returned.' : error instanceof Error ? error.message : 'Photo review failed.');
    } finally { clearTimeout(timeout); if (mounted.current && id === revision.current) setBusy(false); }
  };

  return <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FA' }} edges={['top', 'left', 'right', 'bottom']}>
    <ScreenSystemBars style="dark" backgroundColor="#F5F7FA" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false} contentContainerStyle={{ padding: 20, paddingBottom: 50, gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
      <Row><AppButton compact variant="ghost" label="Back" icon="arrow-back" onPress={() => router.back()} /><Badge>CHART COACH · FREE LOCAL STUDIES</Badge></Row>
      <View style={{ gap: 8 }}><Label bold size={30}>Read the chart. Build a plan.</Label><Label muted>Study candle files on this device, or prepare a prompt to use in your own ChatGPT conversation.</Label></View>
      <GlassCard>
        <Row><Icon name="scan-outline" size={25} /><Label bold style={{ flex: 1 }}>Your chart study</Label></Row>
        <Label muted size={12}>CSV/JSON studies run on your device without a subscription. Photos are previewed on this device. For ChatGPT, you attach the image yourself.</Label>
        <AppButton label={picking ? 'Opening files…' : 'Choose chart photo or candle file'} icon="attach-outline" variant="secondary" disabled={busy || picking} onPress={() => { void choose(); }} />
        <Row style={{ flexWrap: 'wrap' }}><AppButton compact variant="ghost" label="Paste CSV / JSON" onPress={() => { setUpload(null); setText(''); setExample(false); setPaste(true); }} /><AppButton compact variant="ghost" label="Try a simulated example" onPress={sample} /></Row>
        {!!upload && <Row><Label size={12} style={{ flex: 1 }}>{upload.name} · {(upload.size / 1024).toFixed(0)} KB</Label><AppButton compact variant="ghost" label="Remove" onPress={() => { setUpload(null); setText(''); setConsent(false); }} /></Row>}
        {image && <Image source={{ uri: upload!.uri }} accessibilityLabel="Selected chart preview" resizeMode="contain" style={{ width: '100%', height: 220, backgroundColor: '#E8EDF3', borderRadius: 12 }} />}
        {paste && <><AppInput label="OHLC candles" multiline style={{ minHeight: 150, textAlignVertical: 'top' }} maxLength={1048576} value={text} onChangeText={setText} placeholder={'time,open,high,low,close\n2026-11-01T00:00:00Z,1.08,1.09,1.07,1.085'} /><Label muted size={11}>60–5,000 candles · CSV or JSON · under 1 MB. UTC ISO time or Unix seconds. Choose the timeframe used by your data.</Label></>}
        {example && <Label bold size={12} color="#836200">Simulated example selected. These candles are generated practice data.</Label>}
        <Label bold size={12}>Market shown in your file</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>{assets.map(asset => <Chip key={asset.symbol} label={asset.symbol} selected={symbol === asset.symbol} onPress={() => { setSymbol(asset.symbol); if (example) { setText(''); setExample(false); } }} />)}</ScrollView>
        <Label bold size={12}>Candle timeframe</Label><Row style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>{marketTimeframes.map(value => <Chip key={value} label={value} selected={value === timeframe} onPress={() => { setTimeframe(value); if (example) { setText(''); setExample(false); } }} />)}</Row>
        <Label bold size={12}>Study method</Label><Row style={{ justifyContent: 'flex-start' }}>{reviewStrategies.map(value => <Chip key={value} label={value} selected={strategy === value} onPress={() => setStrategy(value)} />)}</Row>
        <Label muted size={11}>{strategy === 'MSNR' ? 'MSNR-inspired: support/resistance and confirmed swing points.' : `${strategy}-inspired: structure, range liquidity sweeps and three-bar price gaps.`} These are basic educational rules, not an official or validated strategy system.</Label>
        <AppInput label="Fundamental notes (optional)" value={context} onChangeText={setContext} multiline maxLength={2000} placeholder="Add an event, date and source you want to consider." />
        <Label muted size={11}>No verified current news is attached. Your notes are treated as unverified context.</Label>
        {image && !connectedPhotoAccess && <Label size={12} muted>{checking ? 'Your photo is ready for the manual ChatGPT steps below.' : !status.available ? 'In-app AI photo review is disabled in this beta. Prepare a text prompt below, then attach the photo yourself in ChatGPT.' : !session ? 'A verified account is required for the connected photo service. You can still use the manual ChatGPT steps below.' : 'Use the manual ChatGPT steps below. No image is sent automatically.'}</Label>}
        {image && connectedPhotoAccess && <>
          <Label size={12} muted>{status.provider === 'openai' ? 'The owner provides OpenAI review access for verified accounts, within shared capacity. No PipWise subscription is required. This is separate from your personal ChatGPT conversations.' : 'A separately configured Google Gemini service is available for your account.'} The manual ChatGPT workflow below does not use this service.</Label>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(value => !value)} style={{ minHeight: 48, flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name={consent ? 'checkbox' : 'square-outline'} color="#216BEB" /><Label size={12} style={{ flex: 1 }}>I agree to send this chart and my notes to {photoProviderName} for review. I have removed personal information.</Label></Pressable>
          <Label muted size={11}>PipWise does not retain images or reports in its database. {photoProviderName}’s processing terms apply. Up to {status.monthlyLimit} attempts per account per UTC month, subject to shared service capacity; failed AI attempts also count.</Label>
        </>}
        {!!error && <ErrorState message={error} />}
        {(!image || connectedPhotoAccess) && <AppButton label={image ? 'Request connected photo review' : 'Analyze candle file · free'} icon="sparkles-outline" disabled={picking || (image ? !consent : !text.trim())} busy={busy} onPress={() => { void analyze(); }} />}
        {busy && <AppButton label="Cancel review" variant="ghost" onPress={() => { revision.current++; request.current?.abort(); setBusy(false); }} />}
      </GlassCard>
      <GlassCard>
        <Badge>YOUR OWN CHATGPT CONVERSATION</Badge>
        <Label bold size={20}>Take this study to ChatGPT</Label>
        <Label muted size={12}>PipWise cannot access your ChatGPT conversations or run ChatGPT in the background. This manual workflow needs no PipWise subscription. ChatGPT sign-in, uploads and usage limits depend on your own account.</Label>
        <Label size={12}>1. Prepare the prompt, then share its text or select and copy it below.</Label>
        <Label size={12}>2. Open ChatGPT and paste the prompt. Attach your chart photo or original candle file yourself if needed.</Label>
        <Label muted size={11}>The text includes your selected market, timeframe, method and notes. After a file study, it also includes the local report and up to 60 completed candles. Review it before sharing. Opening ChatGPT sends no prompt or image.</Label>
        <AppButton label={handoff ? 'Refresh ChatGPT prompt' : 'Prepare ChatGPT prompt'} icon="document-text-outline" variant="secondary" disabled={picking || busy || sharing} onPress={prepareHandoff} />
        {handoff && <>
          <AppButton label="Share text prompt" icon="share-outline" busy={sharing} onPress={() => { void shareHandoff(); }} />
          <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }} contentContainerStyle={{ padding: 12, backgroundColor: '#EEF2F7', borderRadius: 12 }}><Text selectable accessibilityLabel="ChatGPT study prompt" style={{ color: '#152238', fontSize: 12, lineHeight: 19 }}>{handoff.prompt}</Text></ScrollView>
          {!!handoff.notice && <Label muted size={12}>{handoff.notice}</Label>}
        </>}
        <AppButton label="Open ChatGPT" icon="open-outline" variant="ghost" onPress={() => { void openChatGPT(); }} />
      </GlassCard>
      {report && <>
        <GlassCard><Badge>FILE STUDY · RULES BASED</Badge><Label size={22} bold>{report.title}</Label><Label muted size={11}>{report.source} · {report.candlesUsed} completed candles · through {new Date(report.lastClosedAt).toLocaleString()}</Label><TradingChart asset={assets.find(asset => asset.symbol === symbol)!} external={{ candles: candles.filter(candle => candle.time < report.lastClosedAt), timeframe, sample: example, loading: false, error: '', onTimeframeChange: value => setTimeframe(value as MarketTimeframe), onRetry: () => {} }} />{report.observations.map(value => <Label key={value}>{value}</Label>)}</GlassCard>
        <GlassCard><Label size={20} bold>Levels to study</Label>{report.levels.map((level, i) => <Row key={`${level.label}-${i}`}><Label size={12} muted style={{ flex: 1 }}>{level.label}</Label><Label bold>{format(level.price)}</Label></Row>)}</GlassCard>
        <GlassCard><Label size={20} bold>Conditional scenarios</Label>{report.scenarios.map(value => <Label key={value}>{value}</Label>)}</GlassCard>
        <GlassCard><Label bold>What this review cannot tell you</Label>{report.limitations.map(value => <Label key={value} muted size={12}>{value}</Label>)}</GlassCard>
      </>}
      {photoReport && <GlassCard><Badge>AI INTERPRETATION · VERIFY THE DETAILS</Badge><Label muted size={11}>{photoReport.source} · {new Date(photoReport.generatedAt).toLocaleString()}</Label><Label>{photoReport.review}</Label></GlassCard>}
      <Label muted size={11}>Educational practice only. Chart patterns and AI interpretations do not reliably predict future prices or guarantee returns. Review the assumptions and use virtual funds to test your ideas.</Label>
    </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
