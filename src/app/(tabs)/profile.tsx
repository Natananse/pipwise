import { useRouter } from 'expo-router';
import React from 'react';
import { Body, Button, Card, Screen, Title } from '../../components/ui';
import { useSession } from '../../lib/session';

export default function Profile() {
  const { session, plan } = useSession();
  const router = useRouter();
  return (
    <Screen style={{ gap: 12 }}>
      <Title>Profile</Title>
      <Card><Body>{session?.user.email}</Body><Body>Plan: {plan}</Body></Card>
      {plan === 'free' && <Button label="Upgrade to Pro" onPress={() => router.push('/paywall')} />}
      <Button label="Settings" variant="outline" onPress={() => router.push('/settings')} />
    </Screen>
  );
}
