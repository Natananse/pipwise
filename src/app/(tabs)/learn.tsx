import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { BottomSheet } from '../../components/BottomSheet';
import { ContentState } from '../../components/ContentState';
import { GhostButton } from '../../components/GhostButton';
import { PrimaryButton } from '../../components/PrimaryButton';
import { AppInput, Badge, Chip, ErrorState, Icon, Label, PracticeLabel, Row, Sheet, WorkspaceHeader } from '../../components/design';
import { lessons } from '../../lib/lessons';
import { fonts, ThemeSurface, useTheme } from '../../lib/theme';
import { useWorkspace } from '../../lib/workspace';

type Lesson = typeof lessons[number];
export default function Learn() { return <ThemeSurface tone="dark"><LearningWorkspace /></ThemeSurface>; }
function LearningWorkspace() {
  const { bookmarks, completed, toggle, t, loaded, storageError } = useWorkspace(); const { colors } = useTheme();
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('All');
  const [lesson, setLesson] = useState<Lesson | null>(null); const [answer, setAnswer] = useState<number | null>(null);
  const { width } = useWindowDimensions(); const insets = useSafeAreaInsets(); const wide = width > 1050;
  const filtered = lessons.filter(l => (filter === 'All' || (filter === 'Bookmarked' ? bookmarks.includes(l.id) : l.category === filter)) && `${l.title} ${l.description}`.toLowerCase().includes(search.toLowerCase()));
  const nextIndex = lessons.findIndex(l => !completed.includes(l.id));
  const openLesson = (item: Lesson) => { setLesson(item); setAnswer(null); };
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
    <StatusBar style="light" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', maxWidth: 1440, width: '100%', alignSelf: 'center', flex: 1, gap: wide ? 24 : 8 }}>
        <View style={{ flex: wide ? 1 : undefined, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24, gap: 24 }}>
          <WorkspaceHeader title={t('Learn')} subtitle="YOUR LEARNING PATH" />
          <View style={{ alignItems: 'center', gap: 16, paddingVertical: 8 }}>
            <ProgressRing completed={completed.length} total={lessons.length} />
            <Label size={28} bold style={{ textAlign: 'center', letterSpacing: -0.8 }}>{t('Build your edge.')}</Label>
            <Label muted size={13} style={{ textAlign: 'center', maxWidth: 320 }}>Small lessons. Clear ideas. A little more confidence with every step.</Label>
          </View>
          <PrimaryButton label={nextIndex < 0 ? 'Review lesson 1' : `Start lesson ${nextIndex + 1}`} icon="arrow-forward" disabled={!loaded || !lessons.length} onPress={() => openLesson(lessons[Math.max(0, nextIndex)])} />
          <PracticeLabel />
          {!!storageError && <ErrorState message={storageError} />}
        </View>
        <BottomSheet style={{ flex: wide ? 1.3 : 1, marginTop: wide ? 24 : 0, borderRadius: wide ? 32 : undefined, paddingBottom: wide ? 32 : 104 + Math.max(insets.bottom, 14) }}>
          <Row><Label size={26} bold>Your lessons</Label><Badge>{lessons.length} LESSONS</Badge></Row>
          <AppInput label="Explore the library" placeholder="Search lessons" value={search} onChangeText={setSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['All', 'Foundations', 'Technical analysis', 'Risk management', 'Psychology', 'Bookmarked'].map(c => <Chip key={c} label={c} selected={filter === c} onPress={() => setFilter(c)} />)}</ScrollView>
          <View>{!loaded ? <ContentState kind="skeleton" tone="light" title="Loading lessons" /> : filtered.length ? filtered.map(l => {
            const index = lessons.findIndex(item => item.id === l.id); const done = completed.includes(l.id);
            return <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: colors.sheetBorder }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open lesson ${index + 1}, ${l.title}${done ? ', completed' : ''}`} onPress={() => openLesson(l)} style={({ pressed }) => ({ flex: 1, minHeight: 104, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 16, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sheetRaised, alignItems: 'center', justifyContent: 'center' }}>{done ? <Icon name="checkmark" color={colors.sheetText} size={22} /> : <Label size={15} bold color={colors.sheetText}>{String(index + 1).padStart(2, '0')}</Label>}</View>
                <View style={{ flex: 1, gap: 8 }}><Label size={15} bold color={colors.sheetText}>{l.title}</Label><Label size={11} color={colors.sheetSub}>{l.category} · {l.minutes} min{done ? ' · Completed' : ''}</Label></View>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${bookmarks.includes(l.id) ? 'Unsave' : 'Save'} ${l.title}`} accessibilityState={{ selected: bookmarks.includes(l.id) }} onPress={() => toggle('bookmarks', l.id)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Icon name={bookmarks.includes(l.id) ? 'bookmark' : 'bookmark-outline'} color={colors.sheetSub} size={20} /></Pressable>
            </View>;
          }) : <><ContentState kind="empty" tone="light" title="No lessons here yet" detail="Change your search, or bookmark a lesson to find it here." /><GhostButton tone="light" label="Explore all lessons" onPress={() => { setSearch(''); setFilter('All'); }} /></>}</View>
          <Label size={11} muted>Read. Reflect. Put one idea into practice.</Label>
        </BottomSheet>
      </View>
    </ScrollView>
    <Sheet visible={!!lesson} title="Your learning moment" onClose={() => setLesson(null)}>{lesson && <>
      <Badge>{lesson.category}</Badge><Label size={25} bold>{lesson.title}</Label><Label muted size={12}>{lesson.minutes} min read</Label>
      {lesson.content.map((paragraph, i) => <Label key={i} size={16}>{paragraph}</Label>)}
      <Label size={18} bold>Quick check: {lesson.question}</Label>
      {lesson.answers.map((a, i) => <Chip key={a} label={a} selected={answer === i} onPress={() => setAnswer(i)} />)}
      {answer !== null && <Label color={answer === lesson.correct ? colors.sheetUp : colors.sheetDown}>{answer === lesson.correct ? '✓ That’s right. You’re building your knowledge.' : 'Not quite. Revisit the explanation and try again.'}</Label>}
      <PrimaryButton tone="light" label={completed.includes(lesson.id) ? 'Lesson completed ✓' : 'Mark complete'} disabled={answer !== lesson.correct || completed.includes(lesson.id)} onPress={() => toggle('completed', lesson.id)} />
    </>}</Sheet>
  </SafeAreaView>;
}
function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const { colors } = useTheme(); const radius = 66; const circumference = 2 * Math.PI * radius;
  return <View accessibilityRole="progressbar" accessibilityLabel="Learning progress" accessibilityValue={{ min: 0, max: total, now: completed, text: `${completed} of ${total} lessons completed` }} style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={160} height={160} style={{ position: 'absolute' }}><Circle cx={80} cy={80} r={radius} stroke={colors.border} strokeWidth={6} fill="none" />{completed > 0 && <Circle cx={80} cy={80} r={radius} stroke={colors.text} strokeWidth={6} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - Math.min(1, total ? completed / total : 0))} strokeLinecap="round" rotation={-90} origin="80,80" />}</Svg>
    <Label size={40} bold style={{ fontFamily: fonts.extraBold, letterSpacing: -1 }}>{completed}<Label size={20} muted>/{total}</Label></Label><Label size={9} muted>LESSONS COMPLETE</Label>
  </View>;
}
