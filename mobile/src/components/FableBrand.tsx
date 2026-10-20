/** Shared wordmark uses the locally bundled typeface. */
import { Text, StyleSheet } from "react-native";
import { Fonts } from "@/constants/theme";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";
export function FableBrand() {
  const colors = useBrutalTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.name, { color: colors.ink }]}
    >
      Fable
    </Text>
  );
}
const styles = StyleSheet.create({
  name: {
    fontFamily: Fonts.editorial,
    fontSize: 34,
    fontWeight: "400",
    lineHeight: 38,
    letterSpacing: -1,
  },
});
