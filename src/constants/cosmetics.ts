
export interface Frame {
  id: string;
  name: string;
  desc: string;
  ring: string;
  glow: string | null;
  price: number;
  proOnly?: boolean;
}

export interface NameEffect {
  id: string;
  name: string;
  desc: string;
  color: string;
  glow: string | null;
  price: number;
}

export const FRAMES: Frame[] = [
  { id: 'aurora', name: 'AURORA', desc: 'Exclusive Pro prism aura', ring: '#00F5D4', glow: '#A855F7', price: 0, proOnly: true },
  { id: 'bronze', name: 'BRONZE', desc: 'A warm bronze edge', ring: '#CD7F32', glow: null, price: 30 },
  { id: 'steel', name: 'STEEL', desc: 'Brushed steel, quietly sharp', ring: '#B8C4D0', glow: null, price: 60 },
  { id: 'gold', name: 'GOLD', desc: 'A shining golden border', ring: '#FFD700', glow: '#FFD700', price: 100 },
  { id: 'neon', name: 'NEON', desc: 'Vivid neon with a live glow', ring: '#22FF6A', glow: '#22FF6A', price: 150 },
  { id: 'galaxy', name: 'GALAXY', desc: 'Deep violet, lit from within', ring: '#B14CFF', glow: '#B14CFF', price: 250 },
  { id: 'mythic', name: 'MYTHIC', desc: 'Molten crimson-gold plasma', ring: '#FF3B6B', glow: '#FFA23B', price: 400 },
  { id: 'galactic', name: 'GALACTIC', desc: 'A living nebula. The rarest frame in IronMind', ring: '#8B5CFF', glow: '#22E1FF', price: 3000 },
];

export const NAME_EFFECTS: NameEffect[] = [
  { id: 'gold', name: 'GOLD', desc: 'Polished gold lettering', color: '#FFD700', glow: null, price: 60 },
  { id: 'crimson', name: 'CRIMSON', desc: 'Deep arterial red', color: '#FF3B6B', glow: null, price: 60 },
  { id: 'ice', name: 'ICE', desc: 'Pale blue with a cold glow', color: '#38BDF8', glow: '#38BDF8', price: 100 },
  { id: 'toxic', name: 'TOXIC', desc: 'Acid green that hums', color: '#22FF6A', glow: '#22FF6A', price: 150 },
  { id: 'void', name: 'VOID', desc: 'Violet pulled out of the dark', color: '#B14CFF', glow: '#B14CFF', price: 200 },
];

export const PRO_WEEK_PRICE = 500;
export const FREE_MAX_DUEL_STAKE = 50;
export const DUEL_STAKES = [0, 50, 100, 250] as const;

export const frameById = (id: string | null | undefined): Frame | null =>
  id ? FRAMES.find((f) => f.id === id) ?? null : null;

export const nameEffectById = (id: string | null | undefined): NameEffect | null =>
  id ? NAME_EFFECTS.find((n) => n.id === id) ?? null : null;

export const glowStyle = (color: string | null) =>
  color
    ? { textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }
    : {};
