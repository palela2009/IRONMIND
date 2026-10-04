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
  'A friend counts as soon as they add your code within their first week. Each phone counts once, and never your own.';

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

export const inviteMessage = (code: string): string =>
  `Compete with me on IRONMIND and take back your screen time. After you install it, add my code ${code} in the Friends tab: https://play.google.com/store/apps/details?id=com.palelastudio.ironmind`;

export const fetchInviteCode = async (): Promise<string | null> => {
  try {
    const res = await authedFetch(`${API_BASE_URL}/api/friends/code`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.code ?? null;
  } catch {
    return null;
  }
};

export const daysLabel = (days: number): string =>
  days % 30 === 0 ? `${days / 30} ${days === 30 ? 'MONTH' : 'MONTHS'}` : `${days} DAYS`;
