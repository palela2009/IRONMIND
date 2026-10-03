import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';

export interface InviteMilestone {
  at: number;
  days: number;
}

export interface InviteProgress {
  joined: number;
  active: number;
  next: InviteMilestone | null;
  milestones: InviteMilestone[];
  rewarded: number[];
}

export const INVITE_RULES =
  'A friend counts once they add your code within their first week and complete 3 challenges on 2 different days.';

export const useInvites = () => {
  const [progress, setProgress] = useState<InviteProgress | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authedFetch(`${API_BASE_URL}/api/friends/invites`);
      if (res.ok) setProgress(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { progress, refresh };
};

export const daysLabel = (days: number): string =>
  days % 30 === 0 ? `${days / 30} ${days === 30 ? 'MONTH' : 'MONTHS'}` : `${days} DAYS`;
