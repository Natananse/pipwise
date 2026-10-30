import React from 'react';
import { View } from 'react-native';
import { Body, Button, Screen, Title } from '../components/ui';
import { useSession } from '../lib/session';

export const DISCLAIMER = 'Educational content only, not financial advice. Most retail traders lose money.';

export default function Disclaimer() {
  const { acceptDisclaimer } = useSession();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <Title>Before you start</Title>
        <Body style={{ fontSize: 18 }}>{DISCLAIMER}</Body>
        <Body>PipWise teaches and helps you practice. It never gives trade signals or guarantees profit.</Body>
      </View>
      <Button label="I understand" onPress={acceptDisclaimer} />
    </Screen>
  );
}
