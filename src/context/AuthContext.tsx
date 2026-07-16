import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';

interface AuthContextType {
  fbUser: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const LAST_UID_KEY = '@ironmind_last_uid';

// Local caches (stats, history, onboarding) are keyed by a single fixed
// AsyncStorage key, not per-account. If a different Firebase user signs in
// on this device than last time, wipe them first — otherwise the new
// account displays the previous account's cached stats until a cloud sync
// happens to overwrite them (and never does if the new account has less
// progress than the stale cache, since sync only pulls cloud data down when
// it's ahead of local).
const clearStaleLocalDataOnAccountSwitch = async (uid: string) => {
  const lastUid = await AsyncStorage.getItem(LAST_UID_KEY);
  // No "&&" guard on lastUid existing — the very first time this check ever runs on a
  // device, there's no recorded last-uid yet, but there may still be old cached data
  // sitting from before this check existed. Unknown provenance is treated the same as
  // "different account": clear it. A legitimate returning user's cloud data will just
  // resync straight back in on the next load, since cloud is ahead of the reset-to-0 cache.
  if (lastUid !== uid) {
    await AsyncStorage.multiRemove([
      '@ironmind_stats_v2',
      '@ironmind_history_v2',
      '@ironmind_onboarded',
      '@ironmind_onboarding',
      '@ironmind_push_token',
    ]);
  }
  await AsyncStorage.setItem(LAST_UID_KEY, uid);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentFbUser) => {
      if (currentFbUser) {
        await clearStaleLocalDataOnAccountSwitch(currentFbUser.uid);
      }
      setFbUser(currentFbUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ fbUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);