import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Body, Button, Screen, Title } from '../components/ui';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/theme';

const pages = [
  { t: 'Know the news before it moves price', b: 'Track high-impact events and get an alert before they hit.' },
  { t: 'Learn to read candles', b: 'Short lessons with notes, voice and quizzes on price action.' },
  { t: 'Practice without risking money', b: 'Paper trade, backtest ideas and keep a journal of every trade.' },
];

export default function Onboarding() {
  const [i, setI] = useState(0);
  const { finishOnboarding } = useSession();
  const { colors } = useTheme();
  const last = i === pages.length - 1;
  return (
    <Screen>
      <Pressable onPress={finishOnboarding} style={{ alignSelf: 'flex-end' }}><Text style={{ color: colors.primary, fontSize: 16 }}>Skip</Text></Pressable>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <Title>{pages[i].t}</Title>
        <Body style={{ fontSize: 18 }}>{pages[i].b}</Body>
        <Body>{i + 1} of {pages.length}</Body>
      </View>
      <Button label={last ? 'Get started' : 'Next'} onPress={last ? finishOnboarding : () => setI(i + 1)} />
    </Screen>
  );
}
