import React, { useState } from 'react';
import {
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
  StyleSheet,
  Platform,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';

export type BrutalButtonVariant = 'yellow' | 'pink' | 'blue' | 'green' | 'outline' | 'dark';

interface BrutalButtonProps {
  title: string;
  onPress: () => void;
  variant?: BrutalButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const BrutalButton: React.FC<BrutalButtonProps> = ({
  title,
  onPress,
  variant = 'yellow',
  size = 'md',
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const [pressed, setPressed] = useState(false);

  const getBackgroundColor = () => {
    switch (variant) {
      case 'pink':
        return BrutalColors.accentPink;
      case 'blue':
        return BrutalColors.accentBlue;
      case 'green':
        return BrutalColors.accentGreen;
      case 'dark':
        return BrutalColors.ink;
      case 'outline':
        return 'transparent';
      case 'yellow':
      default:
        return BrutalColors.accentYellow;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'pink':
      case 'blue':
      case 'dark':
        return '#FFFFFF';
      case 'green':
      case 'yellow':
      case 'outline':
      default:
        return BrutalColors.ink;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 12 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      case 'md':
      default:
        return { paddingVertical: 12, paddingHorizontal: 18 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 12;
      case 'lg':
        return 16;
      case 'md':
      default:
        return 13;
    }
  };

  const shadowOffset = size === 'sm' ? 2 : 4;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      style={[
        styles.button,
        getPadding(),
        {
          backgroundColor: getBackgroundColor(),
          opacity: disabled ? 0.6 : 1,
          transform: pressed
            ? [{ translateX: shadowOffset - 1 }, { translateY: shadowOffset - 1 }]
            : [{ translateX: 0 }, { translateY: 0 }],
          ...Platform.select({
            web: {
              boxShadow: pressed
                ? 'none'
                : `${shadowOffset}px ${shadowOffset}px 0px ${BrutalColors.border}`,
              cursor: disabled ? 'not-allowed' : 'pointer',
              userSelect: 'none',
              transition: 'all 100ms cubic-bezier(0, 0.95, 0.35, 1)',
            } as any,
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
            color: getTextColor(),
            fontSize: getFontSize(),
          },
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
  },
  text: {
    fontFamily: Fonts?.sans,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
