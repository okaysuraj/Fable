/** Accessible touch controls use semantic colors and quiet press feedback. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React from "react";
import { Text, ViewStyle, TextStyle, StyleSheet, Platform } from "react-native";
import { Fonts } from "@/constants/theme";
import { MotionPressable } from "../ui/MotionPressable";

export type BrutalButtonVariant =
  "yellow" | "pink" | "blue" | "green" | "outline" | "dark";
interface BrutalButtonProps {
  title: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: BrutalButtonVariant;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}
export const BrutalButton: React.FC<BrutalButtonProps> = ({
  title,
  accessibilityLabel,
  onPress,
  variant = "yellow",
  size = "md",
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const backgrounds = {
    yellow: colors.primary,
    pink: colors.dangerButton,
    blue: colors.accentBlue,
    green: colors.selection,
    dark: colors.ink,
    outline: "transparent",
  };
  const foregrounds = {
    yellow: colors.onPrimary,
    pink: "#FFFFFF",
    blue: colors.onPrimary,
    green: colors.selectionInk,
    dark: colors.bgCard,
    outline: colors.inkSecondary,
  };
  const sizes = {
    sm: { paddingVertical: 9, paddingHorizontal: 13, fontSize: 13 },
    md: { paddingVertical: 12, paddingHorizontal: 18, fontSize: 14 },
    lg: { paddingVertical: 15, paddingHorizontal: 22, fontSize: 15 },
  };
  const { fontSize, ...padding } = sizes[size];
  return (
    <MotionPressable
      accessibilityLabel={accessibilityLabel || title}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        padding,
        {
          backgroundColor:
            pressed && variant === "outline"
              ? colors.bgCardAlt
              : pressed && variant === "yellow"
                ? colors.primaryHover
                : backgrounds[variant],
          borderColor: variant === "outline" ? colors.border : "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text
        numberOfLines={2}
        style={[
          styles.text,
          { color: foregrounds[variant], fontSize },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </MotionPressable>
  );
};
const createStyles = (_colors: BrutalPalette) =>
  StyleSheet.create({
    button: {
      minHeight: Platform.OS === "android" ? 48 : 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderRadius: 14,
    },
    text: {
      flexShrink: 1,
      textAlign: "center",
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      lineHeight: 21,
    },
  });
