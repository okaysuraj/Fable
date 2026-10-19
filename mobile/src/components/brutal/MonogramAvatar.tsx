/** Use the real profile monogram and status without generating fictional profile details. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Fonts } from "@/constants/theme";
import { UserStatus } from "@/types/chat";

interface MonogramAvatarProps {
  monogram: string;
  size?: number;
  backgroundColor?: string;
  status?: UserStatus;
  style?: ViewStyle;
}

export const MonogramAvatar: React.FC<MonogramAvatarProps> = ({
  monogram,
  size = 38,
  backgroundColor = "#FFD700",
  status,
  style,
}) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const getStatusColor = () => {
    switch (status) {
      case "online":
        return BrutalColors.accentGreen;
      case "in-huddle":
        return BrutalColors.accentPink;
      case "idle":
        return BrutalColors.accentYellow;
      case "offline":
      default:
        return BrutalColors.inkMuted;
    }
  };

  return (
    <View style={[{ width: size, height: size, position: "relative" }, style]}>
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor,
          },
        ]}
      >
        <Text
          style={[
            styles.monogram,
            {
              fontSize: Math.max(10, Math.floor(size * 0.36)),
              color: backgroundColor === "#1A1A1A" ? "#FFFFFF" : "#1A1A1A",
            },
          ]}
        >
          {monogram}
        </Text>
      </View>
      {status && (
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: getStatusColor(),
              width: Math.max(8, Math.floor(size * 0.28)),
              height: Math.max(8, Math.floor(size * 0.28)),
              bottom: -1,
              right: -1,
            },
          ]}
        />
      )}
    </View>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    container: {
      borderWidth: 2.5,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    monogram: {
      fontFamily: Fonts?.mono,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    statusBadge: {
      position: "absolute",
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 2,
    },
  });
