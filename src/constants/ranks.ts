// Iron Ranks — a named tier derived from level, shown next to a user's name instead of
// a bare "LV 12". A number says how far you've come; a name says what you've become, which
// is what makes a rank worth screenshotting and comparing against a friend's.
//
// Tier widths grow as levels climb (4 → 5 → 10 → 15 → 15 → open-ended) so early promotions
// land fast enough to hook a new user, while TITANIUM stays rare enough to mean something.

export interface Rank {
  name: string;
  short: string;
  color: string;
  minLevel: number;
}

// Ordered high → low so lookup can return the first tier the level clears.
export const RANKS: Rank[] = [
  { name: 'TITANIUM MIND', short: 'TITANIUM', color: '#CCFF00', minLevel: 50 },
  { name: 'PLATINUM NERVE', short: 'PLATINUM', color: '#3FD8C8', minLevel: 35 },
  { name: 'OBSIDIAN CORE', short: 'OBSIDIAN', color: '#8B7BEF', minLevel: 20 },
  { name: 'STEEL WILL', short: 'STEEL', color: '#B8C4D0', minLevel: 10 },
  { name: 'IRON FOCUS', short: 'IRON', color: '#9AA0A6', minLevel: 5 },
  { name: 'BRONZE BRAIN', short: 'BRONZE', color: '#CD7F32', minLevel: 1 },
];

export const rankForLevel = (level: number): Rank =>
  // Guaranteed to match: the last tier starts at level 1, and levels are never below 1.
  RANKS.find((r) => level >= r.minLevel) ?? RANKS[RANKS.length - 1];

// The tier above the current one, or null at max rank — lets the UI show "next: STEEL WILL"
// without the caller needing to know how the ladder is ordered.
export const nextRankAfter = (level: number): Rank | null => {
  const index = RANKS.findIndex((r) => level >= r.minLevel);
  return index > 0 ? RANKS[index - 1] : null;
};

// Podium metals for the top 3 of the leaderboard. Deliberately separate from RANKS: a
// podium place is about standing relative to your friends right now, while a rank is about
// your own absolute progress — a BRONZE BRAIN can still take gold in a small group.
export const PODIUM = [
  { color: '#FFD700', label: '1ST' },
  { color: '#C0C0C0', label: '2ND' },
  { color: '#CD7F32', label: '3RD' },
] as const;
