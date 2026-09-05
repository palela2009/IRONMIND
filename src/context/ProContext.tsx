import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { ProPlanId } from '../constants/pro';

const API_URL = `${API_BASE_URL}/api/pro`;
const CACHE_KEY = '@ironmind_pro_v1';

export interface Entitlement {
  isPro: boolean;
  plan: ProPlanId | null;
  expiresAt: string | null;
  streakFreezes: number;
  themeId: string;
}

const FREE: Entitlement = { isPro: false, plan: null, expiresAt: null, streakFreezes: 0, themeId: 'default' };

interface ProContextValue extends Entitlement {
  loading: boolean;
  refresh: () => Promise<void>;
  activate: (plan: ProPlanId) => Promise<boolean>;
  cancel: () => Promise<boolean>;
  useFreeze: () => Promise<boolean>;
  grantFreeze: () => Promise<void>;
  setTheme: (themeId: string) => Promise<void>;
}

const ProContext = createContext<ProContextValue | undefined>(undefined);

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fbUser } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE);
  const [loading, setLoading] = useState(true);

  // Lets non-React callers (the challenge handler in useStats) spend a freeze without
  // needing the provider threaded through them.
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
      // Reset unconditionally on sign-out rather than leaving the previous account's
      // entitlement in memory — the same account-switch bug that once left stale stats on
      // screen would otherwise hand a new account someone else's Pro.
      setEntitlement(FREE);
      await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      setLoading(false);
      return;
    }

    // Show the cached entitlement immediately so Pro UI doesn't flicker back to free on
    // every cold start while the network call is in flight.
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

  // Returns whether a freeze was actually spent. The server owns the decision — it decrements
  // atomically and answers 409 when none are left — so two challenges resolving at once can't
  // both spend the same last freeze.
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

  const setTheme = async (themeId: string) => {
    // Applied locally first so the theme switches instantly; the server call only records it.
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
      value={{ ...entitlement, loading, refresh, activate, cancel, useFreeze, grantFreeze, setTheme }}
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
