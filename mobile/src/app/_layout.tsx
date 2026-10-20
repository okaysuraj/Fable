/** Load the bundled brand/chat face before presenting the native routes. */
import { useEffect } from "react";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BrutalThemeProvider, useBrutalTheme } from "@/hooks/use-brutal-theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    "InstrumentSerif-Regular": require("../../assets/fonts/instrument-serif/InstrumentSerif-Regular.ttf"),
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
  });
  useEffect(() => {
    // A font failure must not leave the application stuck behind its splash screen.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BrutalThemeProvider mode={scheme === "dark" ? "dark" : "light"}>
        <Routes />
      </BrutalThemeProvider>
    </GestureHandlerRootView>
  );
}

function Routes() {
  const colors = useBrutalTheme();
  return (
    <>
      <StatusBar
        barStyle={
          colors.bgPaper === "#FFFFFF" ? "dark-content" : "light-content"
        }
        backgroundColor={colors.bgPaper}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPaper },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
