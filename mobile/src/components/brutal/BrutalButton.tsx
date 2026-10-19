/** Shared native button sizes, palette variants and reduced-motion press feedback. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React from "react";
import {
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
  StyleSheet,
  Platform,
} from "react-native";
import { Fonts } from "@/constants/theme";
import { useReducedMotion } from "react-native-reanimated";

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
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const reduceMotion = useReducedMotion();

  const backgroundColors = {
    yellow: BrutalColors.accentYellow,
    pink: BrutalColors.accentPink,
    blue: BrutalColors.accentBlue,
    green: BrutalColors.accentGreen,
    dark: "#1A1A1A",
    outline: "transparent",
  };
  const textColors = {
    yellow: "#1A1A1A",
    pink: "#FFFFFF",
    blue: "#FFFFFF",
    green: "#1A1A1A",
    dark: "#FFFFFF",
    outline: BrutalColors.ink,
  };
  const sizes = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 12 },
    md: { paddingVertical: 12, paddingHorizontal: 18, fontSize: 13 },
    lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 16 },
  };
  const { fontSize, ...padding } = sizes[size];

  const shadowOffset = size === "sm" ? 2 : 4;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || title}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        padding,
        {
          backgroundColor: backgroundColors[variant],
          opacity: disabled ? 0.6 : 1,
          transform:
            pressed && !reduceMotion
              ? [
                  { translateX: shadowOffset - 1 },
                  { translateY: shadowOffset - 1 },
                ]
              : [{ translateX: 0 }, { translateY: 0 }],
          ...Platform.select<
            ViewStyle & { transition?: string; userSelect?: "none" }
          >({
            web: {
              boxShadow: pressed
                ? "none"
                : `${shadowOffset}px ${shadowOffset}px 0px ${BrutalColors.border}`,
              cursor: disabled ? "auto" : "pointer",
              userSelect: "none",
              transition: reduceMotion
                ? "none"
                : "transform 100ms cubic-bezier(0, 0.95, 0.35, 1)",
            },
            default: {
              shadowColor: BrutalColors.border,
              shadowOffset: pressed
                ? { width: 0, height: 0 }
                : { width: shadowOffset, height: shadowOffset },
              shadowOpacity: pressed ? 0 : 1,
              shadowRadius: 0,
              elevation: pressed ? 0 : shadowOffset + 1,
            },
          }),
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.text,
          {
            color: textColors[variant],
            fontSize: fontSize,
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    button: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 3,
      borderColor: BrutalColors.border,
      borderRadius: 4,
    },
    text: {
      fontFamily: Fonts?.sans,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
  });
