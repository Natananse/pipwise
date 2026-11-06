import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { AppButton, Icon, Label, Row } from '../../components/design';
import { ReferenceCard, ReferenceScreen, referenceColors as c } from '../../components/reference';
import { lessons } from '../../lib/lessons';
import { useWorkspace } from '../../lib/workspace';

export default function Top() {
  const { completed, wallet } = useWorkspace();
  const lessonCount = lessons.filter(lesson => completed.includes(lesson.id)).length;
  return <ReferenceScreen>
    <View style={{ alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 8 }}><View style={{ height: 68, width: 68, borderRadius: 24, backgroundColor: '#FFF2C9', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={35} color="#D7A53D" /></View><Label bold size={28} color={c.ink}>Your practice progress</Label><Label muted size={12} style={{ textAlign: 'center' }}>Build good habits. Review what you have learned.</Label></View>
    <ReferenceCard style={{ backgroundColor: '#EFF4FF', borderColor: '#DCE6FB' }}><Label bold size={17}>Your progress on this device</Label><Row><View><Label bold size={25} color={c.blue}>{lessonCount}/{lessons.length}</Label><Label muted size={11}>Lessons completed</Label></View><View><Label bold size={25} color={c.blue}>{wallet.history.length}</Label><Label muted size={11}>Closed practice trades</Label></View></Row></ReferenceCard>
    <ReferenceCard>
      <Label bold size={19}>Keep learning</Label>
      <Label muted size={13}>{lessonCount === 0 ? 'Start a lesson to learn market concepts and check your understanding.' : lessonCount === lessons.length ? 'You have completed every lesson. Revisit a topic and test what you remember.' : 'Continue your lessons or revisit a topic you want to understand better.'}</Label>
      <AppButton label="Open lessons" icon="book-outline" onPress={() => router.push('/(tabs)/learn')} />
    </ReferenceCard>
    <ReferenceCard>
      <Label bold size={19}>Reflect on your practice</Label>
      <Label muted size={13}>{wallet.history.length ? 'Review your closed practice trades, costs and results in your portfolio.' : 'Practice with virtual funds and moving simulated prices. Closed positions will appear in your portfolio.'}</Label>
      <AppButton label={wallet.history.length ? 'Review portfolio' : 'Open practice'} icon={wallet.history.length ? 'pie-chart-outline' : 'swap-horizontal-outline'} onPress={() => router.push(wallet.history.length ? '/portfolio' : '/(tabs)/practice')} />
    </ReferenceCard>
    <Label muted size={11}>Your lesson progress and virtual trades are stored on this device. Simulated results do not predict real trading outcomes.</Label>
  </ReferenceScreen>;
}
