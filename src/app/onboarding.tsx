import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WelcomeArtwork } from '../components/WelcomeArtwork';
import { AppLogo } from '../components/AppLogo';
import { AppButton, Icon, Label, Row } from '../components/design';
import { hasCompleteOnboardingAnswers, onboardingQuestions, onboardingStartStep, onboardingText } from '../lib/onboarding';
import { useSession } from '../lib/session';
import { fonts, ThemeSurface, useTheme } from '../lib/theme';
import { useReducedMotion } from '../lib/useReducedMotion';
import { Language, useWorkspace } from '../lib/workspace';

export default function Onboarding() {
  const { loaded } = useWorkspace();
  const { start } = useLocalSearchParams<{ start?: string | string[] }>();
  const initialStep = onboardingStartStep(start);
  return <ThemeSurface tone="dark">{loaded ? <OnboardingWizard key={initialStep} initialStep={initialStep} /> : null}</ThemeSurface>;
}

function OnboardingWizard({ initialStep }: { initialStep: number }) {
  const { language, preferences, persistOnboarding } = useWorkspace();
  const { finishOnboarding, acceptDisclaimer } = useSession();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [step, setStep] = useState(initialStep);
  const [draftLanguage, setDraftLanguage] = useState<Language>(language);
  const [experience, setExperience] = useState(preferences.experience);
  const [markets, setMarkets] = useState(preferences.markets);
  const [goal, setGoal] = useState(preferences.goal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tx = (text: string) => onboardingText(draftLanguage, text);
  const question = step >= 2 ? onboardingQuestions[step - 2] : null;
  const valid = step === 2 ? !!experience : step === 3 ? markets.length > 0 : step === 4 ? !!goal : true;

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (step === 0) return false;
      setStep(value => value - 1);
      return true;
    });
    return () => subscription.remove();
  }, [busy, step]);

  const next = async () => {
    if (busy || !valid) return;
    setError('');
    if (step < 4) { setStep(step + 1); return; }
    if (!hasCompleteOnboardingAnswers({ experience, markets, goal })) {
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      // Save the complete setup before allowing the startup guard to leave onboarding.
      await persistOnboarding({ experience, markets, goal }, draftLanguage);
      await acceptDisclaimer();
      await finishOnboarding();
    } catch {
      setError(tx('Could not save your setup. Please try again.'));
    } finally { setBusy(false); }
  };
  const choose = (value: string) => {
    if (busy) return;
    if (step === 2) setExperience(value);
    else if (step === 4) setGoal(value);
    else setMarkets(current => current.includes(value) ? current.filter(m => m !== value) : [...current, value]);
  };

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
    <StatusBar style="light" />
    <View style={{ flex: 1, maxWidth: 540, width: '100%', alignSelf: 'center' }}>
      <Row style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
        {step > 0 ? <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={tx('Back')} accessibilityState={{ disabled: busy }} onPress={() => { setError(''); setStep(value => value - 1); }} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : pressed ? 0.6 : 1 })}><Icon name="arrow-back" size={20} /></Pressable> : <AppLogo size={36} />}
        <Label bold size={20} style={{ fontFamily: fonts.extraBold, letterSpacing: -0.7 }}>Pipwise<Label size={20} color={colors.primary}>.</Label></Label>
        <View style={{ minWidth: 44, alignItems: 'flex-end' }}><Icon name={step === 0 ? 'shield-checkmark-outline' : 'sparkles-outline'} color={colors.sub} size={19} /></View>
      </Row>
      {step > 0 && <View accessibilityRole="progressbar" accessibilityLabel={tx('Let’s make it yours.')} accessibilityValue={{ min: 1, max: 4, now: step }} style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingBottom: 8 }}>
        {[1, 2, 3, 4].map(value => <View key={value} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: value <= step ? colors.primary : colors.border }} />)}
      </View>}
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: step === 0 ? 8 : 24, paddingBottom: 24, justifyContent: step === 0 ? 'center' : 'flex-start' }}>
        <StepEntrance key={step} reducedMotion={reducedMotion !== false}>
          {step === 0 ? <View style={{ gap: 22 }}>
            <WelcomeArtwork compact={height < 740} reducedMotion={reducedMotion !== false} />
            <View style={{ gap: 12 }}>
              <Label size={10} bold color={colors.primary} style={{ letterSpacing: 1.4 }}>{tx('YOUR NEXT CHAPTER STARTS HERE')}</Label>
              <View accessibilityRole="header"><Label size={width < 360 || draftLanguage === 'am' ? 34 : 40} bold style={{ fontFamily: fonts.extraBold, letterSpacing: -1.5, lineHeight: draftLanguage === 'am' ? 50 : 48 }}>{tx('Trade smarter.')}</Label><Label size={width < 360 || draftLanguage === 'am' ? 34 : 40} bold color={colors.primary} style={{ fontFamily: fonts.extraBold, letterSpacing: -1.5, lineHeight: draftLanguage === 'am' ? 50 : 48 }}>{tx('Practice wiser.')}</Label></View>
              <Label muted size={14}>{tx('Explore markets. Build confidence. Find your rhythm with $10,000 in virtual funds.')}</Label>
            </View>
            <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <Row><Icon name="wallet-outline" size={16} color={colors.primary} /><Label size={11} muted>{tx('Virtual money')}</Label></Row>
              <Row><Icon name="leaf-outline" size={16} color={colors.primary} /><Label size={11} muted>{tx('Your pace')}</Label></Row>
            </Row>
            <Label muted size={11}>{tx('Language + 3 quick questions')}</Label>
          </View> : step === 1 ? <View style={{ gap: 24 }}>
            <View style={{ width: 68, height: 68, borderRadius: 23, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}><Icon name="language-outline" size={32} color={colors.primary} /></View>
            <View style={{ gap: 10 }}><Label muted size={11}>{tx('Let’s make it yours.')}</Label><View accessibilityRole="header"><Label size={32} bold style={{ letterSpacing: -1 }}>{tx('Choose your language')}</Label></View><Label muted size={14}>{tx('A familiar language. A clearer start. You can change this in your profile.')}</Label></View>
            <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
              {([{ value: 'en', title: 'English', detail: 'English', mark: 'En' }, { value: 'am', title: 'አማርኛ', detail: 'Amharic', mark: 'አ' }] as const).map(option => <ChoiceCard key={option.value} title={option.title} detail={option.detail} mark={option.mark} selected={draftLanguage === option.value} disabled={busy} onPress={() => setDraftLanguage(option.value)} />)}
            </View>
          </View> : question && <View style={{ gap: 24 }}>
            <View style={{ gap: 10 }}>
              <Row><Label size={10} bold color={colors.primary} style={{ letterSpacing: 1.4 }}>{tx('A LITTLE ABOUT YOU')}</Label><Label muted size={11}>{tx('Question')} {step - 1} {tx('of')} 3</Label></Row>
              <View accessibilityRole="header"><Label bold size={draftLanguage === 'am' ? 28 : 30} style={{ letterSpacing: -0.8 }}>{tx(question.title)}</Label></View>
              <Label muted size={13}>{tx(question.detail)}</Label>
            </View>
            <View accessibilityRole={step === 3 ? undefined : 'radiogroup'} style={{ gap: 10 }}>
              {question.options.map(option => <ChoiceCard key={option.value} title={tx(option.value)} detail={tx(option.detail)} icon={option.icon} selected={step === 2 ? experience === option.value : step === 4 ? goal === option.value : markets.includes(option.value)} multiple={step === 3} disabled={busy} onPress={() => choose(option.value)} />)}
            </View>
            {step === 3 && <Label muted size={11}>{tx('Select all that apply')} · {markets.length}</Label>}
          </View>}
        </StepEntrance>
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 12, borderTopWidth: step > 0 ? 1 : 0, borderColor: colors.border }}>
        {!!error && <View accessibilityRole="alert"><Label size={12} color={colors.down}>{error}</Label></View>}
        <AppButton label={tx(step === 0 ? 'Get started' : step === 1 ? 'Continue to questions' : step === 4 ? 'Save & continue' : 'Continue')} icon="arrow-forward" onPress={() => { void next(); }} disabled={!valid} busy={busy} />
        <Label size={10} muted style={{ textAlign: 'center' }}>{tx(step === 4 ? 'Preferences stay on this device. Change them anytime in your profile.' : 'Educational simulator · No real money or live quotes.')}</Label>
      </View>
    </View>
  </SafeAreaView>;
}

function StepEntrance({ children, reducedMotion }: { children: React.ReactNode; reducedMotion: boolean }) {
  const [entrance] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(entrance, { toValue: 1, duration: reducedMotion ? 0 : 300, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [entrance, reducedMotion]);
  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</Animated.View>;
}

function ChoiceCard({ title, detail, icon, mark, selected, multiple = false, disabled, onPress }: {
  title: string; detail: string; icon?: React.ComponentProps<typeof Icon>['name']; mark?: string;
  selected: boolean; multiple?: boolean; disabled: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  const foreground = selected ? colors.onPrimary : colors.text;
  return <Pressable accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={`${title}. ${detail}`} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 82, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card, flexDirection: 'row', alignItems: 'center', gap: 14, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 })}>
    <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: selected ? '#B5DE59' : colors.raised, alignItems: 'center', justifyContent: 'center' }}>{icon ? <Icon name={icon} color={foreground} size={21} /> : <Label bold size={18} color={foreground}>{mark}</Label>}</View>
    <View style={{ flex: 1, gap: 3 }}><Label bold size={14} color={foreground}>{title}</Label><Label size={11} color={selected ? '#34431E' : colors.sub}>{detail}</Label></View>
    <View style={{ width: 21, height: 21, borderRadius: multiple ? 6 : 11, borderWidth: selected ? 0 : 1.5, borderColor: colors.sub, backgroundColor: selected ? colors.onPrimary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{selected && <Icon name="checkmark" size={14} color={colors.primary} />}</View>
  </Pressable>;
}
