// Visual definitions only. Prices are decided by the server; these ids must match the
// server's price tables, and anything the server does not know about simply cannot be bought.

export interface Frame {
  id: string;
  name: string;
  desc: string;
  ring: string;
  glow: string | null;
  price: number;
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
  { id: 'bronze', name: 'BRONZE', desc: 'A warm bronze edge', ring: '#CD7F32', glow: null, price: 150 },
  { id: 'steel', name: 'STEEL', desc: 'Brushed steel, quietly sharp', ring: '#B8C4D0', glow: null, price: 250 },
  { id: 'gold', name: 'GOLD', desc: 'A shining golden border', ring: '#FFD700', glow: '#FFD700', price: 400 },
  { id: 'neon', name: 'NEON', desc: 'Vivid neon with a live glow', ring: '#22FF6A', glow: '#22FF6A', price: 600 },
  { id: 'galaxy', name: 'GALAXY', desc: 'Deep violet, lit from within', ring: '#B14CFF', glow: '#B14CFF', price: 900 },
  { id: 'mythic', name: 'MYTHIC', desc: 'Molten crimson-gold plasma', ring: '#FF3B6B', glow: '#FFA23B', price: 1500 },
];

export const NAME_EFFECTS: NameEffect[] = [
  { id: 'gold', name: 'GOLD', desc: 'Polished gold lettering', color: '#FFD700', glow: null, price: 300 },
  { id: 'crimson', name: 'CRIMSON', desc: 'Deep arterial red', color: '#FF3B6B', glow: null, price: 300 },
  { id: 'ice', name: 'ICE', desc: 'Pale blue with a cold glow', color: '#38BDF8', glow: '#38BDF8', price: 400 },
  { id: 'toxic', name: 'TOXIC', desc: 'Acid green that hums', color: '#22FF6A', glow: '#22FF6A', price: 500 },
  { id: 'void', name: 'VOID', desc: 'Violet pulled out of the dark', color: '#B14CFF', glow: '#B14CFF', price: 700 },
];

export const PRO_WEEK_PRICE = 2000;

export const frameById = (id: string | null | undefined): Frame | null =>
  id ? FRAMES.find((f) => f.id === id) ?? null : null;

export const nameEffectById = (id: string | null | undefined): NameEffect | null =>
  id ? NAME_EFFECTS.find((n) => n.id === id) ?? null : null;

// Glow is expressed through shadow props, which React Native supports on both text and views.
// A gradient would need a native dependency; a coloured glow gets most of the effect for none
// of the build cost.
export const glowStyle = (color: string | null) =>
  color
    ? { textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }
    : {};
