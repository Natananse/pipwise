import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppButton, Icon, Label, Row, Sheet } from '../../components/design';
import { ReferenceCard, ReferenceScreen, referenceColors as c } from '../../components/reference';
import { lessons } from '../../lib/lessons';
import { useWorkspace } from '../../lib/workspace';

const profiles = [
  { name: 'The Patient Owl', style: 'Writes down a plan before opening a practice position.', result: 12.84, trades: 24 },
  { name: 'Steady Steps', style: 'Uses small positions and reviews every completed trade.', result: 9.62, trades: 18 },
  { name: 'Chart Explorer', style: 'Compares timeframes and keeps a simple trading journal.', result: 7.45, trades: 31 },
  { name: 'Risk First', style: 'Defines the exit before deciding on an entry.', result: 6.18, trades: 16 },
  { name: 'Quiet Momentum', style: 'Reviews the process at the end of each practice session.', result: 4.92, trades: 22 },
];
export default function Top() {
  const { completed, wallet } = useWorkspace();
  const [period, setPeriod] = useState('This month');
  const [selected, setSelected] = useState<typeof profiles[number] | null>(null);
  const lessonCount = lessons.filter(lesson => completed.includes(lesson.id)).length;
  return <ReferenceScreen>
    <View style={{ alignItems: 'center', gap: 10, paddingTop: 8, paddingBottom: 8 }}><View style={{ height: 68, width: 68, borderRadius: 24, backgroundColor: '#FFF2C9', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={35} color="#D7A53D" /></View><Label bold size={28} color={c.ink}>The practice podium</Label><Label muted size={12} style={{ textAlign: 'center' }}>Build good habits. Celebrate your progress.</Label></View>
    <ReferenceCard style={{ backgroundColor: '#EFF4FF', borderColor: '#DCE6FB' }}><Label bold size={17}>Your progress</Label><Row><View><Label bold size={25} color={c.blue}>{lessonCount}/{lessons.length}</Label><Label muted size={11}>Lessons completed</Label></View><View><Label bold size={25} color={c.blue}>{wallet.history.length}</Label><Label muted size={11}>Closed practice trades</Label></View></Row></ReferenceCard>
    <Row><Label bold size={19}>Leaderboard preview</Label><View style={{ borderRadius: 8, backgroundColor: '#F0F3F7', paddingHorizontal: 8, paddingVertical: 5 }}><Label muted size={8} bold>FICTIONAL PROFILES</Label></View></Row>
    <Row style={{ backgroundColor: '#EDEFF4', borderRadius: 22, padding: 4, gap: 4 }}>{['This month', 'All time'].map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: period === value }} onPress={() => setPeriod(value)} style={{ flex: 1, minHeight: 40, borderRadius: 20, backgroundColor: period === value ? 'white' : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Label bold size={12} color={period === value ? c.ink : c.muted}>{value}</Label></Pressable>)}</Row>
    <ReferenceCard style={{ padding: 12, gap: 0 }}>
      {profiles.map((profile, index) => <Pressable key={profile.name} accessibilityRole="button" accessibilityLabel={`View ${profile.name}, fictional example`} onPress={() => setSelected(profile)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17, paddingHorizontal: 6, borderBottomWidth: index < profiles.length - 1 ? 1 : 0, borderColor: c.line, opacity: pressed ? 0.65 : 1 })}>
        <View style={{ width: 28, alignItems: 'center' }}>{index < 3 ? <Icon name="medal" size={25} color={['#D7A53D', '#93A4BB', '#BA8A66'][index]} /> : <Label bold size={18} muted>{index + 1}</Label>}</View>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ['#EBE5FD', '#E3F3E7', '#FFF0DD', '#E1F1F9', '#FAE5E9'][index], alignItems: 'center', justifyContent: 'center' }}><Icon name={index % 2 ? 'leaf-outline' : 'person-outline'} size={21} color={c.ink} /></View>
        <View style={{ flex: 1 }}><Label bold size={12}>{profile.name}</Label><Label muted size={9}>{profile.trades} example trades</Label></View><Label bold size={13} color="#28AE65">+{(profile.result * (period === 'All time' ? 2.4 : 1)).toFixed(2)}%</Label>
      </Pressable>)}
    </ReferenceCard>
    <Label muted size={10}>These profiles and returns demonstrate the leaderboard design. They are not real traders or verified results. A connected community leaderboard is not available yet.</Label>
    <Sheet visible={!!selected} title="Practice inspiration" onClose={() => setSelected(null)}>{selected && <><Label bold size={24}>{selected.name}</Label><Label>{selected.style}</Label><Label muted>Use the habit as a reflection prompt. This profile and its results are fictional examples.</Label><AppButton label="Back to the podium" onPress={() => setSelected(null)} /></>}</Sheet>
  </ReferenceScreen>;
}
