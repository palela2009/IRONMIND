import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { auth } from '../config/firebase';
import { completeStorePurchase, recoverStorePurchase, ConfirmedOutcome } from '../utils/purchaseRecovery';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { ProPlanId } from '../constants/pro';
import { PurchasesStoreProduct } from 'react-native-purchases';
import { identifyPurchaser, buyProduct, restorePurchases } from '../config/purchases';

const API_URL = `${API_BASE_URL}/api/pro`;
const COINS_URL = `${API_BASE_URL}/api/coins`;
const CACHE_KEY = '@ironmind_pro_v1';

export interface Entitlement {
  isPro: boolean;
  isOwner: boolean;
  welcomeOffer: boolean;
  welcomeGiftAvailable: boolean;
  welcomeGiftTheme: string | null;
  coins: number;
  unlockedThemes: string[];
  ownedFrames: string[];
  ownedNameEffects: string[];
  equippedFrame: string | null;
  equippedNameEffect: string | null;
  onTrial: boolean;
  trialEndsAt: string | null;
  plan: ProPlanId | null;
  source: 'store' | 'coins' | 'owner' | 'invites' | null;
  referralRewards: number[];
  expiresAt: string | null;
  streakFreezes: number;
  themeId: string;
}

const FREE: Entitlement = { isPro: false, isOwner: false, welcomeOffer: false, welcomeGiftAvailable: false, welcomeGiftTheme: null, coins: 0, unlockedThemes: [], ownedFrames: [], ownedNameEffects: [], equippedFrame: null, equippedNameEffect: null, onTrial: false, trialEndsAt: null, plan: null, source: null, referralRewards: [], expiresAt: null, streakFreezes: 0, themeId: 'default' };

interface ProContextValue extends Entitlement {
  loading: boolean;
  purchasePending: boolean;
  refresh: () => Promise<void>;
  purchase: (product: PurchasesStoreProduct, offerTag?: string) => Promise<ConfirmedOutcome>;
  restore: () => Promise<'restored' | 'pending' | 'failed' | 'none'>;
  setTheme: (themeId: string) => Promise<void>;
  closeWelcomeOffer: () => Promise<void>;
  claimWelcomeGift: (themeId: string) => Promise<{ ok: boolean; message?: string }>;
  buyItem: (
    item: 'freeze' | 'reclaim' | 'theme' | 'frame' | 'nameEffect' | 'proWeek',
    opts?: { themeId?: string; cosmeticId?: string }
  ) => Promise<{ ok: boolean; message?: string }>;
  equipCosmetic: (slot: 'frame' | 'nameEffect', cosmeticId: string | null) => Promise<void>;
}

const normalize = (raw: Partial<Entitlement> | null | undefined): Entitlement => ({
  ...FREE,
  ...(raw ?? {}),
  unlockedThemes: raw?.unlockedThemes ?? [],
  ownedFrames: raw?.ownedFrames ?? [],
  ownedNameEffects: raw?.ownedNameEffects ?? [],
  referralRewards: raw?.referralRewards ?? [],
});

const ProContext = createContext<ProContextValue | undefined>(undefined);

export const ProProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { fbUser } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE);
  const [loading, setLoading] = useState(true);
  const [purchasePending, setPurchasePending] = useState(false);
  const purchaseRunning = useRef(false);
  const shopRunning = useRef(new Set<string>());
  const giftRunning = useRef(false);

  const accountRef = useRef(fbUser?.uid);
  accountRef.current = fbUser?.uid;
  const entitlementRef = useRef(entitlement);
  entitlementRef.current = entitlement;

  const persist = async (raw: Partial<Entitlement>) => {
    const uid = fbUser?.uid;
    if (!uid || accountRef.current !== uid || auth.currentUser?.uid !== uid) return;
    const next = normalize(raw);
    setEntitlement(next);
    try {
      await AsyncStorage.setItem(`${CACHE_KEY}:${uid}`, JSON.stringify(next));
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
      const cached = await AsyncStorage.getItem(`${CACHE_KEY}:${fbUser.uid}`);
      if (accountRef.current !== fbUser.uid) return;
      setEntitlement(cached ? normalize(JSON.parse(cached)) : FREE);
    } catch {}

    try {
      const res = await authedFetch(API_URL);
      if (res.ok) await persist(await res.json());
    } catch {}
    setLoading(false);
  }, [fbUser?.uid]);

  useEffect(() => {
    identifyPurchaser(fbUser?.uid ?? null);
    setEntitlement(FREE);
    refresh();
    setPurchasePending(false);
    const uid = fbUser?.uid;
    if (!uid) return;
    let cancelled = false;
    let running = false;
    const retry = async () => {
      if (running || cancelled || accountRef.current !== uid) return;
      running = true;
      try {
        const key = `@ironmind_purchase_pending:${uid}`;
        const pending = !!(await AsyncStorage.getItem(key));
        if (!cancelled) setPurchasePending(pending);
        if (pending) {
          await recoverStorePurchase(AsyncStorage, key, () => syncStore(uid));
          if (!cancelled) setPurchasePending(!!(await AsyncStorage.getItem(key)));
        }
      } finally { running = false; }
    };
    void retry().catch(() => {});
    const timer = setInterval(() => { if (AppState.currentState === 'active') void retry().catch(() => {}); }, 30000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void retry().catch(() => {}); });
    return () => { cancelled = true; clearInterval(timer); sub.remove(); };
  }, [refresh]);

  const syncStore = async (uid = accountRef.current): Promise<boolean> => {
    if (!uid) return false;
    try {
      const res = await authedFetch(`${API_URL}/sync`, { method: 'POST' }, uid);
      if (!res.ok) return false;
      const body = await res.json();
      if (accountRef.current !== uid) return false;
      await persist(body);
      return body.isPro === true && body.source === 'store';
    } catch {
      return false;
    }
  };

  const purchase = async (product: PurchasesStoreProduct, offerTag?: string): Promise<ConfirmedOutcome> => {
    const uid = accountRef.current;
    if (!uid) return 'failed';
    if (purchaseRunning.current || purchasePending) return 'pending';
    purchaseRunning.current = true;
    const key = '@ironmind_purchase_pending:' + uid;
    try {
      if (await AsyncStorage.getItem(key)) { setPurchasePending(true); return 'pending'; }
      const outcome = await completeStorePurchase(AsyncStorage, key, product.identifier, () => buyProduct(product, offerTag), () => syncStore(uid));
      if (accountRef.current === uid) setPurchasePending(outcome === 'pending');
      return outcome;
    } catch { return 'failed'; }
    finally { purchaseRunning.current = false; }
  };

  const restore = async (): Promise<'restored' | 'pending' | 'failed' | 'none'> => {
    const uid = accountRef.current;
    if (!uid) return 'failed';
    const result = await restorePurchases();
    if (result === 'failed') return 'failed';
    const key = '@ironmind_purchase_pending:' + uid;
    if (result === 'none' && !(await AsyncStorage.getItem(key))) return 'none';
    await AsyncStorage.setItem(key, JSON.stringify({ startedAt: Date.now() }));
    const confirmed = await recoverStorePurchase(AsyncStorage, key, () => syncStore(uid));
    if (accountRef.current === uid) setPurchasePending(!confirmed);
    return confirmed ? 'restored' : 'pending';
  };

  const buyItem = async (
    item: 'freeze' | 'reclaim' | 'theme' | 'frame' | 'nameEffect' | 'proWeek',
    opts: { themeId?: string; cosmeticId?: string } = {}
  ) => {
    const uid = accountRef.current;
    if (!uid) return { ok: false, message: 'Sign in again' };
    const operation = JSON.stringify([item, opts.themeId ?? null, opts.cosmeticId ?? null]);
    const flight = uid + ':' + operation;
    if (shopRunning.current.has(flight)) return { ok: false, message: 'Purchase is being confirmed' };
    shopRunning.current.add(flight);
    const key = '@ironmind_shop_pending:' + uid + ':' + operation;
    try {
      const requestId = (await AsyncStorage.getItem(key)) ?? Crypto.randomUUID();
      await AsyncStorage.setItem(key, requestId);
      const res = await authedFetch(`${COINS_URL}/buy`, {
        method: 'POST',
        body: JSON.stringify({ item, ...opts, requestId }),
      }, uid);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 || res.status === 409) await AsyncStorage.removeItem(key);
        return { ok: false, message: body.message ?? 'Purchase failed' };
      }

      await persist({
        ...entitlementRef.current,
        coins: body.coins ?? entitlementRef.current.coins,
        streakFreezes: body.streakFreezes ?? entitlementRef.current.streakFreezes,
        unlockedThemes: body.unlockedThemes ?? entitlementRef.current.unlockedThemes,
        ownedFrames: body.ownedFrames ?? entitlementRef.current.ownedFrames,
        ownedNameEffects: body.ownedNameEffects ?? entitlementRef.current.ownedNameEffects,
        equippedFrame: body.equippedFrame ?? entitlementRef.current.equippedFrame,
        equippedNameEffect: body.equippedNameEffect ?? entitlementRef.current.equippedNameEffect,
      });

      await AsyncStorage.removeItem(key);
      if (item === 'proWeek') await refresh();
      return { ok: true };
    } catch {
      return { ok: false, message: 'Could not confirm the purchase. Retry to check it safely.' };
    } finally { shopRunning.current.delete(flight); }
  };

  const equipCosmetic = async (slot: 'frame' | 'nameEffect', cosmeticId: string | null) => {
    await persist({
      ...entitlementRef.current,
      ...(slot === 'frame' ? { equippedFrame: cosmeticId } : { equippedNameEffect: cosmeticId }),
    });
    try {
      await authedFetch(`${COINS_URL}/equip`, {
        method: 'POST',
        body: JSON.stringify({ slot, cosmeticId }),
      });
    } catch {}
  };

  const claimWelcomeGift = async (themeId: string): Promise<{ ok: boolean; message?: string }> => {
    const uid = accountRef.current;
    if (!uid || giftRunning.current) return { ok: false, message: 'Please wait and try again.' };
    giftRunning.current = true;
    try {
      const res = await authedFetch(`${API_URL}/welcome-gift`, { method: 'POST', body: JSON.stringify({ themeId }) }, uid);
      const body = await res.json();
      if (!res.ok) return { ok: false, message: body.message ?? 'Could not claim your gift.' };
      if (accountRef.current !== uid) return { ok: false, message: 'Your signed-in account changed.' };
      await persist(body);
      return { ok: true };
    } catch { return { ok: false, message: 'Could not connect. Your gift is still available. Please retry.' }; }
    finally { giftRunning.current = false; }
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
      value={{ ...entitlement, loading, purchasePending, refresh, purchase, restore, setTheme, closeWelcomeOffer, claimWelcomeGift, buyItem, equipCosmetic }}
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
