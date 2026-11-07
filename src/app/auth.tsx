import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppLogo } from "../components/AppLogo";
import { RegistrationFields } from "../components/RegistrationFields";
import { ScreenSystemBars } from "../components/ScreenSystemBars";
import { AccountAccessError, AccountVerificationError, appleAuthEnabled, googleAuthEnabled, signIn, signUp as createAccount, verifyEmail, resendVerification, requestPasswordReset, signInWithGoogle, signInWithApple } from "../lib/neonAuth";
import { useSession } from "../lib/session";
import { useWorkspace } from "../lib/workspace";
import { Icon, Label } from "../components/design";
import { languages } from "../lib/languages";
import { fonts, ThemeSurface } from "../lib/theme";
import { authRedirectUri } from "../lib/authLinks";
import { withStartupTimeout } from "../lib/startupTasks";
import { normalizeProfileName, profileNameMaxLength } from "../lib/accountProfile";
import { normalizeRegistrationDetails } from "../lib/registrationDetails";
import { stageRegistrationDetails, syncPendingRegistrationDetails } from "../lib/accountDetails";
import { responsiveLayout } from "../lib/responsiveLayout";

export default function Auth() {
  const { startDemo, authConfigured } = useSession();
  const { t, language } = useWorkspace();
  const { width, height } = useWindowDimensions();
  const compact = responsiveLayout({ width, height }).compactHeight;
  const rtl = languages.find(item => item.code === language)?.rtl ?? false;
  const textDirection = { textAlign: rtl ? "right" as const : "left" as const, writingDirection: rtl ? "rtl" as const : "ltr" as const };
  const rowDirection = rtl ? "row-reverse" as const : "row" as const;
  const [show, setShow] = useState(false);
  const [reset, setReset] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const submitting = useRef(false);
  const [focused, setFocused] = useState<"name" | "email" | "password" | null>(null);
  const [countryCode, setCountryCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // On success the session listener updates and the guard moves us to the app.
  const run = async (fn: () => Promise<void>) => {
    if (submitting.current) return;
    submitting.current = true;
    setMessage("");
    setMessageTone("info");
    setBusy(true);
    try {
      await fn();
    } catch (e: unknown) {
      if (e instanceof AccountVerificationError) {
        setConfirmationPending(true);
        setMessageTone('error');
        setMessage(e.message);
      } else if (e instanceof AccountAccessError && e.code === 'EMAIL_NOT_VERIFIED') {
        setReset(false);
        setConfirmationPending(true);
        setMessage('Confirm your email to finish signing in. Enter your confirmation code below, or request a new one.');
      } else {
        setMessageTone("error");
        setMessage(e instanceof Error ? e.message : "Check your connection and try again.");
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (signUp && confirmationPending && !reset) throw new Error('Your account has already been created. Confirm your email below, or use Resend confirmation email.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Enter a valid email address.");
      if (!reset && password.length < 8) throw new Error("Use a password of at least 8 characters.");
      if (reset) {
        await withStartupTimeout(requestPasswordReset(email.trim()), "The request took too long. Check your connection and try again.");
        router.push({ pathname: '/reset-password', params: { email: email.trim() } });
      } else if (signUp) {
        const displayName = normalizeProfileName(name);
        const details = normalizeRegistrationDetails({ countryCode, phoneNumber });
        let session;
        try {
          session = await withStartupTimeout(createAccount(email.trim(), password, displayName), "Creating your account took too long. Check your email for a code before trying to register again.", 25000);
        } catch (error) {
          if (error instanceof AccountVerificationError) {
            try { await stageRegistrationDetails(email, details); } catch { /* Profile can collect these details after confirmation. */ }
          }
          throw error;
        }
        setConfirmationPending(!session);
        try {
          await stageRegistrationDetails(email, details);
          if (session) await syncPendingRegistrationDetails(session);
        } catch {
          throw new Error('Your account was created, but your country and phone details could not be saved yet. Confirm your email, then add them from your profile.');
        }
        if (!session) {
          setConfirmationPending(true);
          setMessage("Check your email for a confirmation code, then sign in.");
        }
      } else {
        await withStartupTimeout(signIn(email.trim(), password), "Sign-in took too long. Check your connection and try again.");
      }
    });

  const google = () => run(async () => {
    // The system browser remains open while the user chooses and confirms an
    // account. Only the network steps inside the flow have a timeout.
    await signInWithGoogle(authRedirectUri());
  });
  const apple = () => run(async () => {
    await signInWithApple(authRedirectUri());
  });

  const switchMode = (nextSignUp: boolean) => {
    setSignUp(nextSignUp);
    setReset(false);
    setMessage("");
    setConfirmationPending(false);
    setConfirmationCode('');
  };
  const verifyConfirmation = () => run(async () => {
    if (!confirmationCode.trim()) throw new Error('Enter the confirmation code from your email.');
    await withStartupTimeout(verifyEmail(email.trim(), confirmationCode.trim()), 'Confirmation took too long. Check your connection and try again.');
    await withStartupTimeout(signIn(email.trim(), password), 'Sign-in took too long. Check your connection and try again.');
    setConfirmationPending(false); setConfirmationCode('');
  });
  const resendConfirmation = () => run(async () => {
    await withStartupTimeout(resendVerification(email.trim()), 'The request took too long. Check your connection and try again.');
    setMessage('A new confirmation code has been requested. Check your inbox and spam folder.');
  });
  const title = t(reset ? "Reset password" : signUp ? "Create account" : "Welcome back");
  return <ThemeSurface tone="light">
    <SafeAreaView style={styles.screen}>
      <ScreenSystemBars style="dark" backgroundColor={ivory} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "web" ? undefined : "padding"}>
      <ScrollView
        automaticallyAdjustKeyboardInsets={false}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        contentContainerStyle={[styles.content, { paddingHorizontal: width < 360 ? 18 : 24 }, compact && { paddingTop: 10, paddingBottom: 16, gap: 14 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.brandRow, { flexDirection: rowDirection }]}>
          <View style={[styles.brand, { flexDirection: rowDirection }]}><AppLogo size={38} decorative /><Label bold size={22} color={ink} style={{ fontFamily: fonts.extraBold, letterSpacing: -0.8 }}>pipwise<Label size={22} color="#63852D">.</Label></Label></View>
          <View style={styles.brandMark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden><Icon name="arrow-up-outline" size={18} color={ink} /></View>
        </View>

        <View style={[styles.hero, { flexDirection: rowDirection }]}>
          <View style={{ flex: 1, gap: 9 }}>
            <Label size={10} bold color="#70766B" style={{ ...textDirection, letterSpacing: rtl ? 0 : 0.6 }}>{t("Your market. Your move.")}</Label>
            <View accessibilityRole="header"><Label size={compact ? 26 : width < 360 ? 29 : 34} bold color={ink} style={{ ...textDirection, fontFamily: fonts.extraBold, letterSpacing: rtl ? 0 : -1.3, lineHeight: compact ? 34 : width < 360 ? 37 : 43 }}>{title}</Label></View>
            <Label size={12} color={muted} style={{ ...textDirection, lineHeight: 19 }}>{t("Build confidence, one practice trade at a time.")}</Label>
          </View>
          <View style={[styles.heroMark, compact && { width: 46, height: 50, borderRadius: 16 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden><Icon name={reset ? "key-outline" : signUp ? "sparkles-outline" : "person-outline"} size={27} color={lime} /><View style={styles.heroDot} /></View>
        </View>

        <View style={styles.formCard}>
          {reset ? <Pressable accessibilityRole="button" accessibilityLabel={t("Back")} disabled={busy} onPress={() => { setReset(false); setMessage(""); }} style={({ pressed }) => [styles.back, { alignSelf: rtl ? "flex-end" : "flex-start", flexDirection: rowDirection, opacity: pressed ? 0.6 : 1 }]}><Icon name={rtl ? "arrow-forward" : "arrow-back"} size={17} color={ink} /><Label size={12} bold color={ink}>{t("Back")}</Label></Pressable> : <View accessibilityRole="tablist" style={[styles.tabs, { flexDirection: rowDirection }]}>
            {[false, true].map(mode => <Pressable key={String(mode)} accessibilityRole="tab" accessibilityLabel={t(mode ? "Create account" : "Sign in")} accessibilityState={{ selected: signUp === mode, disabled: busy }} disabled={busy} onPress={() => switchMode(mode)} style={({ pressed }) => [styles.tab, signUp === mode && styles.tabSelected, { opacity: pressed ? 0.7 : 1 }]}><Label bold size={12} color={signUp === mode ? "#F4F3EF" : muted} style={{ textAlign: "center" }}>{t(mode ? "Create account" : "Sign in")}</Label></Pressable>)}
          </View>}

          {signUp && !reset && <View style={styles.field}>
            <Label size={11} bold color={ink} style={textDirection}>{t("Full name")}</Label>
            <View style={[styles.inputShell, { borderColor: focused === "name" ? "#8DA645" : border, flexDirection: rowDirection }]}>
              <Icon name="person-outline" size={18} color={muted} />
              <TextInput
                style={[styles.input, textDirection]}
                accessibilityLabel={t("Full name")}
                placeholder={t("Your name")}
                placeholderTextColor="#979C91"
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="name"
                maxLength={profileNameMaxLength}
                selectionColor="#8DA645"
                editable={!busy && !confirmationPending}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused("name")}
                onBlur={() => setFocused(null)}
              />
            </View>
            <Label size={10} color={muted} style={textDirection}>{t("This name appears on your profile.")}</Label>
          </View>}

          {signUp && !reset && <RegistrationFields countryCode={countryCode} phoneNumber={phoneNumber} onCountryChange={setCountryCode} onPhoneChange={setPhoneNumber} disabled={busy || confirmationPending} />}
          <View style={styles.field}>
            <Label size={11} bold color={ink} style={textDirection}>{t("Email address")}</Label>
            <View style={[styles.inputShell, { borderColor: focused === "email" ? "#8DA645" : border, flexDirection: rowDirection }]}>
              <Icon name="mail-outline" size={18} color={muted} />
              <TextInput
                style={styles.input}
                accessibilityLabel={t("Email address")}
                placeholder="you@example.com"
                placeholderTextColor="#979C91"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                selectionColor="#8DA645"
                editable={!busy}
                value={email}
                onChangeText={value => { setEmail(value); setConfirmationPending(false); setConfirmationCode(''); }}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                onSubmitEditing={reset ? submit : undefined}
              />
            </View>
          </View>

          {!reset && <View style={styles.field}>
            <View style={[styles.fieldHeading, { flexDirection: rowDirection }]}>
              <Label size={11} bold color={ink} style={textDirection}>{t("Password")}</Label>
              {!signUp && <Pressable accessibilityRole="button" accessibilityLabel={t("Forgot password?")} disabled={busy} onPress={() => { setReset(true); setMessage(""); }} style={({ pressed }) => [styles.forgot, { opacity: pressed ? 0.6 : 1 }]}><Label size={10} color={muted}>{t("Forgot password?")}</Label></Pressable>}
            </View>
            <View style={[styles.inputShell, { borderColor: focused === "password" ? "#8DA645" : border, flexDirection: rowDirection }]}>
              <Icon name="lock-closed-outline" size={18} color={muted} />
              <TextInput
                accessibilityLabel={t("Password")}
                style={styles.input}
                placeholder={t("Password")}
                placeholderTextColor="#979C91"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={signUp ? "new-password" : "current-password"}
                secureTextEntry={!show}
                selectionColor="#8DA645"
                editable={!busy && (!signUp || !confirmationPending)}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onSubmitEditing={submit}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={t(show ? "Hide password" : "Show password")} onPress={() => setShow(!show)} style={({ pressed }) => [styles.visibility, { opacity: pressed ? 0.6 : 1 }]}><Icon name={show ? "eye-off-outline" : "eye-outline"} size={19} color={muted} /></Pressable>
            </View>
          </View>}

          {!!message && <View accessibilityRole="alert" style={[styles.message, { backgroundColor: messageTone === "error" ? "#FFF1EE" : "#F0F5E8", flexDirection: rowDirection }]}><Icon name={messageTone === "error" ? "alert-circle-outline" : "information-circle-outline"} size={17} color={messageTone === "error" ? "#A33F32" : "#4B6334"} /><Label size={11} color={messageTone === "error" ? "#A33F32" : "#4B6334"} style={{ ...textDirection, flex: 1 }}>{message}</Label></View>}

          <Pressable accessibilityRole="button" accessibilityLabel={t(reset ? "Reset password" : signUp ? "Create account" : "Sign in")} accessibilityState={{ disabled: busy || (signUp && confirmationPending && !reset), busy }} disabled={busy || (signUp && confirmationPending && !reset)} onPress={submit} style={({ pressed }) => [styles.primary, { flexDirection: rowDirection, opacity: busy || (signUp && confirmationPending && !reset) ? 0.6 : pressed ? 0.75 : 1 }]}><Label bold size={14} color={ink}>{t(reset ? "Reset password" : signUp ? confirmationPending ? "Account created" : "Create account" : "Sign in")}</Label>{busy ? <ActivityIndicator size="small" color={ink} /> : <Icon name={rtl ? "arrow-back" : "arrow-forward"} size={18} color={ink} />}</Pressable>
          {!reset && googleAuthEnabled && <Pressable accessibilityRole="button" accessibilityLabel={t("Continue with Google")} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={google} style={({ pressed }) => [styles.google, { flexDirection: rowDirection, opacity: busy ? 0.5 : pressed ? 0.6 : 1 }]}><Icon name="logo-google" size={17} color={ink} /><Label bold size={12} color={ink} style={{ textAlign: "center", flexShrink: 1 }}>{t("Continue with Google")}</Label></Pressable>}
          {!reset && appleAuthEnabled && Platform.OS !== 'android' && <Pressable accessibilityRole="button" accessibilityLabel={t("Continue with Apple")} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={apple} style={({ pressed }) => [styles.google, styles.apple, { flexDirection: rowDirection, opacity: busy ? 0.5 : pressed ? 0.6 : 1 }]}><Icon name="logo-apple" size={18} color="#FFFFFF" /><Label bold size={12} color="#FFFFFF" style={{ textAlign: "center", flexShrink: 1 }}>{t("Continue with Apple")}</Label></Pressable>}
        </View>

        {confirmationPending && !reset && <View style={styles.formCard}>
          <Label bold size={18} color={ink}>Confirm your email</Label>
          <Label size={12} color={muted}>Enter the confirmation code from your email to verify your account.</Label>
          <TextInput accessibilityLabel="Email confirmation code" placeholder="Confirmation code" placeholderTextColor="#979C91" value={confirmationCode} onChangeText={setConfirmationCode} autoCapitalize="none" autoCorrect={false} autoComplete="one-time-code" keyboardType="number-pad" editable={!busy} style={[styles.input, { borderWidth: 1, borderColor: border, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#FBFBF8' }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Verify email" disabled={busy} onPress={verifyConfirmation} style={[styles.primary, { opacity: busy ? 0.5 : 1 }]}><Label bold color={ink}>Verify email</Label></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Resend confirmation email" disabled={busy} onPress={resendConfirmation} style={[styles.google, { opacity: busy ? 0.5 : 1 }]}><Label bold size={12} color={ink}>Resend confirmation email</Label></Pressable>
        </View>}

        <View style={styles.demoArea}>
          {!authConfigured && <View style={[styles.demoNote, { flexDirection: rowDirection }]}><View style={styles.noteIcon}><Icon name="wallet-outline" size={19} color={lime} /></View><View style={{ flex: 1, gap: 2 }}><Label bold size={13} color={ink} style={textDirection}>$10,000 <Label size={11} color={muted}>{t("Virtual money")}</Label></Label><Label size={10} color={muted} style={textDirection}>{t("Your trading workspace")}</Label></View></View>}
          <Pressable accessibilityRole="button" accessibilityLabel={t("Continue in demo mode")} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => run(startDemo)} style={({ pressed }) => [styles.demo, { flexDirection: rowDirection, opacity: busy ? 0.5 : pressed ? 0.6 : 1 }]}><Label bold size={12} color={ink} style={{ flexShrink: 1, textAlign: "center" }}>{t("Continue in demo mode")}</Label><Icon name={rtl ? "arrow-back" : "arrow-forward"} size={16} color={ink} /></Pressable>
          <View style={[styles.disclaimer, { flexDirection: rowDirection }]}><Icon name="shield-checkmark-outline" size={13} color={muted} /><Label size={9} color={muted} style={{ ...textDirection, flexShrink: 1 }}>{t("Educational app · No real-money trading.")}</Label></View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </ThemeSurface>;
}

const ink = "#0D1011";
const lime = "#C8F169";
const ivory = "#F4F3EF";
const muted = "#71766B";
const border = "#E2E4DC";
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ivory },
  keyboard: { flex: 1 },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", paddingTop: 19, paddingBottom: 28, gap: 23 },
  brandRow: { alignItems: "center", justifyContent: "space-between" },
  brand: { alignItems: "center", gap: 9 },
  brandMark: { width: 32, height: 32, borderRadius: 16, backgroundColor: lime, alignItems: "center", justifyContent: "center", transform: [{ rotate: "45deg" }] },
  hero: { alignItems: "center", gap: 15, paddingTop: 3, paddingBottom: 1 },
  heroMark: { width: 61, height: 69, backgroundColor: ink, borderRadius: 22, alignItems: "center", justifyContent: "center", transform: [{ rotate: "5deg" }] },
  heroDot: { position: "absolute", width: 13, height: 13, borderRadius: 7, right: -3, bottom: 9, backgroundColor: lime, borderWidth: 3, borderColor: ivory },
  formCard: { backgroundColor: "#FFFFFF", borderRadius: 26, borderWidth: 1, borderColor: "#E7E7E0", padding: 18, gap: 17 },
  tabs: { borderRadius: 15, padding: 4, backgroundColor: ivory, alignItems: "center", marginBottom: 1 },
  tab: { flex: 1, minHeight: 43, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, paddingVertical: 8 },
  tabSelected: { backgroundColor: ink },
  back: { alignItems: "center", alignSelf: "flex-start", minHeight: 44, gap: 8, marginTop: -8, marginBottom: -8 },
  field: { gap: 8 },
  fieldHeading: { minHeight: 25, alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: -10 },
  forgot: { minHeight: 44, justifyContent: "center", marginVertical: -8 },
  inputShell: { minHeight: 54, borderWidth: 1, borderRadius: 14, backgroundColor: "#FBFBF8", alignItems: "center", paddingLeft: 13, paddingRight: 9, gap: 10 },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 12, color: ink, fontFamily: fonts.medium, fontSize: 14, writingDirection: "ltr", textAlign: "left" },
  visibility: { minWidth: 40, minHeight: 44, alignItems: "center", justifyContent: "center", marginRight: -6 },
  message: { padding: 12, borderRadius: 12, gap: 8, alignItems: "flex-start" },
  primary: { minHeight: 55, borderRadius: 15, backgroundColor: lime, paddingHorizontal: 20, paddingVertical: 12, gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  google: { minHeight: 51, borderRadius: 15, borderWidth: 1, borderColor: border, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 10, marginTop: -5 },
  apple: { backgroundColor: ink, borderColor: ink },
  demoArea: { gap: 13 },
  demoNote: { gap: 12, alignItems: "center", paddingHorizontal: 4 },
  noteIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: ink, alignItems: "center", justifyContent: "center" },
  demo: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: "#CED2C6", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  disclaimer: { alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 2 },
});
