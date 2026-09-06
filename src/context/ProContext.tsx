import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { ProPlanId } from '../constants/pro';

const API_URL = `${API_BASE_URL}/api/pro`;
const COINS_URL = `${API_BASE_URL}/api/coins`;
const CACHE_KEY = '@ironmind_pro_v1';

export interface Entitlement {
  isPro: boolean;
  isOwner: boolean;
  welcomeOffer: boolean;
  coins: number;
  unlockedThemes: string[];
  onTrial: boolean;
  trialEndsAt: string | null;
  trialAvailable: boolean;
  plan: ProPlanId | null;
  expiresAt: string | null;
  streakFreezes: number;
  themeId: string;
}

const FREE: Entitlement = { isPro: false, isOwner: false, welcomeOffer: false, coins: 0, unlockedThemes: [], onTrial: false, trialEndsAt: null, trialAvailable: false, plan: null, expiresAt: null, streakFreezes: 0, themeId: 'default' };

interface ProContextValue extends Entitlement {
  loading: boolean;
  refresh: () => Promise<void>;
  activate: (plan: ProPlanId) => Promise<boolean>;
  cancel: () => Promise<boolean>;
  useFreeze: () => Promise<boolean>;
  grantFreeze: () => Promise<void>;
  setTheme: (themeId: string) => Promise<void>;
  closeWelcomeOffer: () => Promise<void>;
  startTrial: () => Promise<boolean>;
  awardCoins: (reason: 'challenge_win' | 'perfect_day' | 'rewarded_ad') => Promise<void>;
  buyItem: (item: 'freeze' | 'theme', themeId?: string) => Promise<{ ok: boolean; message?: string }>;
}

const ProContext = createContext<ProContextValue | undefined>(undefined);

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fbUser } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE);
  const [loading, setLoading] = useState(true);

  const entitlementRef = useRef(entitlement);
  entitlementRef.current = entitlement;

  const persist = async (next: Entitlement) => {
    setEntitlement(next);
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {}
  };

  const refresh = useCallback(async () => {
    if (!fbUser?.uid) {
      setEntitlement(FREE);
      await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      setLoading(false);
      return;
    }

    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) setEntitlement(JSON.parse(cached));
    } catch {}

    try {
      const res = await authedFetch(API_URL);
      if (res.ok) await persist(await res.json());
    } catch {}
    setLoading(false);
  }, [fbUser?.uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activate = async (plan: ProPlanId): Promise<boolean> => {
    try {
      const res = await authedFetch(`${API_URL}/activate`, {
        method: 'POST',
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) return false;
      await persist(await res.json());
      return true;
    } catch {
      return false;
    }
  };

  const cancel = async (): Promise<boolean> => {
    try {
      const res = await authedFetch(`${API_URL}/cancel`, { method: 'POST' });
      if (!res.ok) return false;
      await persist(await res.json());
      return true;
    } catch {
      return false;
    }
  };

  const useFreeze = async (): Promise<boolean> => {
    if (entitlementRef.current.streakFreezes <= 0) return false;
    try {
      const res = await authedFetch(`${API_URL}/freeze/use`, { method: 'POST' });
      if (!res.ok) return false;
      const body = await res.json();
      await persist({ ...entitlementRef.current, streakFreezes: body.streakFreezes });
      return true;
    } catch {
      return false;
    }
  };

  const grantFreeze = async () => {
    try {
      const res = await authedFetch(`${API_URL}/freeze/grant`, { method: 'POST' });
      if (!res.ok) return;
      const body = await res.json();
      await persist({ ...entitlementRef.current, streakFreezes: body.streakFreezes });
    } catch {}
  };

  const awardCoins = async (reason: 'challenge_win' | 'perfect_day' | 'rewarded_ad') => {
    try {
      const res = await authedFetch(`${COINS_URL}/award`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) return;
      const body = await res.json();
      await persist({ ...entitlementRef.current, coins: body.coins });
    } catch {}
  };

  const buyItem = async (item: 'freeze' | 'theme', themeId?: string) => {
    try {
      const res = await authedFetch(`${COINS_URL}/buy`, {
        method: 'POST',
        body: JSON.stringify({ item, themeId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: body.message ?? 'Purchase failed' };

      await persist({
        ...entitlementRef.current,
        coins: body.coins,
        streakFreezes: body.streakFreezes ?? entitlementRef.current.streakFreezes,
        unlockedThemes: body.unlockedThemes ?? entitlementRef.current.unlockedThemes,
      });
      return { ok: true };
    } catch {
      return { ok: false, message: 'Network error — try again' };
    }
  };

  const startTrial = async (): Promise<boolean> => {
    try {
      const res = await authedFetch(`${API_URL}/trial/start`, { method: 'POST' });
      if (!res.ok) return false;
      await persist(await res.json());
      return true;
    } catch {
      return false;
    }
  };

  const closeWelcomeOffer = async () => {
    await persist({ ...entitlementRef.current, welcomeOffer: false });
    try {
      const res = await authedFetch(`${API_URL}/offer/close`, { method: 'POST' });
      if (res.ok) await persist(await res.json());
    } catch {}
  };

  const setTheme = async (themeId: string) => {
    await persist({ ...entitlementRef.current, themeId });
    try {
      await authedFetch(`${API_URL}/theme`, {
        method: 'POST',
        body: JSON.stringify({ themeId }),
      });
    } catch {}
  };

  return (
    <ProContext.Provider
      value={{ ...entitlement, loading, refresh, activate, cancel, useFreeze, grantFreeze, setTheme, closeWelcomeOffer, startTrial, awardCoins, buyItem }}
    >
      {children}
    </ProContext.Provider>
  );
};

export const usePro = (): ProContextValue => {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error('usePro must be used within a ProProvider');
  return ctx;
};
