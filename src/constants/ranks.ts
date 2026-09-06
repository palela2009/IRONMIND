
export interface Rank {
  name: string;
  short: string;
  color: string;
  minLevel: number;
}

export const RANKS: Rank[] = [
  { name: 'TITANIUM MIND', short: 'TITANIUM', color: '#CCFF00', minLevel: 50 },
  { name: 'PLATINUM NERVE', short: 'PLATINUM', color: '#3FD8C8', minLevel: 35 },
  { name: 'OBSIDIAN CORE', short: 'OBSIDIAN', color: '#8B7BEF', minLevel: 20 },
  { name: 'STEEL WILL', short: 'STEEL', color: '#B8C4D0', minLevel: 10 },
  { name: 'IRON FOCUS', short: 'IRON', color: '#9AA0A6', minLevel: 5 },
  { name: 'BRONZE BRAIN', short: 'BRONZE', color: '#CD7F32', minLevel: 1 },
];

export const rankForLevel = (level: number): Rank =>
  RANKS.find((r) => level >= r.minLevel) ?? RANKS[RANKS.length - 1];

export const nextRankAfter = (level: number): Rank | null => {
  const index = RANKS.findIndex((r) => level >= r.minLevel);
  return index > 0 ? RANKS[index - 1] : null;
};

export const PODIUM = [
  { color: '#FFD700', label: '1ST' },
  { color: '#C0C0C0', label: '2ND' },
  { color: '#CD7F32', label: '3RD' },
] as const;
