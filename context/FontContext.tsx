import React, { createContext, useContext, useMemo } from 'react';
import { TextStyle } from 'react-native';
import { Colors } from '@/constants/theme';

export type FontFamilyKey = 'jetbrains' | 'commitmono';

const FONT_MAP: Record<FontFamilyKey, { light: string; regular: string; medium: string }> = {
  jetbrains: {
    light: 'JetBrainsMono_300Light',
    regular: 'JetBrainsMono_400Regular',
    medium: 'JetBrainsMono_500Medium',
  },
  commitmono: {
    light: 'CommitMono_Light',
    regular: 'CommitMono_Regular',
    medium: 'CommitMono_Medium',
  },
};

interface FontContextValue {
  fonts: { light: string; regular: string; medium: string };
  typography: Record<string, TextStyle>;
}

const FontContext = createContext<FontContextValue | null>(null);

export function FontProvider({
  fontFamily,
  children,
}: {
  fontFamily: FontFamilyKey;
  children: React.ReactNode;
}) {
  const value = useMemo(() => {
    const fonts = FONT_MAP[fontFamily];
    const typography: Record<string, TextStyle> = {
      displayTitle: { fontFamily: fonts.light, fontSize: 28, lineHeight: 36, letterSpacing: -1, color: Colors.textPrimary },
      bigNumber: { fontFamily: fonts.light, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: Colors.textPrimary },
      mediumNumber: { fontFamily: fonts.light, fontSize: 28, lineHeight: 34, letterSpacing: -1, color: Colors.textPrimary },
      caption: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: Colors.textPrimary },
      sectionLabel: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, letterSpacing: 2, color: Colors.textSecondary },
      body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: Colors.textPrimary },
      small: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: Colors.textSecondary },
      tiny: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: Colors.textSecondary },
    };
    return { fonts, typography };
  }, [fontFamily]);

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

export function useFont() {
  const ctx = useContext(FontContext);
  if (!ctx) throw new Error('useFont must be used within FontProvider');
  return ctx;
}
