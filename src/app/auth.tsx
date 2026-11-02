import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, TextInput } from "react-native";
import { Button, Screen, Title } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session";
import { useWorkspace } from "../lib/workspace";
import { Brand, Badge, Label, AppButton } from "../components/design";
import { useTheme } from "../lib/theme";

WebBrowser.maybeCompleteAuthSession();

export default function Auth() {
  const { colors } = useTheme();
  const { startDemo, supabaseConfigured } = useSession();
  const { t } = useWorkspace();
  const [show, setShow] = useState(false);
  const [reset, setReset] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [busy, setBusy] = useState(false);

  // On success the session listener updates and the guard moves us to the app.
  const run = async (fn: () => Promise<void>) => {
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setMessage(e?.message ?? "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () =>
    run(async () => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || (!reset && password.length < 6))
        throw new Error(
          "Enter an email and a password of at least 6 characters.",
        );
      if (reset) {
        if (!supabase) throw new Error("Demo mode does not create an account or send reset emails. Configure Supabase for password recovery.");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) throw error;
        setMessage("If an account exists, check its email for recovery instructions.");
      } else if (signUp) {
        if (!supabase)
          throw new Error(
            "Supabase is not configured. Add its URL and anon key to .env, then restart Expo.",
          );
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.session)
          setMessage("Check your email to confirm your account, then sign in.");
      } else {
        if (!supabase)
          throw new Error(
            "Supabase is not configured. Add its URL and anon key to .env, then restart Expo.",
          );
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    });

  const google = () =>
    run(async () => {
      const redirectTo = makeRedirectUri({
        scheme: "pipwise",
        path: "auth-callback",
      });
      if (!supabase)
        throw new Error(
          "Supabase is not configured. Add its URL and anon key to .env, then restart Expo.",
        );
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url)
        throw error ?? new Error("Google sign-in is not available.");
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== "success") return;
      const p = new URLSearchParams(res.url.split("#")[1] ?? "");
      const access_token = p.get("access_token"),
        refresh_token = p.get("refresh_token");
      if (!access_token || !refresh_token)
        throw new Error("Google sign-in did not finish. Try again.");
      const { error: e2 } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (e2) throw e2;
    });

  const input = {
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  };
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingVertical: 32, maxWidth: 460, width: "100%", alignSelf: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <Brand /><Badge>{supabaseConfigured ? "ACCOUNT ACCESS" : "DEMO AUTHENTICATION"}</Badge><Title>{t(reset ? "Reset password" : signUp ? "Create account" : "Welcome back")}</Title><Label muted>Build confidence, one virtual trade at a time. Demo mode stores your practice on this device and creates no real account.</Label>
        <TextInput
          style={input}
          accessibilityLabel={t("Email address")}
          placeholder={t("Email address")}
          placeholderTextColor={colors.sub}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        {!reset && <TextInput
          accessibilityLabel={t("Password")}
          style={input}
          placeholder={t("Password")}
          placeholderTextColor={colors.sub}
          secureTextEntry={!show}
          value={password}
          onChangeText={setPassword}
        />}
        {!reset && <AppButton label={show ? "Hide password" : "Show password"} variant="ghost" onPress={() => setShow(!show)} />}
        {!!message && <Label color={colors.danger}>{message}</Label>}
        <Button
          label={t(reset ? "Reset password" : signUp ? "Create account" : "Sign in")}
          onPress={submit}
          busy={busy}
        />
        <Button
          label="Continue with Google"
          variant="outline"
          onPress={google}
          disabled={busy}
        />
        <Pressable
          onPress={() => { setSignUp(!signUp); setReset(false); setMessage(""); }}
          style={{ alignItems: "center", padding: 8 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>
            {signUp ? "I already have an account" : "Create a new account"}
          </Text>
        </Pressable>
        <AppButton label={t(reset ? "Back" : "Forgot password?")} variant="ghost" onPress={() => { setReset(!reset); setMessage(""); }} />
        <AppButton label={t("Continue in demo mode")} onPress={() => run(startDemo)} busy={busy} />
        <Label muted size={11}>$10,000 virtual funds · Simulated prices · No deposits or withdrawals</Label>
      </ScrollView>
    </Screen>
  );
}
