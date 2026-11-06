import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../components/AppLogo';
import { LanguageSelector } from '../components/LanguageSelector';
import { Icon, Label, Row } from '../components/design';
import { lightHaptic } from '../lib/haptics';
import { Language, languages } from '../lib/languages';
import { hasCompleteOnboardingAnswers, onboardingQuestions, onboardingStartStep, onboardingText } from '../lib/onboarding';
import { useSession } from '../lib/session';
import { StartupTimeoutError } from '../lib/startupTasks';
import { fonts, ThemeSurface } from '../lib/theme';
import { useReducedMotion } from '../lib/useReducedMotion';
import { CURRENT_ONBOARDING_VERSION, OnboardingStep, useWorkspace } from '../lib/workspace';

const ink = '#0D1011';
const muted = '#6C756B';
const lime = '#C8F169';

export default function Onboarding() {
  const { loaded, onboardingDraft, preferences, onboardingVersion } = useWorkspace();
  const { onboarded } = useSession();
  const { start } = useLocalSearchParams<{ start?: string | string[] }>();
  const explicitStart = start === 'questions' || start === 'language';
  const initialStep = explicitStart ? onboardingStartStep(start) : onboardingDraft?.step ?? (!onboarded && onboardingVersion >= CURRENT_ONBOARDING_VERSION && hasCompleteOnboardingAnswers(preferences) ? 3 : 0);
  return <ThemeSurface tone="light">{loaded ? <OnboardingWizard initialStep={initialStep} /> : null}</ThemeSurface>;
}

function OnboardingWizard({ initialStep }: { initialStep: OnboardingStep }) {
  const { start } = useLocalSearchParams<{ start?: string | string[] }>();
  const { language, preferences, onboardingDraft, persistOnboarding, persistOnboardingDraft } = useWorkspace();
  const { finishOnboarding, acceptDisclaimer, session, leaveDemo } = useSession();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const saving = useRef(false);
  const [step, setStep] = useState<OnboardingStep>(initialStep);
  const [draftLanguage, setDraftLanguage] = useState<Language>(onboardingDraft?.language ?? language);
  const [experience, setExperience] = useState(onboardingDraft?.preferences.experience ?? preferences.experience);
  const [markets, setMarkets] = useState(onboardingDraft?.preferences.markets ?? preferences.markets);
  const [goal, setGoal] = useState(onboardingDraft?.preferences.goal ?? preferences.goal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tx = (text: string) => onboardingText(draftLanguage, text);
  const rtl = languages.find(item => item.code === draftLanguage)?.rtl ?? false;
  const textStyle = { textAlign: rtl ? 'right' as const : 'left' as const, writingDirection: rtl ? 'rtl' as const : 'ltr' as const };
  const question = step > 0 ? onboardingQuestions[step - 1] : null;
  const valid = step === 1 ? !!experience : step === 2 ? markets.length > 0 : step === 3 ? !!goal : true;

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);

  const moveBack = async () => {
    if (saving.current || step === 0) return;
    saving.current = true; setBusy(true); setError('');
    const previous = (step - 1) as OnboardingStep;
    try {
      await persistOnboardingDraft({ experience, markets, goal }, draftLanguage, previous);
      if (start === 'questions' || start === 'language') router.setParams({ start: undefined });
      setStep(previous);
    } catch (cause) { setError(tx(cause instanceof StartupTimeoutError ? 'Saving took too long. Please try again.' : 'Could not save your setup. Please try again.')); }
    finally { saving.current = false; setBusy(false); }
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving.current) return true;
      if (step === 0) return false;
      void moveBack();
      return true;
    });
    return () => subscription.remove();
  });

  const next = async () => {
    if (saving.current || !valid) return;
    saving.current = true; setBusy(true); setError('');
    const answers = { experience, markets, goal };
    try {
      if (step < 3) {
        const nextStep = (step + 1) as OnboardingStep;
        await persistOnboardingDraft(answers, draftLanguage, nextStep);
        if (start === 'questions' || start === 'language') router.setParams({ start: undefined });
        lightHaptic(); setStep(nextStep);
      } else if (hasCompleteOnboardingAnswers(answers)) {
        // Completing setup offers account access before starting a new demo session.
        if (!session) await leaveDemo();
        await acceptDisclaimer();
        await persistOnboarding(answers, draftLanguage);
        await finishOnboarding();
      } else {
        await persistOnboardingDraft(answers, draftLanguage, 1);
        setStep(1);
      }
    } catch (cause) {
      setError(tx(cause instanceof StartupTimeoutError ? 'Saving took too long. Please try again.' : 'Could not save your setup. Please try again.'));
    }
    finally { saving.current = false; setBusy(false); }
  };

  const choose = (value: string) => {
    if (busy) return;
    lightHaptic(); setError('');
    if (step === 1) setExperience(value);
    else if (step === 3) setGoal(value);
    else setMarkets(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  };

  return <SafeAreaView style={styles.screen}>
    <StatusBar style="dark" />
    <View style={styles.frame}>
      <Row style={{ ...styles.header, flexDirection: rtl ? 'row-reverse' : 'row' }}>
        <Row style={{ justifyContent: 'flex-start', flexDirection: rtl ? 'row-reverse' : 'row', gap: 10 }}>
          {step > 0 ? <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={tx('Back')} accessibilityState={{ disabled: busy }} onPress={() => { void moveBack(); }} style={({ pressed }) => [styles.back, { opacity: busy ? 0.4 : pressed ? 0.6 : 1 }]}><Icon name={rtl ? 'arrow-forward' : 'arrow-back'} size={20} color={ink} /></Pressable> : <AppLogo size={40} decorative />}
          <Label bold size={22} color={ink} style={{ fontFamily: fonts.extraBold, letterSpacing: -0.8 }}>pipwise<Label size={22} color="#82A637">.</Label></Label>
        </Row>
        <View style={styles.stepBadge}><Label size={11} bold color={lime}>0{step + 1}<Label size={10} color="#A3AAA7"> / 04</Label></Label></View>
      </Row>
      <View accessibilityRole="progressbar" accessibilityLabel={step === 0 ? tx('Choose your language') : `${tx('Question')} ${step} ${tx('of')} 3`} accessibilityValue={{ min: 1, max: 4, now: step + 1 }} aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1} style={[styles.progress, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>{[0, 1, 2, 3].map(value => <View key={value} style={{ flex: 1, height: 4, borderRadius: 3, backgroundColor: value < step ? '#9EC647' : value === step ? ink : '#DCE0D5' }} />)}</View>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: width < 360 ? 20 : 24, paddingTop: 25, paddingBottom: 24, flexGrow: 1 }}>
        <StepEntrance key={step} reducedMotion={reducedMotion !== false}>
          {step === 0 ? <View style={{ gap: 21 }}>
            <View style={{ gap: 14 }}>
              <Row style={{ flexDirection: rtl ? 'row-reverse' : 'row' }}><View style={styles.hello}><View style={styles.helloDot} /><Label size={10} color={muted}>Hello · Hola · ሰላም</Label></View><View style={styles.languageIcon}><Icon name="language-outline" size={25} color={lime} /></View></Row>
              <View style={{ gap: 7 }}><Label size={10} bold color={muted} style={{ ...textStyle, letterSpacing: rtl ? 0 : 1.15 }}>{tx('Make yourself at home.')}</Label><View accessibilityRole="header"><Label size={width < 360 ? 30 : 35} bold color={ink} style={{ ...textStyle, fontFamily: fonts.extraBold, letterSpacing: rtl ? 0 : -1.3, lineHeight: width < 360 ? 37 : 42 }}>{tx('Choose your language')}</Label></View><Label size={12} color={muted} style={textStyle}>{tx('10 languages. One trading journey.')}</Label></View>
            </View>
            <LanguageSelector light value={draftLanguage} onSelect={value => { lightHaptic(); setDraftLanguage(value); setError(''); }} disabled={busy} />
            <Row style={{ justifyContent: 'flex-start', flexDirection: rtl ? 'row-reverse' : 'row', gap: 7 }}><Icon name="shield-checkmark-outline" color={muted} size={14} /><Label size={10} color={muted} style={{ ...textStyle, flex: 1 }}>{tx('Your language and progress are saved as you go.')}</Label></Row>
          </View> : question && <View style={{ gap: 25 }}>
            <View style={{ gap: 15 }}>
              <Row style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 12 }}>
                <Row style={{ justifyContent: 'flex-start', flexDirection: rtl ? 'row-reverse' : 'row', flex: 1, gap: 9 }}><View style={styles.questionMark}><Icon name={step === 1 ? 'leaf-outline' : step === 2 ? 'planet-outline' : 'flag-outline'} size={19} color={lime} /></View><Label size={9} bold color={muted} style={{ letterSpacing: rtl ? 0 : 0.9, flexShrink: 1 }}>{tx('A LITTLE ABOUT YOU')}</Label></Row>
                <Label size={10} color={muted}>{tx('Question')} {step} {tx('of')} 3</Label>
              </Row>
              <View style={{ gap: 9 }}><View accessibilityRole="header"><Label bold size={width < 360 ? 28 : 33} color={ink} style={{ ...textStyle, fontFamily: fonts.extraBold, letterSpacing: rtl ? 0 : -1.15, lineHeight: width < 360 ? 35 : 40 }}>{tx(question.title)}</Label></View><Label size={12} color={muted} style={textStyle}>{tx(question.detail)}</Label></View>
            </View>
            <View accessibilityRole={step === 2 ? undefined : 'radiogroup'} style={{ gap: 11 }}>
              {question.options.map(option => <ChoiceCard key={option.value} title={tx(option.value)} detail={tx(option.detail)} icon={option.icon} selected={step === 1 ? experience === option.value : step === 3 ? goal === option.value : markets.includes(option.value)} multiple={step === 2} disabled={busy} rtl={rtl} onPress={() => choose(option.value)} />)}
            </View>
            {step === 2 && <Label size={10} color={muted} style={textStyle}>{tx('Select all that apply')} · {markets.length}</Label>}
          </View>}
        </StepEntrance>
      </ScrollView>
      <View style={styles.footer}>
        {!valid && !error && <Row style={{ justifyContent: 'flex-start', flexDirection: rtl ? 'row-reverse' : 'row', gap: 7 }}><Icon name="radio-button-off-outline" color={muted} size={14} /><Label size={11} color={muted} style={{ ...textStyle, flex: 1 }}>{tx(step === 2 ? 'Choose at least one market to continue.' : 'Choose an answer to continue.')}</Label></Row>}
        {!!error && <View accessibilityRole="alert" style={[styles.error, { flexDirection: rtl ? 'row-reverse' : 'row' }]}><Icon name="alert-circle-outline" color="#A52D35" size={17} /><Label size={12} color="#A52D35" style={{ ...textStyle, flex: 1 }}>{error}</Label></View>}
        <Pressable accessibilityRole="button" accessibilityLabel={tx(step === 0 ? 'Continue to questions' : step === 3 ? 'Save & continue' : 'Continue')} accessibilityState={{ disabled: !valid || busy, busy }} aria-disabled={!valid || busy} disabled={!valid || busy} onPress={() => { void next(); }} style={({ pressed }) => [styles.next, { flexDirection: rtl ? 'row-reverse' : 'row', backgroundColor: valid ? lime : '#E0E4D9', opacity: pressed ? 0.7 : 1 }]}><Label bold size={14} color={valid ? ink : '#7B8477'} style={{ ...textStyle, flex: 1 }}>{tx(busy ? 'Saving your preferences…' : step === 0 ? 'Continue to questions' : step === 3 ? 'Save & continue' : 'Continue')}</Label><View style={[styles.nextIcon, { backgroundColor: valid ? ink : '#CDD3C4' }]}>{busy ? <ActivityIndicator size="small" color={lime} /> : <Icon name={rtl ? 'arrow-back' : 'arrow-forward'} size={18} color={valid ? lime : '#7B8477'} />}</View></Pressable>
        <Label size={9} color={muted} style={{ textAlign: 'center', writingDirection: rtl ? 'rtl' : 'ltr' }}>{tx(step === 3 ? 'Preferences stay on this device. Change them anytime in your profile.' : 'Educational simulator · No real money or live quotes.')}</Label>
      </View>
    </View>
  </SafeAreaView>;
}

function StepEntrance({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  const [entrance] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  useEffect(() => {
    const fallback = setTimeout(() => entrance.setValue(1), 400);
    const animation = Animated.timing(entrance, { toValue: 1, duration: reducedMotion ? 0 : 250, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start(({ finished }) => { if (finished) clearTimeout(fallback); });
    return () => { clearTimeout(fallback); animation.stop(); };
  }, [entrance, reducedMotion]);
  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

function ChoiceCard({ title, detail, icon, selected, multiple, disabled, rtl, onPress }: {
  title: string; detail: string; icon: React.ComponentProps<typeof Icon>['name']; selected: boolean; multiple: boolean; disabled: boolean; rtl: boolean; onPress: () => void;
}) {
  const textStyle = { textAlign: rtl ? 'right' as const : 'left' as const, writingDirection: rtl ? 'rtl' as const : 'ltr' as const };
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={`${title}. ${detail}`} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choice, { flexDirection: rtl ? 'row-reverse' : 'row', borderColor: selected ? '#A5CE4E' : '#E0E3DC', backgroundColor: selected ? lime : '#FFFFFF', opacity: disabled ? 0.55 : pressed ? 0.7 : 1 }]}>
    <View style={[styles.choiceIcon, { backgroundColor: selected ? ink : '#F0F1EB' }]}><Icon name={icon} color={selected ? lime : '#5E6B5B'} size={22} /></View>
    <View style={{ flex: 1, gap: 3 }}><Label bold size={15} color={ink} style={textStyle}>{title}</Label><Label size={11} color={selected ? '#465822' : muted} style={textStyle}>{detail}</Label></View>
    <View style={{ width: 21, height: 21, borderRadius: multiple ? 6 : 11, borderWidth: selected ? 0 : 1.5, borderColor: '#C9D0C2', backgroundColor: selected ? ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{selected && <Icon name="checkmark" size={13} color={lime} />}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F3EF' },
  frame: { flex: 1, maxWidth: 540, width: '100%', alignSelf: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 19 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDE1D6', backgroundColor: '#FFFFFF', borderRadius: 16 },
  stepBadge: { minWidth: 67, minHeight: 33, paddingHorizontal: 11, borderRadius: 12, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' },
  progress: { gap: 6, paddingHorizontal: 24 },
  languageIcon: { height: 43, width: 43, borderRadius: 15, backgroundColor: ink, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '7deg' }] },
  hello: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#E9EDE0', borderRadius: 20 },
  helloDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#82A637' },
  questionMark: { height: 35, width: 35, borderRadius: 12, backgroundColor: ink, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 12, gap: 11, backgroundColor: '#F4F3EF', borderTopWidth: 1, borderColor: '#E0E3D9' },
  next: { minHeight: 58, paddingLeft: 21, paddingRight: 11, paddingVertical: 9, gap: 10, alignItems: 'center', justifyContent: 'space-between', borderRadius: 20 },
  nextIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, backgroundColor: '#FBE8E6', borderRadius: 12 },
  choice: { minHeight: 86, paddingHorizontal: 14, paddingVertical: 15, borderRadius: 21, borderWidth: 1, alignItems: 'center', gap: 13 },
  choiceIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
