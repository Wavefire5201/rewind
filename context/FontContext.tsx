import React, { createContext, useContext } from 'react';
import { TextStyle } from 'react-native';
import { Fonts, Typography } from '@/constants/theme';

interface FontContextValue {
  fonts: { light: string; regular: string; medium: string };
  typography: Record<string, TextStyle>;
}

const FontContext = createContext<FontContextValue | null>(null);

const CONTEXT_VALUE: FontContextValue = { fonts: Fonts.mono, typography: Typography };

export function FontProvider({ children }: { children: React.ReactNode }) {
  return <FontContext.Provider value={CONTEXT_VALUE}>{children}</FontContext.Provider>;
}

export function useFont() {
  const ctx = useContext(FontContext);
  if (!ctx) throw new Error('useFont must be used within FontProvider');
  return ctx;
}
