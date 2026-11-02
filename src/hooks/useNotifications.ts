import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { TrainingState } from '../types/training';
import { reportHandledError } from '../config/sentry';

export const useNotifications = (userId?: string, onNavigate?: (screen: TrainingState) => void) => {
  const [expoPushToken, setToken] = useState('');
  const [permissionStatus, setPermissionStatus] = useState('');
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let registering = false;
    const register = async () => {
      if (!userId || registering) return;
      registering = true;
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('ironmind-social', { name: 'Friends and duels', importance: Notifications.AndroidImportance.DEFAULT });
          await Notifications.setNotificationChannelAsync('ironmind_challenges', { name: 'IRONMIND Challenges', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250] });
        }
        const { status } = await Notifications.getPermissionsAsync();
        if (cancelled) return;
        setPermissionStatus(status);
        if (status !== 'granted') return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) return;
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;
        const res = await authedFetch(`${API_BASE_URL}/api/save-token`, { method: 'POST', body: JSON.stringify({ pushToken: data }) }, userId);
        if (!res.ok) throw new Error(`Push registration failed (${res.status})`);
        if (cancelled) return;
        await AsyncStorage.setItem('@ironmind_push_token', data);
        setToken(data);
      } catch (error) { reportHandledError(error, { operation: 'register_push' }); }
      finally { registering = false; }
    };
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response || !userId || cancelled) return;
      const { identifier, content } = response.notification.request;
      if (handledRef.current === identifier) return;
      const data = content.data ?? {};
      if (data.recipientUid && data.recipientUid !== userId) return;
      const type = String(data.type ?? '');
      const target: TrainingState = type.startsWith('duel') || type.startsWith('friend') || type.startsWith('referral') || type === 'leaderboard_passed' ? 'FRIENDS' : 'HOME';
      handledRef.current = identifier;
      navigateRef.current?.(target);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    void register();
    void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => {});
    const response = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const active = AppState.addEventListener('change', (state) => { if (state === 'active') void register(); });
    return () => { cancelled = true; response.remove(); active.remove(); };
  }, [userId]);
  return { expoPushToken, permissionStatus };
};
