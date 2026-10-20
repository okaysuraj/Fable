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
  backgroundColor?: string | null;
  status?: UserStatus;
  style?: ViewStyle;
}

export const MonogramAvatar: React.FC<MonogramAvatarProps> = ({
  monogram,
  size = 38,
  backgroundColor,
  status,
  style,
}) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const resolvedBackgroundColor = backgroundColor ?? "#E3EDFC";
  const hex = resolvedBackgroundColor.replace("#", "");
  const luminance = /^[\da-f]{6}$/i.test(hex)
    ? [0, 2, 4]
        .map((offset) => {
          const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, channel, index) =>
            sum + channel * [0.2126, 0.7152, 0.0722][index],
          0,
        )
    : 1;
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
            borderRadius: size / 2,
            backgroundColor: resolvedBackgroundColor,
          },
        ]}
      >
        <Text
          style={[
            styles.monogram,
            {
              fontSize: Math.max(10, Math.floor(size * 0.36)),
              color: luminance < 0.179 ? "#FFFFFF" : "#000000",
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
      borderWidth: 0,
      borderColor: BrutalColors.border,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    monogram: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      letterSpacing: 0.1,
    },
    statusBadge: {
      position: "absolute",
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 10,
    },
  });
