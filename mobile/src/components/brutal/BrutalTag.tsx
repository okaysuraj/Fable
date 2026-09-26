import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';

interface BrutalTagProps {
  label: string;
  color?: string;
  dotColor?: string;
  style?: ViewStyle;
}

export const BrutalTag: React.FC<BrutalTagProps> = ({
  label,
  color = BrutalColors.accentYellow,
  dotColor,
  style,
}) => {
  return (
    <View style={[styles.tag, { backgroundColor: color }, style]}>
      {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.ink,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
