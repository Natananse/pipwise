import { Href, Slot, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../lib/session";
import { ThemeProvider } from "../lib/theme";
import { WorkspaceProvider, useWorkspace } from "../lib/workspace";
import { Brand, LoadingState } from "../components/design";
function Guard() {
  const { ready, session, demo, onboarded } = useSession();
  const { loaded } = useWorkspace();
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
          backgroundColor: "#FFF",
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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SessionProvider>
          <WorkspaceProvider>
            <Guard />
          </WorkspaceProvider>
        </SessionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
