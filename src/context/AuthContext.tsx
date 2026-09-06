import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../config/firebase';

interface AuthContextType {
  fbUser: FirebaseUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const LAST_UID_KEY = '@ironmind_last_uid';

const clearStaleLocalDataOnAccountSwitch = async (uid: string) => {
  const lastUid = await AsyncStorage.getItem(LAST_UID_KEY);
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

  const refreshUser = async () => {
    await auth.currentUser?.reload();
    if (auth.currentUser) {
      const current = auth.currentUser;
      setFbUser(Object.create(Object.getPrototypeOf(current), Object.getOwnPropertyDescriptors(current)));
    }
  };

  return (
    <AuthContext.Provider value={{ fbUser, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);