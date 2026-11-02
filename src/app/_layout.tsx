import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { useFonts } from 'expo-font';
import { Href, Slot, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../lib/session";
import { ThemeProvider, useTheme } from "../lib/theme";
import { WorkspaceProvider, useWorkspace } from "../lib/workspace";
import { Brand, LoadingState } from "../components/design";
function Guard() {
  const { ready, session, demo, onboarded } = useSession();
  const { loaded } = useWorkspace();
  const { colors } = useTheme();
  const top = useSegments()[0] as string | undefined;
  const router = useRouter();
  useEffect(() => {
    if (!ready || !loaded) return;
    let to: string | null = null;
    if (!onboarded) to = top === "onboarding" ? null : "/onboarding";
    else if (!session && !demo) to = top === "auth" ? null : "/auth";
    else if (["onboarding", "auth", undefined].includes(top)) to = "/practice";
    if (to) router.replace(to as Href);
  }, [ready, loaded, session, demo, onboarded, top, router]);
  if (!ready || !loaded)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Brand large />
        <LoadingState />
      </View>
    );
  return <Slot />;
}
export default function Root() {
  const [fontsLoaded, fontError] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {!fontsLoaded && !fontError ? <FontLoading /> : <SessionProvider>
          <WorkspaceProvider>
            <Guard />
          </WorkspaceProvider>
        </SessionProvider>}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function FontLoading() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.sub} /></View>;
}
