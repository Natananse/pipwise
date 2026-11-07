import { Link } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, ThemeSurface } from '../lib/theme';
import { ScreenSystemBars } from './ScreenSystemBars';

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

export function LegalText({ children }: { children: React.ReactNode }) {
  return <Text selectable style={styles.body}>{children}</Text>;
}

/** Public legal pages do not depend on workspace, session or onboarding readiness. */
export function LegalPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <ThemeSurface tone="light"><SafeAreaView style={styles.screen}>
    <ScreenSystemBars style="dark" backgroundColor="#F4F6F1" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
    <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={false} contentContainerStyle={styles.content}>
      <Text style={styles.brand}>PIPWISE</Text>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {children}
      <View style={styles.footer}>
        <Link href="/privacy-policy" style={styles.link}>Privacy policy</Link>
        <Link href="/delete-account" style={styles.link}>Delete account</Link>
        <Link href="/" style={styles.link}>Open PipWise</Link>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></ThemeSurface>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F1' },
  content: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 24, paddingBottom: 64, gap: 20 },
  brand: { color: '#206342', fontFamily: fonts.extraBold, fontSize: 14, letterSpacing: 2, paddingTop: 12 },
  title: { color: '#202622', fontFamily: fonts.extraBold, fontSize: 32, lineHeight: 40 },
  subtitle: { color: '#56665A', fontFamily: fonts.medium, fontSize: 14, lineHeight: 22 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22, gap: 14, borderWidth: 1, borderColor: '#E1E6DE' },
  sectionTitle: { color: '#202622', fontFamily: fonts.bold, fontSize: 19, lineHeight: 27 },
  body: { color: '#35443A', fontFamily: fonts.medium, fontSize: 14, lineHeight: 23 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, borderTopWidth: 1, borderColor: '#D7DFD5', paddingTop: 24 },
  link: { color: '#175C3E', fontFamily: fonts.semibold, fontSize: 14, lineHeight: 44, textDecorationLine: 'underline' },
});
