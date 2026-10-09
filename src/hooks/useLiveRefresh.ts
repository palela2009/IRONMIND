import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

const POLL_MS = 20_000;

export const useLiveRefresh = (refresh: () => void | Promise<void>, enabled: boolean) => {
  const ref = useRef(refresh);
  ref.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') ref.current();
    }, POLL_MS);

    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') ref.current();
    });

    const pushes = Notifications.addNotificationReceivedListener(() => {
      ref.current();
    });

    return () => {
      clearInterval(timer);
      appState.remove();
      pushes.remove();
    };
  }, [enabled]);
};
