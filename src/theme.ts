
export const colors = {
  bg: '#08090B',
  surface: '#131418',
  surfaceRaised: '#191B20',
  border: '#212328',
  borderSubtle: '#1A1B1F',

  textPrimary: '#F5F6F7',
  textSecondary: '#9A9DA5',
  textTertiary: '#5A5D64',
  textFaint: '#35373C',

  accent: '#CCFF00',
  accentMuted: 'rgba(204, 255, 0, 0.14)',
  accentDim: '#7A9900',

  danger: '#FF4557',
  dangerMuted: 'rgba(255, 69, 87, 0.14)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };

export const type = {
  display: { fontSize: 96, fontWeight: '900' as const, letterSpacing: -4 },
  h1: { fontSize: 24, fontWeight: '900' as const, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: '800' as const, letterSpacing: -0.2 },
  h3: { fontSize: 14, fontWeight: '800' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  label: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.8 },
  micro: { fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.6 },
};

export const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.45,
  shadowRadius: 24,
  elevation: 8,
};

export const glowShadow = {
  shadowColor: colors.accent,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 40,
  elevation: 12,
};
