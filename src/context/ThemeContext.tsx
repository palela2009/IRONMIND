import React, { createContext, useContext, useMemo } from 'react';
import { usePro } from './ProContext';
import { Palette, paletteFor, DEFAULT_PALETTE } from '../theme';

interface ThemeContextValue {
  palette: Palette;
}

const ThemeContext = createContext<ThemeContextValue>({ palette: DEFAULT_PALETTE });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeId, isPro } = usePro();

  const palette = useMemo(() => {
    const chosen = paletteFor(themeId);
    return chosen.pro && !isPro ? DEFAULT_PALETTE : chosen;
  }, [themeId, isPro]);

  return <ThemeContext.Provider value={{ palette }}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Palette => useContext(ThemeContext).palette;

export const useThemedStyles = <T,>(factory: (c: Palette) => T): T => {
  const palette = useTheme();
  return useMemo(() => factory(palette), [palette, factory]);
};
