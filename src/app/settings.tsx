import React from 'react';
import { Body, Button, Card, Screen, Title } from '../components/ui';
import { supabase } from '../lib/supabase';
import { Mode, useTheme } from '../lib/theme';
import { DISCLAIMER } from './disclaimer';

export default function Settings() {
  const { mode, setMode } = useTheme();
  const modes: Mode[] = ['system', 'light', 'dark'];
  return (
    <Screen style={{ gap: 12 }}>
      <Title>Settings</Title>
      <Body>Appearance</Body>
      {modes.map((m) => <Button key={m} label={`${m[0].toUpperCase()}${m.slice(1)}${mode === m ? ' (selected)' : ''}`} variant={mode === m ? 'solid' : 'outline'} onPress={() => setMode(m)} />)}
      <Card><Body>{DISCLAIMER}</Body></Card>
      <Button label="Sign out" variant="outline" onPress={() => supabase?.auth.signOut()} />
    </Screen>
  );
}
