/** A presentation-only surface using the active palette and platform shadow support. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React from "react";
import { View, ViewStyle, StyleProp, StyleSheet, Platform } from "react-native";

interface BrutalCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  alt?: boolean;
  accentColor?: string;
  shadowSize?: "sm" | "md" | "lg";
}

export const BrutalCard: React.FC<BrutalCardProps> = ({
  children,
  style,
  alt = false,
  accentColor,
  shadowSize = "md",
}) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const shadowOffset = shadowSize === "sm" ? 2 : shadowSize === "lg" ? 6 : 4;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor:
            accentColor || (alt ? BrutalColors.bgCardAlt : BrutalColors.bgCard),
          ...Platform.select({
            web: {
              boxShadow: `0px ${shadowOffset}px ${shadowOffset * 4}px rgba(25, 45, 32, 0.04)`,
            },
            default: {
              shadowColor: "#192D20",
              shadowOffset: { width: 0, height: shadowOffset },
              shadowOpacity: 0.04,
              shadowRadius: shadowOffset * 3,
              elevation: 1,
            },
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 16,
      padding: 20,
    },
  });
