export interface UsageEntry { app: string; minutes: number }

export const totalUsageMinutes = (apps: UsageEntry[]): number => apps.reduce(
  (sum, entry) => sum + (Number.isFinite(entry.minutes) && entry.minutes > 0 ? entry.minutes : 0), 0
);

export const trackedUsageMinutes = (apps: UsageEntry[], tracked: string[]): number => totalUsageMinutes(
  apps.filter((entry) => tracked.includes(entry.app))
);
