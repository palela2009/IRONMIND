import { ChallengeItem } from '../types/training';

export interface RejectedChallenge { item: ChallengeItem; reason: string; rejectedAt: number }

export const permanentRejection = (status: number): boolean => status === 400 || status === 422;

export function rejectChallenge<T extends { pending: ChallengeItem[]; rejected?: RejectedChallenge[] }>(snapshot: T, item: ChallengeItem, reason: string): T {
  return {
    ...snapshot,
    pending: snapshot.pending.filter((entry) => entry.id !== item.id),
    rejected: [...(snapshot.rejected ?? []).filter((entry) => entry.item.id !== item.id), { item, reason, rejectedAt: Date.now() }],
  };
}

export function retryRejected<T extends { pending: ChallengeItem[]; rejected?: RejectedChallenge[] }>(snapshot: T): T {
  const pending = new Map(snapshot.pending.map((item) => [item.id, item]));
  for (const { item } of snapshot.rejected ?? []) pending.set(item.id, item);
  return { ...snapshot, rejected: [], pending: [...pending.values()].sort((a, b) => a.timestamp - b.timestamp) };
}
