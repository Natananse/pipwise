import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Switch, View, useWindowDimensions } from 'react-native';
import { AppButton, Icon, Label, LoadingState, Row } from '../../components/design';
import { PredictionChart } from '../../components/PredictionChart';
import { ReferenceCard, ReferenceScreen, referenceColors as c } from '../../components/reference';
import { chartPracticeRound, practiceRoundCount, Prediction } from '../../lib/chartPractice';
import { ThemeSurface } from '../../lib/theme';
import { useWorkspace } from '../../lib/workspace';
import { fitChartHeight, responsiveLayout } from '../../lib/responsiveLayout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Analyse() {
  const { loaded } = useWorkspace();
  return <ThemeSurface tone="light">{loaded ? <ChartPractice /> : <LoadingState />}</ThemeSurface>;
}
function ChartPractice() {
  const { predictionAnswers, answerPrediction, update } = useWorkspace();
  const [current, setCurrent] = useState(() => {
    const next = Array.from({ length: practiceRoundCount }, (_, index) => index).find(index => !predictionAnswers[chartPracticeRound(index).id]);
    return next ?? 0;
  });
  const [indicators, setIndicators] = useState(false);
  const { width, height } = useWindowDimensions();
  const layout = responsiveLayout({ width, height, insets: useSafeAreaInsets() });
  const round = chartPracticeRound(current);
  const answer = predictionAnswers[round.id];
  const answered = !!answer;
  const allRounds = Array.from({ length: practiceRoundCount }, (_, index) => chartPracticeRound(index));
  const completed = allRounds.filter(item => predictionAnswers[item.id]);
  const score = completed.filter(item => predictionAnswers[item.id] === item.result).length;
  const choose = (direction: Prediction) => { if (!answered) answerPrediction(round.id, direction); };
  const next = () => { if (current < practiceRoundCount - 1) setCurrent(value => value + 1); else { update({ predictionAnswers: {} }); setCurrent(0); } };
  return <ReferenceScreen contentStyle={{ paddingHorizontal: 16, paddingTop: layout.compactHeight ? 8 : 14, gap: layout.compactHeight ? 12 : 18 }} footer={answered ? <AppButton label={current < practiceRoundCount - 1 ? 'Next chart' : 'Practice again'} onPress={next} /> : <Row style={{ gap: 14 }}><PredictionButton label="↓ Down" color="#ED7275" onPress={() => choose('down')} /><PredictionButton label="↑ Up" color="#61B57B" onPress={() => choose('up')} /></Row>}>
    <Row style={{ gap: 16 }}><View style={{ flex: 1, height: 12, borderRadius: 8, backgroundColor: '#EFF1F4', overflow: 'hidden' }}><View style={{ height: 12, width: `${(current + 1) / practiceRoundCount * 100}%`, backgroundColor: '#2FCA64', borderRadius: 8 }} /></View><Label muted size={13}>{current + 1}/{practiceRoundCount}</Label></Row>
    <View style={{ marginHorizontal: -10, borderRadius: 22, overflow: 'hidden', backgroundColor: '#315657' }}>
      <Row style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 0, justifyContent: 'flex-start', flexWrap: 'wrap' }}><Label size={14} bold color="white">{round.asset.symbol}</Label><View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#F6F7FA', borderRadius: 6 }}><Label bold size={10} color={c.ink}>{round.frame.toUpperCase()}</Label></View><Label size={8} color="#CBDDDA">HISTORICAL PRACTICE</Label></Row>
      <PredictionChart candles={answered ? [...round.visible, ...round.future] : round.visible} precision={round.asset.precision} indicators={indicators} revealed={answered} split={round.visible.length} height={layout.compactHeight ? fitChartHeight(Math.max(100, layout.usableHeight - 132), 290, 140) : width > 1050 ? 390 : Math.max(290, Math.min(400, height - 430))} />
    </View>
    <View style={{ alignItems: 'flex-end', gap: 5 }}><Switch accessibilityLabel="Show 7-period moving average" value={indicators} onValueChange={setIndicators} trackColor={{ false: '#F06C35', true: c.blue }} thumbColor="white" /><Label bold size={10} color={c.ink}>Turn {indicators ? 'off' : 'on'} technical indicators</Label>{indicators && <Label muted size={9}>Yellow line · 7-period moving average</Label>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Market desk technical outlooks and news" onPress={() => router.push('/market-tools')} style={({ pressed }) => ({ padding: 16, minHeight: 64, gap: 5, backgroundColor: '#E5EEE3', borderRadius: 16, opacity: pressed ? 0.65 : 1 })}><Label bold size={14} color={c.ink}>Market outlooks &amp; news →</Label><Label size={11} color={c.muted}>Explore EMA, RSI, MACD and breakout scenarios in Market desk.</Label></Pressable>
    <Label bold size={20} color="#111820">Will {round.asset.symbol} go Up or Down?</Label>
    <Label muted size={11}>Read the visible chart, then reveal the next five simulated candles. This is a practice exercise with no wallet stakes.</Label>
    {answered ? <ReferenceCard style={{ backgroundColor: answer === round.result ? '#EDF9F1' : '#FFF3F2', borderColor: answer === round.result ? '#C8EBD5' : '#F6D8D6', padding: 16 }}>
      <Row><Icon name={answer === round.result ? 'checkmark-circle' : 'bulb-outline'} color={answer === round.result ? '#23A861' : '#D9605F'} size={24} /><Label bold size={16} style={{ flex: 1 }} color={c.ink}>{answer === round.result ? 'Good observation!' : 'A useful learning moment.'}</Label></Row>
      <Label size={12} color={c.ink}>You chose {answer.toUpperCase()}. The next five candles moved {round.result.toUpperCase()} by {Math.abs((round.exit / round.entry - 1) * 100).toFixed(2)}%. The dashed line marks where the hidden candles begin.</Label>
      <Label size={11} muted>One chart pattern can lead to different outcomes. Review the context and repeat the exercise rather than treating the result as a trading signal.</Label>
    </ReferenceCard> : null}
    <Row style={{ flexWrap: 'wrap' }}><Label muted size={11}>Score: {score}/{completed.length} completed</Label><Pressable accessibilityRole="button" onPress={() => router.push('/portfolio')} style={{ minHeight: 44, justifyContent: 'center' }}><Label size={11} bold color={c.blue}>Portfolio analytics →</Label></Pressable></Row>
    <Row style={{ justifyContent: 'center', flexWrap: 'wrap', gap: 6 }}>{allRounds.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Review chart ${index + 1}`} accessibilityState={{ selected: index === current }} onPress={() => setCurrent(index)} style={({ pressed }) => ({ width: 26, height: 32, borderRadius: 8, backgroundColor: index === current ? c.blue : predictionAnswers[item.id] ? '#E5F7EB' : '#F0F3F6', justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.6 : 1 })}><Label size={10} bold color={index === current ? 'white' : c.ink}>{index + 1}</Label></Pressable>)}</Row>
  </ReferenceScreen>;
}
function PredictionButton({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 58, backgroundColor: color, borderRadius: 16, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><Label bold size={18} color="white">{label}</Label></Pressable>;
}
