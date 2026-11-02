import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

export type Mode = "system" | "light" | "dark";
const light = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  text: "#0A2540",
  sub: "#5B6B7C",
  primary: "#00E676",
  onPrimary: "#0A2540",
  border: "#E6EBEF",
  danger: "#B3261E",
};
const dark = {
  bg: "#0A2540",
  card: "#12314D",
  text: "#F4F6F8",
  sub: "#9AA9B8",
  primary: "#00E676",
  onPrimary: "#0A2540",
  border: "#2A3745",
  danger: "#F2B8B5",
};
export type Colors = typeof light;

const Ctx = createContext<{
  colors: Colors;
  mode: Mode;
  setMode: (m: Mode) => void;
}>({ colors: light, mode: "system", setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>("light");
  useEffect(() => {
    AsyncStorage.getItem("theme").then((v) => v && setModeState(v as Mode));
  }, []);
  const setMode = (m: Mode) => {
    setModeState(m);
    AsyncStorage.setItem("theme", m);
  };
  const isDark = mode === "system" ? system === "dark" : mode === "dark";
  return (
    <Ctx.Provider value={{ colors: isDark ? dark : light, mode, setMode }}>
      {children}
    </Ctx.Provider>
  );
}
export const useTheme = () => useContext(Ctx);
