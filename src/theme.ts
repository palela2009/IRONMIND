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
    tagline: 'The original lime on obsidian',
    pro: false,
    bg: '#08090B',
    surface: '#111318',
    surfaceRaised: '#191C23',
    border: '#262A34',
    borderSubtle: '#1B1E26',
    textPrimary: '#F7F8FA',
    textSecondary: '#B2B6C2',
    textTertiary: '#858B99',
    textFaint: '#6B707D',
    accent: '#CCFF00',
    accentMuted: 'rgba(204, 255, 0, 0.14)',
    accentDim: '#88AB00',
    accentContrast: '#070904',
    danger: '#FF4557',
    dangerMuted: 'rgba(255, 69, 87, 0.14)',
  },
  {
    id: 'cyberpunk',
    name: 'CYBERPUNK',
    tagline: 'Neon magenta on deep violet',
    pro: true,
    bg: '#0B0714',
    surface: '#150F20',
    surfaceRaised: '#1F162D',
    border: '#322347',
    borderSubtle: '#231833',
    textPrimary: '#F6F0FF',
    textSecondary: '#BCADD6',
    textTertiary: '#8D7CA8',
    textFaint: '#6E5F8A',
    accent: '#FF2E88',
    accentMuted: 'rgba(255, 46, 136, 0.16)',
    accentDim: '#B52262',
    accentContrast: '#12000A',
    danger: '#FF5263',
    dangerMuted: 'rgba(255, 82, 99, 0.16)',
  },
  {
    id: 'ice',
    name: 'ICE',
    tagline: 'Cold blue on dark slate',
    pro: true,
    bg: '#070B10',
    surface: '#0F1620',
    surfaceRaised: '#16202E',
    border: '#243447',
    borderSubtle: '#192432',
    textPrimary: '#EDF5FC',
    textSecondary: '#A8BCCE',
    textTertiary: '#7B90A6',
    textFaint: '#60748A',
    accent: '#38BDF8',
    accentMuted: 'rgba(56, 189, 248, 0.16)',
    accentDim: '#2482AC',
    accentContrast: '#001019',
    danger: '#FF4D5E',
    dangerMuted: 'rgba(255, 77, 94, 0.16)',
  },
  {
    id: 'blood',
    name: 'BLOOD',
    tagline: 'Crimson on pure black',
    pro: true,
    bg: '#0A0506',
    surface: '#160C0F',
    surfaceRaised: '#201216',
    border: '#381E24',
    borderSubtle: '#261419',
    textPrimary: '#FAF0F1',
    textSecondary: '#C8A8AC',
    textTertiary: '#997A7F',
    textFaint: '#7A5E63',
    accent: '#FF3B3B',
    accentMuted: 'rgba(255, 59, 59, 0.16)',
    accentDim: '#B32929',
    accentContrast: '#150000',
    danger: '#FF8A3B',
    dangerMuted: 'rgba(255, 138, 59, 0.16)',
  },
  {
    id: 'ember',
    name: 'EMBER',
    tagline: 'Molten amber on charcoal',
    pro: true,
    bg: '#0C0906',
    surface: '#181109',
    surfaceRaised: '#23190E',
    border: '#3A2B18',
    borderSubtle: '#291E11',
    textPrimary: '#FCF4EA',
    textSecondary: '#C9B59E',
    textTertiary: '#9A8670',
    textFaint: '#7A6855',
    accent: '#FFA23B',
    accentMuted: 'rgba(255, 162, 59, 0.16)',
    accentDim: '#B56D1B',
    accentContrast: '#1A0C00',
    danger: '#FF4557',
    dangerMuted: 'rgba(255, 69, 87, 0.16)',
  },
  {
    id: 'matrix',
    name: 'MATRIX',
    tagline: 'Terminal green on true black',
    pro: true,
    bg: '#000000',
    surface: '#080E08',
    surfaceRaised: '#0F1A0F',
    border: '#1D321D',
    borderSubtle: '#132113',
    textPrimary: '#E3FFE4',
    textSecondary: '#94C498',
    textTertiary: '#6A976E',
    textFaint: '#4F7753',
    accent: '#22FF6A',
    accentMuted: 'rgba(34, 255, 106, 0.14)',
    accentDim: '#17A646',
    accentContrast: '#001A08',
    danger: '#FF4557',
    dangerMuted: 'rgba(255, 69, 87, 0.16)',
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
  micro: { fontSize: 10, fontWeight: '800' as const, letterSpacing: 0.6 },
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
