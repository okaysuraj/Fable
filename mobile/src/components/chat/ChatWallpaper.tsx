import { StyleSheet, View } from "react-native";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";
import { AppIcon, type AppIconName } from "../ui/AppIcon";

const motifs: AppIconName[] = [
  "chats",
  "leaf",
  "camera",
  "emoji",
  "call",
  "attach",
];
/** Quiet vector motifs stay behind the scroll surface and never intercept a gesture. */
export function ChatWallpaper() {
  const colors = useBrutalTheme();
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.chatBackground, overflow: "hidden" },
      ]}
    >
      {Array.from({ length: 30 }, (_, index) => (
        <View
          key={index}
          style={{
            position: "absolute",
            left: `${(index % 5) * 23 - 4}%`,
            top: `${Math.floor(index / 5) * 19 + (index % 2 ? 6 : 0)}%`,
            opacity: 0.045,
            transform: [{ rotate: `${index % 2 ? 18 : -22}deg` }],
          }}
        >
          <AppIcon
            name={motifs[index % motifs.length]}
            size={39}
            color={colors.chatInk}
          />
        </View>
      ))}
    </View>
  );
}
