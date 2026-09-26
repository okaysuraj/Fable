import { Platform, ViewStyle, TextStyle } from 'react-native';

export const BrutalColors = {
  // Neo-Brutalism Paper Palette
  bgPaper: '#F5F0E8',
  bgCard: '#FFFFFF',
  bgCardAlt: '#FFF8E7',
  bgSidebar: '#FFFDF7',
  bgInput: '#FFFFFF',

  ink: '#1A1A1A',
  inkSecondary: '#4A4A4A',
  inkMuted: '#8A8A8A',
  inkFaint: '#D4CEBF',

  border: '#1A1A1A',

  accentYellow: '#FFD700',
  accentPink: '#FF3366',
  accentBlue: '#4169E1',
  accentGreen: '#00C853',
  accentOrange: '#FF6B35',
  accentPurple: '#7C3AED',
} as const;

export const Colors = {
  light: {
    text: BrutalColors.ink,
    background: BrutalColors.bgPaper,
    backgroundElement: BrutalColors.bgCardAlt,
    backgroundSelected: BrutalColors.accentYellow,
    textSecondary: BrutalColors.inkSecondary,
  },
  dark: {
    text: BrutalColors.ink,
    background: BrutalColors.bgPaper,
    backgroundElement: BrutalColors.bgCardAlt,
    backgroundSelected: BrutalColors.accentYellow,
    textSecondary: BrutalColors.inkSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Fonts = Platform.select({
  ios: {
    sans: 'System',
    mono: 'Courier',
    display: 'System',
  },
  android: {
    sans: 'sans-serif',
    mono: 'monospace',
    display: 'sans-serif-medium',
  },
  default: {
    sans: 'System',
    mono: 'monospace',
    display: 'System',
  },
  web: {
    sans: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'Space Mono', 'Courier New', monospace",
    display: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
  },
});

export const BrutalStyles = {
  card: {
    backgroundColor: BrutalColors.bgCard,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '4px 4px 0px #1A1A1A',
      },
      default: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 5,
      },
    }),
  } as ViewStyle,

  cardSm: {
    backgroundColor: BrutalColors.bgCard,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '2px 2px 0px #1A1A1A',
      },
      default: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 3,
      },
    }),
  } as ViewStyle,

  cardAlt: {
    backgroundColor: BrutalColors.bgCardAlt,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '4px 4px 0px #1A1A1A',
      },
      default: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 5,
      },
    }),
  } as ViewStyle,

  btnYellow: {
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '4px 4px 0px #1A1A1A',
      },
      default: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 4,
      },
    }),
  } as ViewStyle,

  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '4px 4px 0px #1A1A1A',
      },
      default: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 4,
      },
    }),
  } as ViewStyle,

  btnText: {
    fontFamily: Fonts?.sans,
    fontWeight: '800' as TextStyle['fontWeight'],
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as TextStyle['textTransform'],
    color: BrutalColors.ink,
  } as TextStyle,

  input: {
    backgroundColor: BrutalColors.bgInput,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: Fonts?.sans,
    fontSize: 15,
    fontWeight: '600' as TextStyle['fontWeight'],
    color: BrutalColors.ink,
  } as TextStyle,

  tag: {
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  } as ViewStyle,

  tagText: {
    fontFamily: Fonts?.mono,
    fontWeight: '800' as TextStyle['fontWeight'],
    fontSize: 10,
    textTransform: 'uppercase' as TextStyle['textTransform'],
    letterSpacing: 0.8,
    color: BrutalColors.ink,
  } as TextStyle,
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
