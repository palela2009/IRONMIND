import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { auth } from '../config/firebase';

const deviceId = (): string | null => {
  if (Platform.OS !== 'android') return null;
  try {
    return Application.getAndroidId();
  } catch {
    return null;
  }
};

const DEVICE_ID = deviceId();

export const authedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const idToken = await auth.currentUser?.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(DEVICE_ID ? { 'X-Device-Id': DEVICE_ID } : {}),
    },
  });
};
