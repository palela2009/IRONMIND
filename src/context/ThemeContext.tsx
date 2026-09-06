import React, { createContext, useContext, useMemo } from 'react';
import { usePro } from './ProContext';
import { Palette, paletteFor, DEFAULT_PALETTE } from '../theme';

interface ThemeContextValue {
  palette: Palette;
}

const ThemeContext = createContext<ThemeContextValue>({ palette: DEFAULT_PALETTE });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeId, isPro, unlockedThemes } = usePro();

  const palette = useMemo(() => {
    const chosen = paletteFor(themeId);
    const allowed = !chosen.pro || isPro || unlockedThemes.includes(chosen.id);
    return allowed ? chosen : DEFAULT_PALETTE;
  }, [themeId, isPro, unlockedThemes]);

  return <ThemeContext.Provider value={{ palette }}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Palette => useContext(ThemeContext).palette;

export const useThemedStyles = <T,>(factory: (c: Palette) => T): T => {
  const palette = useTheme();
  return useMemo(() => factory(palette), [palette, factory]);
};
