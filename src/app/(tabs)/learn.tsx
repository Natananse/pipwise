import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppButton, Icon, Label, Row, Sheet } from '../../components/design';
import { ReferenceScreen, referenceColors as c } from '../../components/reference';
import { Lesson, lessonChapters, lessons } from '../../lib/lessons';
import { fonts } from '../../lib/theme';
import { responsiveLayout } from '../../lib/responsiveLayout';
import { useWorkspace } from '../../lib/workspace';

const ordinals = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

export default function Learn() {
  const { completed, bookmarks, toggle, loaded } = useWorkspace();
  const { width, height } = useWindowDimensions();
  const compact = responsiveLayout({ width, height }).compactHeight;
  const tileSize = compact ? 72 : 86;
  const completedSet = useMemo(() => new Set(completed), [completed]);
  const completedCount = lessons.filter(item => completedSet.has(item.id)).length;
  const nextIndex = lessons.findIndex(item => !completedSet.has(item.id));
  const nextLesson = lessons[Math.max(0, nextIndex)];
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [chaptersVisible, setChaptersVisible] = useState(false);
  const [libraryVisible, setLibraryVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [pathWidth, setPathWidth] = useState(Math.min(width - 40, 640));
  const chapter = lessonChapters.find(item => item.id === chapterId) || lessonChapters.find(item => item.id === nextLesson.chapterId) || lessonChapters[0];
  const chapterIndex = lessonChapters.findIndex(item => item.id === chapter.id);
  const chapterLessons = lessons.filter(item => item.chapterId === chapter.id);
  const chapterCompleted = chapterLessons.filter(item => completedSet.has(item.id)).length;
  const unlocked = (item: Lesson) => completedSet.has(item.id) || lessons.indexOf(item) === nextIndex || nextIndex < 0;
  const openLesson = (item: Lesson) => {
    if (!loaded || !unlocked(item)) return;
    setLesson(item);
    setAnswer(null);
    setLibraryVisible(false);
  };
  const finishLesson = () => {
    if (!lesson || (answer !== lesson.correct && !completedSet.has(lesson.id))) return;
    if (!completedSet.has(lesson.id)) toggle('completed', lesson.id);
    const finishedIds = new Set(completedSet);
    finishedIds.add(lesson.id);
    const following = lessons.find(item => !finishedIds.has(item.id));
    if (following) {
      setChapterId(following.chapterId);
      setLesson(following);
      setAnswer(null);
    } else setLesson(null);
  };
  const filteredLessons = lessons.filter(item => (!savedOnly || bookmarks.includes(item.id)) && `${item.title} ${item.category}`.toLowerCase().includes(search.toLowerCase()));

  return <ReferenceScreen contentStyle={{ padding: 0, gap: 0 }}>
    <View style={{ width: '100%', maxWidth: 680, alignSelf: 'center' }}>
      <View style={{ paddingHorizontal: 18, paddingTop: compact ? 14 : 36, paddingBottom: compact ? 14 : 28, alignItems: 'center', gap: compact ? 10 : 18 }}>
        <Label size={compact ? 24 : width < 360 ? 25 : 29} bold color="#3D1728" style={{ fontFamily: fonts.extraBold, textAlign: 'center', lineHeight: compact ? 32 : width < 360 ? 35 : 40, letterSpacing: -0.7 }}>THE {lessons.length}-LESSON{'\n'}TRADING CHALLENGE</Label>
        <Label size={16} color="#5B6573" style={{ textAlign: 'center' }}>Trade with confidence</Label>
        <View style={{ width: '100%', maxWidth: 320, gap: 8, marginTop: 2 }}>
          <Row><Label size={10} color={c.muted}>{completedCount} of {lessons.length} complete</Label><Pressable accessibilityRole="button" onPress={() => setLibraryVisible(true)} style={{ minHeight: 32, justifyContent: 'center' }}><Label size={10} bold color={c.blue}>Lesson library</Label></Pressable></Row>
          <View accessibilityRole="progressbar" accessibilityLabel="Trading challenge completion" accessibilityValue={{ min: 0, max: lessons.length, now: completedCount }} style={{ height: 5, borderRadius: 5, backgroundColor: '#E9ECF2', overflow: 'hidden' }}><View style={{ width: `${completedCount / lessons.length * 100}%`, height: 5, backgroundColor: '#31C6A0' }} /></View>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose chapter" onPress={() => setChaptersVisible(true)} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginBottom: 8 }}>
          <Row><Label size={13} bold color={c.muted}>Chapter {ordinals[chapterIndex]}</Label><Icon name="chevron-down" color={c.muted} size={15} /></Row>
        </Pressable>
        <View accessibilityLabel={`${chapter.title}, ${chapterCompleted} of ${chapterLessons.length} lessons complete`} style={{ padding: compact ? 14 : 20, minHeight: compact ? 88 : 110, borderRadius: 22, borderWidth: 2, borderColor: c.ink, backgroundColor: chapter.color, shadowColor: c.ink, shadowOffset: { width: 4, height: 5 }, shadowRadius: 0, shadowOpacity: 0.15, elevation: 2 }}>
          <Row><View style={{ flex: 1, gap: 8 }}><Label size={24} bold color={c.ink} style={{ fontFamily: fonts.extraBold }}>{chapter.title}</Label><Row style={{ justifyContent: 'flex-start' }}><CoinMark /><Label size={11} color={c.muted}>{chapter.category}</Label></Row></View><Label size={20} bold color={c.ink}>{chapterCompleted} / {chapterLessons.length}</Label></Row>
        </View>
        <View onLayout={event => setPathWidth(event.nativeEvent.layout.width)}>
          <Svg width="100%" height={compact ? 36 : 62} preserveAspectRatio="none" viewBox={`0 0 ${pathWidth} 62`}><Path d={`M${tileSize / 2} 0 V62`} stroke={c.ink} strokeWidth={3} strokeLinecap="round" fill="none" /></Svg>
          {chapterLessons.map((item, index) => {
            const done = completedSet.has(item.id);
            const active = unlocked(item);
            const reverse = index % 2 === 1;
            const globalIndex = lessons.indexOf(item);
            return <View key={item.id}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Lesson ${globalIndex + 1}: ${item.title}. ${done ? 'Completed, review lesson' : active ? 'Ready to start' : 'Complete earlier lessons to unlock'}`} accessibilityState={{ disabled: !active || !loaded }} disabled={!active || !loaded} onPress={() => openLesson(item)} style={({ pressed }) => ({ minHeight: compact ? 88 : 104, flexDirection: reverse ? 'row-reverse' : 'row', alignItems: 'center', gap: width < 360 ? 14 : 20, opacity: active ? pressed ? 0.7 : 1 : 0.42 })}>
                <View style={{ width: tileSize, height: tileSize, borderRadius: 24, backgroundColor: done ? '#E4F8ED' : active ? chapter.color : '#EEF0F3', borderWidth: 2, borderColor: active ? c.ink : '#929AA3', alignItems: 'center', justifyContent: 'center', shadowColor: c.ink, shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.13, shadowRadius: 0, elevation: active ? 2 : 0 }}>
                  {done ? <Icon name="checkmark" size={39} color="#1D9765" /> : globalIndex === 0 ? <TargetMark /> : <Icon name={item.icon} size={36} color={active ? c.ink : '#929AA3'} />}
                  {!active && <View style={{ position: 'absolute', bottom: -7, right: -6, backgroundColor: '#F5F8FC', borderRadius: 12, padding: 4 }}><Icon name="lock-closed" size={13} color="#8993A0" /></View>}
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 10 }}><Label size={13} color={active ? c.ink : c.muted}>Lesson {globalIndex + 1}</Label><View style={{ width: 66, height: 5, borderRadius: 5, backgroundColor: '#E8EAF0' }}><View style={{ width: done ? '100%' : active ? '10%' : '0%', height: 5, borderRadius: 5, backgroundColor: '#2CC6A1' }} /></View></Row>
                  <Label size={width < 360 ? 16 : 18} bold color={c.ink} style={{ fontFamily: fonts.extraBold }}>{item.title}</Label>
                  {active && !done && <Label size={10} color={c.muted}>{item.minutes} min · Tap to start</Label>}
                </View>
              </Pressable>
              {index < chapterLessons.length - 1 && <Svg width="100%" height={compact ? 44 : 70} preserveAspectRatio="none" viewBox={`0 0 ${pathWidth} 70`}>
                <Path d={reverse ? `M${pathWidth - tileSize / 2} 0 V15 Q${pathWidth - tileSize / 2} 35 ${pathWidth - tileSize / 2 - 20} 35 H${tileSize / 2 + 20} Q${tileSize / 2} 35 ${tileSize / 2} 55 V70` : `M${tileSize / 2} 0 V15 Q${tileSize / 2} 35 ${tileSize / 2 + 20} 35 H${pathWidth - tileSize / 2 - 20} Q${pathWidth - tileSize / 2} 35 ${pathWidth - tileSize / 2} 55 V70`} stroke={done ? '#2CC6A1' : '#DEE4EB'} strokeWidth={3} strokeDasharray={done ? undefined : '2 9'} strokeLinecap="round" fill="none" />
              </Svg>}
            </View>;
          })}
        </View>
        <View style={{ paddingTop: 32, paddingBottom: 12, gap: 14 }}>
          <AppButton label={nextIndex < 0 ? 'Review the challenge' : `Continue lesson ${nextIndex + 1}`} icon="arrow-forward" disabled={!loaded} onPress={() => openLesson(nextLesson)} />
          <Pressable accessibilityRole="button" onPress={() => setChaptersVisible(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Label size={12} bold color={c.blue}>Explore all {lessonChapters.length} chapters</Label></Pressable>
          <Label size={10} color={c.muted} style={{ textAlign: 'center', maxWidth: 420, alignSelf: 'center' }}>Short lessons, one clear idea at a time. Progress is saved on this device. Educational practice with virtual funds.</Label>
        </View>
      </View>
    </View>

    <Sheet visible={chaptersVisible} title="Your learning chapters" onClose={() => setChaptersVisible(false)}>
      {lessonChapters.map((item, index) => {
        const done = item.lessonIds.filter(id => completedSet.has(id)).length;
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Chapter ${index + 1}, ${item.title}, ${done} of ${item.lessonIds.length} complete`} onPress={() => { setChapterId(item.id); setChaptersVisible(false); }} style={({ pressed }) => ({ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: item.id === chapter.id ? c.blue : c.line, backgroundColor: item.color, opacity: pressed ? 0.7 : 1 })}><Row><View style={{ flex: 1 }}><Label size={10} color={c.muted}>CHAPTER {index + 1}</Label><Label size={18} bold color={c.ink}>{item.title}</Label></View><Label bold color={c.ink}>{done}/{item.lessonIds.length}</Label></Row></Pressable>;
      })}
    </Sheet>

    <Sheet visible={libraryVisible} title="Lesson library" onClose={() => setLibraryVisible(false)}>
      <TextInput accessibilityLabel="Search lessons" value={search} onChangeText={setSearch} placeholder="Search a topic or lesson" placeholderTextColor={c.muted} style={{ minHeight: 48, borderWidth: 1, borderColor: c.line, borderRadius: 14, paddingHorizontal: 14, color: c.ink, fontFamily: fonts.medium, backgroundColor: '#F5F8FC' }} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: savedOnly }} onPress={() => setSavedOnly(value => !value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={savedOnly ? 'checkbox' : 'square-outline'} color={c.blue} /><Label color={c.ink}>Saved lessons only</Label></Pressable>
      {!filteredLessons.length && <Label color={c.muted}>No lessons match. Try another search or save a lesson for later.</Label>}
      {filteredLessons.map(item => <Pressable key={item.id} disabled={!loaded || !unlocked(item)} accessibilityRole="button" accessibilityState={{ disabled: !loaded || !unlocked(item) }} onPress={() => openLesson(item)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: unlocked(item) ? 1 : 0.45 }}><Icon name={completedSet.has(item.id) ? 'checkmark-circle-outline' : unlocked(item) ? item.icon : 'lock-closed-outline'} color={c.blue} /><View style={{ flex: 1 }}><Label bold color={c.ink}>{item.title}</Label><Label size={10} color={c.muted}>{item.category} · {completedSet.has(item.id) ? 'Completed' : unlocked(item) ? 'Ready to start' : 'Complete earlier lessons to unlock'}</Label></View></Pressable>)}
    </Sheet>

    <Sheet visible={!!lesson} title="Your learning moment" onClose={() => setLesson(null)}>
      {lesson && <>
        <Row><Label size={11} color={c.muted}>LESSON {lessons.indexOf(lesson) + 1} / {lessons.length}</Label><Pressable accessibilityRole="button" accessibilityLabel={`${bookmarks.includes(lesson.id) ? 'Unsave' : 'Save'} lesson`} onPress={() => toggle('bookmarks', lesson.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name={bookmarks.includes(lesson.id) ? 'bookmark' : 'bookmark-outline'} color={c.blue} /></Pressable></Row>
        <Label size={26} bold color={c.ink}>{lesson.title}</Label>
        <Label size={11} color={c.muted}>{lesson.category} · {lesson.minutes} minute learning moment</Label>
        {lesson.content.map((paragraph, index) => <Label key={index} size={15} color={index === lesson.content.length - 1 ? '#5D6E7E' : c.ink}>{paragraph}</Label>)}
        <View style={{ height: 1, backgroundColor: c.line }} />
        <Label bold size={17} color={c.ink}>Quick check</Label><Label color={c.ink}>{lesson.question}</Label>
        {lesson.answers.map((option, index) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: answer === index }} onPress={() => setAnswer(index)} style={({ pressed }) => ({ minHeight: 56, borderRadius: 16, borderWidth: 1.5, borderColor: answer === index ? c.blue : c.line, backgroundColor: answer === index ? '#EAF3FF' : '#FFFFFF', padding: 14, opacity: pressed ? 0.7 : 1 })}><Label size={13} bold={answer === index} color={c.ink}>{option}</Label></Pressable>)}
        {answer !== null && <View accessibilityRole="alert"><Label size={13} color={answer === lesson.correct ? '#17915A' : '#C5424B'}>{answer === lesson.correct ? 'That’s right. One more idea in your toolkit.' : 'Not quite. Read the explanation and give it another try.'}</Label></View>}
        <AppButton label={completedCount === lessons.length ? 'Finish review' : completedSet.has(lesson.id) ? 'Review complete · Continue learning' : lessons.indexOf(lesson) === lessons.length - 1 ? 'Finish the challenge' : 'Complete & continue'} icon="arrow-forward" disabled={!completedSet.has(lesson.id) && answer !== lesson.correct} onPress={finishLesson} />
      </>}
    </Sheet>
  </ReferenceScreen>;
}

function CoinMark() {
  return <View style={{ width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: c.ink, backgroundColor: '#F3CE58', alignItems: 'center', justifyContent: 'center' }}><Label bold size={12} color={c.ink}>$</Label></View>;
}
function TargetMark() {
  return <Svg width={57} height={57} viewBox="0 0 60 60"><Circle cx={30} cy={30} r={25} fill="#F4CED8" stroke={c.ink} strokeWidth={2} /><Circle cx={30} cy={30} r={16} fill="#F6FCFF" stroke={c.ink} strokeWidth={1.8} /><Circle cx={30} cy={30} r={5} fill="#EC6B7D" stroke={c.ink} strokeWidth={1.3} /></Svg>;
}
