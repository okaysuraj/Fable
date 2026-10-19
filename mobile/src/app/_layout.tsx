/** Configure native routing and release the splash screen after the root layout mounts. */
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "react-native";
import { BrutalColors } from "@/constants/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={BrutalColors.bgPaper}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BrutalColors.bgPaper },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
