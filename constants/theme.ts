import { TextStyle } from 'react-native';

export const Colors = {
  bgPage: '#1A1A1C',
  bgCard: '#242426',
  bgSurface: '#2A2A2C',
  accent: '#8FA67A',
  accentDeep: '#6E8B5E',
  streak: '#C4A46C',
  textPrimary: '#F5F5F0',
  textSecondary: '#6E6E72',
  textTertiary: '#5A5A5E',
  borderPrimary: '#3A3A3E',
  borderDivider: '#262628',
  danger: '#E85D5D',
  bgPageTranslucent: 'rgba(26,26,28,0.6)',
} as const;

export const Fonts = {
  mono: {
    light: 'CommitMono_Light',
    regular: 'CommitMono_Regular',
    medium: 'CommitMono_Medium',
  },
} as const;

export const Typography: Record<string, TextStyle> = {
  displayTitle: { fontFamily: Fonts.mono.light, fontSize: 28, lineHeight: 36, letterSpacing: -1, color: Colors.textPrimary },
  bigNumber: { fontFamily: Fonts.mono.light, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: Colors.textPrimary },
  mediumNumber: { fontFamily: Fonts.mono.light, fontSize: 28, lineHeight: 34, letterSpacing: -1, color: Colors.textPrimary },
  caption: { fontFamily: Fonts.mono.regular, fontSize: 16, lineHeight: 22, color: Colors.textPrimary },
  sectionLabel: { fontFamily: Fonts.mono.regular, fontSize: 10, lineHeight: 14, letterSpacing: 2, color: Colors.textSecondary },
  body: { fontFamily: Fonts.mono.regular, fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
  small: { fontFamily: Fonts.mono.regular, fontSize: 11, lineHeight: 16, color: Colors.textSecondary },
  tiny: { fontFamily: Fonts.mono.regular, fontSize: 10, lineHeight: 14, color: Colors.textSecondary },
};

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const BorderRadius = { none: 0, full: 9999 } as const;
export const Sizes = { shutterOuter: 80, shutterInner: 64, weekDot: 8, navButton: 36 } as const;
