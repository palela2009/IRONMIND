import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';

const BACKEND_URL = `${API_BASE_URL}/api/save-token`;

const getProjectId = (): string | undefined => {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    undefined
  );
};

export const useNotifications = (userId?: string) => {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const [permissionStatus, setPermissionStatus] = useState<string>('');
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    registerForPushNotifications();

    notifListenerRef.current = Notifications.addNotificationReceivedListener((notif) => {
      console.log('[IRONMIND] Notification received:', notif.request.content.title);
    });

    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[IRONMIND] User tapped notification:', response.notification.request.content.title);
    });

    return () => {
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userId) {
        resyncToken(userId);
      }
    });
    return () => sub.remove();
  }, [userId]);

  const resyncToken = async (uid: string) => {
    try {
      const cached = await AsyncStorage.getItem('@ironmind_push_token');
      if (cached) {
        await sendTokenToBackend(cached, uid);
      } else {
        await registerForPushNotifications();
      }
    } catch {}
  };

  const registerForPushNotifications = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ironmind-challenges', {
        name: 'IRONMIND Challenges',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#CCFF00',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    setPermissionStatus(finalStatus);

    if (finalStatus !== 'granted') {
      console.log('[IRONMIND] Notification permission denied');
      return;
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.warn('[IRONMIND] No EAS project ID found in app.json — push token skipped. Add extra.eas.projectId to app.json.');
      return;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      console.log('[IRONMIND] Expo Push Token:', token);
      setExpoPushToken(token);

      await AsyncStorage.setItem('@ironmind_push_token', token);

      if (userId) {
        await sendTokenToBackend(token, userId);
      }
    } catch (e) {
      console.error('[IRONMIND] Failed to get push token:', e);
    }
  };

  const sendTokenToBackend = async (token: string, uid: string) => {
    try {
      const res = await authedFetch(BACKEND_URL, {
        method: 'POST',
        body: JSON.stringify({ pushToken: token }),
      });
      if (res.ok) {
        console.log('[IRONMIND] Push token saved to backend for user:', uid);
      } else {
        const body = await res.text().catch(() => '');
        console.error(`[IRONMIND] Backend rejected push token save (${res.status}):`, body);
      }
    } catch (e) {
      console.error('[IRONMIND] Failed to send push token to backend:', e);
    }
  };

  return { expoPushToken, permissionStatus };
};
