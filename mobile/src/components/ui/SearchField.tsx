import { useState, type Ref } from "react";
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { Fonts } from "@/constants/theme";
import { useBrutalTheme, useBrutalStyles, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { AppIcon } from "./AppIcon";
import { MotionPressable } from "./MotionPressable";

export function SearchField({ value, onChangeText, style, inputRef, ...props }: Omit<TextInputProps, "style" | "value" | "onChangeText"> & {
  value: string; onChangeText: (value: string) => void; style?: StyleProp<ViewStyle>; inputRef?: Ref<TextInput>;
}) {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, style, focused && { borderColor: colors.primary }]}>
      <AppIcon name="search" size={19} color={colors.inkMuted} />
      <TextInput {...props} ref={inputRef} value={value} onChangeText={onChangeText}
        placeholderTextColor={colors.inkMuted} selectionColor={colors.primary}
        style={styles.input} returnKeyType="search" autoCorrect={false} autoCapitalize="none"
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} />
      {value.length > 0 && (
        <MotionPressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText("")} style={styles.clear}>
          <AppIcon name="close" size={19} color={colors.inkMuted} />
        </MotionPressable>
      )}
    </View>
  );
}

const createStyles = (colors: BrutalPalette) => StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCardAlt, borderWidth: 1, borderColor: "transparent", borderRadius: 13, minHeight: 46, paddingLeft: 13, paddingRight: 4, gap: 8 },
  input: { flex: 1, minWidth: 0, fontFamily: Fonts.sans, fontSize: 16, color: colors.ink, paddingVertical: 10, paddingRight: 8 },
  clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
