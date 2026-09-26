import React, { useState } from 'react';
import {
  TextInput,
  TextInputProps,
  StyleSheet,
  StyleProp,
  TextStyle,
  Platform,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';

interface BrutalInputProps extends TextInputProps {
  style?: StyleProp<TextStyle>;
}

export const BrutalInput: React.FC<BrutalInputProps> = ({ style, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={BrutalColors.inkMuted}
      onFocus={(e) => {
        setIsFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        (Platform.select({
          web: {
            boxShadow: isFocused ? `3px 3px 0px ${BrutalColors.border}` : 'none',
            outlineStyle: 'none',
          },
          default: {
            shadowColor: BrutalColors.border,
            shadowOffset: isFocused ? { width: 3, height: 3 } : { width: 0, height: 0 },
            shadowOpacity: isFocused ? 1 : 0,
            shadowRadius: 0,
            elevation: isFocused ? 3 : 0,
          },
        }) as any),
        style,
      ]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    backgroundColor: BrutalColors.bgInput,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: Fonts?.sans,
    fontSize: 15,
    fontWeight: '600',
    color: BrutalColors.ink,
  },
});
