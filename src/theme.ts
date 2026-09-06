export interface Palette {
  id: string;
  name: string;
  tagline: string;
  pro: boolean;

  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  borderSubtle: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textFaint: string;

  accent: string;
  accentMuted: string;
  accentDim: string;
  accentContrast: string;

  danger: string;
  dangerMuted: string;
}

export const PALETTES: Palette[] = [
  {
    id: 'default',
    name: 'IRON',
    tagline: 'The original lime on black',
    pro: false,
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
    accentContrast: '#000000',
    danger: '#FF4557',
    dangerMuted: 'rgba(255, 69, 87, 0.14)',
  },
  {
    id: 'cyberpunk',
    name: 'CYBERPUNK',
    tagline: 'Neon magenta on deep violet',
    pro: true,
    bg: '#0B0714',
    surface: '#16101F',
    surfaceRaised: '#1E1629',
    border: '#2C1F3D',
    borderSubtle: '#221830',
    textPrimary: '#F4EEFF',
    textSecondary: '#A99BC4',
    textTertiary: '#6B5C85',
    textFaint: '#3D3352',
    accent: '#FF2E88',
    accentMuted: 'rgba(255, 46, 136, 0.16)',
    accentDim: '#9E1B54',
    accentContrast: '#12000A',
    danger: '#FF4557',
    dangerMuted: 'rgba(255, 69, 87, 0.16)',
  },
  {
    id: 'ice',
    name: 'ICE',
    tagline: 'Cold blue on slate',
    pro: true,
    bg: '#070B10',
    surface: '#101720',
    surfaceRaised: '#161F2A',
    border: '#1F2C3A',
    borderSubtle: '#18222E',
    textPrimary: '#EAF3FB',
    textSecondary: '#93A6B8',
    textTertiary: '#5A6B7C',
    textFaint: '#334252',
    accent: '#38BDF8',
    accentMuted: 'rgba(56, 189, 248, 0.16)',
    accentDim: '#1D6E92',
    accentContrast: '#001019',
    danger: '#FF4557',
    dangerMuted: 'rgba(255, 69, 87, 0.16)',
  },
  {
    id: 'blood',
    name: 'BLOOD',
    tagline: 'Crimson on pure black',
    pro: true,
    bg: '#0A0506',
    surface: '#160C0F',
    surfaceRaised: '#1E1114',
    border: '#301A1F',
    borderSubtle: '#241317',
    textPrimary: '#F8EEEF',
    textSecondary: '#B7999D',
    textTertiary: '#7A5D62',
    textFaint: '#463034',
    accent: '#FF3B3B',
    accentMuted: 'rgba(255, 59, 59, 0.16)',
    accentDim: '#992323',
    accentContrast: '#150000',
    danger: '#FF8A3B',
    dangerMuted: 'rgba(255, 138, 59, 0.16)',
  },
];

export const DEFAULT_PALETTE = PALETTES[0];

export const paletteFor = (id: string | undefined | null): Palette =>
  PALETTES.find((p) => p.id === id) ?? DEFAULT_PALETTE;

export const colors = DEFAULT_PALETTE;

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

export const glowFor = (palette: Palette) => ({
  shadowColor: palette.accent,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.35,
  shadowRadius: 40,
  elevation: 12,
});

export const glowShadow = glowFor(DEFAULT_PALETTE);
