import { TextStyle } from 'react-native';

export const Colors = {
  bgPage: '#1A1A1C',
  bgCard: '#242426',
  bgSurface: '#2A2A2C',
  accent: '#8FA67A',
  accentDeep: '#6E8B5E',
  accentSage: '#6E9E6E',
  textPrimary: '#F5F5F0',
  textSecondary: '#6E6E70',
  textTertiary: '#4A4A4C',
  borderPrimary: '#3A3A3C',
  borderDivider: '#242426',
} as const;

export const Fonts = {
  mono: {
    light: 'JetBrainsMono_300Light',
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
  },
} as const;

export const Typography: Record<string, TextStyle> = {
  displayTitle: { fontFamily: Fonts.mono.light, fontSize: 28, lineHeight: 36, letterSpacing: -1, color: Colors.textPrimary },
  bigNumber: { fontFamily: Fonts.mono.light, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: Colors.textPrimary },
  mediumNumber: { fontFamily: Fonts.mono.light, fontSize: 28, lineHeight: 34, letterSpacing: -1, color: Colors.textPrimary },
  caption: { fontFamily: Fonts.mono.regular, fontSize: 16, lineHeight: 22, color: Colors.textPrimary },
  profileName: { fontFamily: Fonts.mono.regular, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: Colors.textPrimary },
  sectionLabel: { fontFamily: Fonts.mono.regular, fontSize: 10, lineHeight: 14, letterSpacing: 2, color: Colors.textSecondary },
  body: { fontFamily: Fonts.mono.regular, fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
  small: { fontFamily: Fonts.mono.regular, fontSize: 11, lineHeight: 16, color: Colors.textSecondary },
  tiny: { fontFamily: Fonts.mono.regular, fontSize: 10, lineHeight: 14, color: Colors.textSecondary },
  tabLabel: { fontFamily: Fonts.mono.regular, fontSize: 9, lineHeight: 12, letterSpacing: 1, color: Colors.textSecondary },
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const BorderRadius = { card: 0, pill: 0, circle: 0, tabBar: 34, full: 9999 } as const;
export const Sizes = { tabBarHeight: 48, tabBarPadding: 4, shutterOuter: 80, shutterInner: 64, circleButton: 48, avatar: 80, notifButton: 36, weekDot: 8, navButton: 36 } as const;
