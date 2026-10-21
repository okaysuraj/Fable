import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { AudioRoute } from "react-native-callkeep";
import type { MediaStream } from "react-native-webrtc";
import { nativeAudioRoute, nativeAudioRoutes } from "@/services/nativeCalls";
import { useBrutalStyles, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import { useReducedMotion } from "react-native-reanimated";
import { AppIcon } from "../ui/AppIcon";
import { MotionPressable } from "../ui/MotionPressable";

export function CallAudioOutput({ nativeId }: { nativeId?: string }) {
  const styles = useBrutalStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const [routes, setRoutes] = useState<AudioRoute[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async () => {
    if (!nativeId || busy) return;
    setError("");
    setRoutes([]);
    setBusy(true);
    try {
      setRoutes(await nativeAudioRoutes());
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Couldn't load audio outputs.",
      );
    } finally {
      setBusy(false);
    }
  };
  const choose = async (route: AudioRoute) => {
    if (!nativeId || busy) return;
    setBusy(true);
    setError("");
    try {
      await nativeAudioRoute(nativeId, route.name);
      setRoutes(null);
    } catch {
      setError("Couldn't change the audio output. Try another device.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Choose call audio output"
        disabled={!nativeId || busy}
        onPress={() => void open()}
        style={[styles.control, !nativeId && styles.disabled]}
      >
        <AppIcon name="speaker" size={25} />
        <Text style={styles.label}>Audio</Text>
      </MotionPressable>
      <Modal
        visible={routes !== null}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => {
          if (!busy) setRoutes(null);
        }}
      >
        <View style={styles.scrim}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <Text accessibilityRole="header" style={styles.heading}>
              Audio output
            </Text>
            <ScrollView>
              {routes?.map((route) => (
                <MotionPressable
                  key={`${route.type}:${route.name}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: route.selected,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => void choose(route)}
                  style={styles.route}
                >
                  <Text style={styles.routeText}>{route.name}</Text>
                  {route.selected && <AppIcon name="check" size={22} />}
                </MotionPressable>
              ))}
            </ScrollView>
            {busy && <ActivityIndicator />}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <MotionPressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => setRoutes(null)}
              style={styles.route}
            >
              <Text style={styles.routeText}>Close</Text>
            </MotionPressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function CallSwitchCamera({
  stream,
  onSwitched,
}: {
  stream: MediaStream;
  onSwitched: () => void;
}) {
  const styles = useBrutalStyles(createStyles);
  const [busy, setBusy] = useState(false);
  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel="Switch front or rear camera"
      accessibilityState={{ busy }}
      disabled={busy}
      style={styles.control}
      onPress={() => {
        if (busy) return;
        setBusy(true);
        void import("react-native-webrtc")
          .then(async (rtc) => {
            const devices = await rtc.mediaDevices.enumerateDevices();
            if (
              !Array.isArray(devices) ||
              devices.filter(
                (device: unknown) =>
                  device !== null &&
                  typeof device === "object" &&
                  "kind" in device &&
                  device.kind === "videoinput",
              ).length < 2
            )
              throw new Error("This device has only one available camera.");
            const track = stream.getVideoTracks()[0];
            if (!track || track.readyState !== "live") return;
            track._switchCamera();
            onSwitched();
          })
          .catch((failure: unknown) =>
            Alert.alert(
              "Camera",
              failure instanceof Error
                ? failure.message
                : "Couldn't switch cameras.",
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      {busy ? <ActivityIndicator /> : <AppIcon name="cameraFlip" size={25} />}
      <Text style={styles.label}>Flip</Text>
    </MotionPressable>
  );
}

const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    control: {
      minHeight: 64,
      minWidth: 68,
      padding: 12,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      backgroundColor: colors.bgCardAlt,
    },
    disabled: { opacity: 0.4 },
    label: { fontFamily: Fonts.medium, color: colors.ink, fontSize: 12 },
    scrim: {
      flex: 1,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      width: "100%",
      maxWidth: 420,
      maxHeight: "75%",
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.bgCard,
      gap: 12,
    },
    heading: { color: colors.ink, fontFamily: Fonts.medium, fontSize: 20 },
    route: {
      minHeight: 52,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    routeText: {
      flexShrink: 1,
      color: colors.ink,
      fontFamily: Fonts.sans,
      fontSize: 16,
    },
    error: { color: colors.accentPink, fontFamily: Fonts.sans, fontSize: 14 },
  });
