import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet, Platform } from 'react-native';
import { BrutalColors } from '@/constants/theme';

interface BrutalCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  alt?: boolean;
  accentColor?: string;
  shadowSize?: 'sm' | 'md' | 'lg';
}

export const BrutalCard: React.FC<BrutalCardProps> = ({
  children,
  style,
  alt = false,
  accentColor,
  shadowSize = 'md',
}) => {
  const shadowOffset = shadowSize === 'sm' ? 2 : shadowSize === 'lg' ? 6 : 4;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accentColor || (alt ? BrutalColors.bgCardAlt : BrutalColors.bgCard),
          ...Platform.select({
            web: {
              boxShadow: `${shadowOffset}px ${shadowOffset}px 0px ${BrutalColors.border}`,
            },
            default: {
              shadowColor: BrutalColors.border,
              shadowOffset: { width: shadowOffset, height: shadowOffset },
              shadowOpacity: 1,
              shadowRadius: 0,
              elevation: shadowOffset + 1,
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

const styles = StyleSheet.create({
  card: {
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    padding: 16,
  },
});
