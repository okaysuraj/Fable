import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { useBrutalStyles, useBrutalTheme, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { AppIcon, type AppIconName } from "./ui/AppIcon";
import { MotionPressable } from "./ui/MotionPressable";

export type HomeTab = "chats" | "calls" | "people";

export function NavigationIcon({ name, color }: { name: HomeTab | "video"; color: string }) {
  return <AppIcon name={name === "calls" ? "call" : name} color={color} size={25} />;
}

const tabs = [
  { id: "chats", label: "Chats", outline: "chats", filled: "chatsFilled" },
  { id: "calls", label: "Calls", outline: "call", filled: "callFilled" },
  { id: "people", label: "People", outline: "people", filled: "peopleFilled" },
] as const;

function Tab({ label, icon, selected, onPress }: {
  label: string; icon: AppIconName; selected: boolean; onPress: () => void;
}) {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const selection = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    selection.set(withTiming(selected ? 1 : 0, { duration: 180, reduceMotion: ReduceMotion.System }));
  }, [selected, selection]);
  const indicator = useAnimatedStyle(() => ({
    opacity: selection.get(),
    transform: [{ scaleX: 0.82 + selection.get() * 0.18 }],
  }));
  const color = selected ? colors.primary : colors.inkMuted;
  return (
    <MotionPressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tab}
    >
      <View style={styles.iconContainer}>
        <Animated.View pointerEvents="none" style={[styles.selection, indicator]} />
        <AppIcon name={icon} color={color} size={25} />
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </MotionPressable>
  );
}

export function BottomTabs({ activeTab, onSelect }: {
  activeTab: HomeTab; onSelect: (tab: HomeTab) => void;
}) {
  const styles = useBrutalStyles(createStyles);
  return (
    <SafeAreaView edges={["bottom", "left", "right"]} style={styles.surface}>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map((tab) => (
          <Tab key={tab.id} label={tab.label} icon={activeTab === tab.id ? tab.filled : tab.outline}
            selected={activeTab === tab.id} onPress={() => onSelect(tab.id)} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: BrutalPalette) => StyleSheet.create({
  surface: { backgroundColor: colors.bgCard, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tabs: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingTop: 7, paddingBottom: 4 },
  tab: { flex: 1, maxWidth: 180, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 16 },
  iconContainer: { width: 60, height: 31, alignItems: "center", justifyContent: "center" },
  selection: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.selection, borderRadius: 16 },
  label: { fontFamily: Fonts.medium, fontSize: 11, lineHeight: 15 },
});
