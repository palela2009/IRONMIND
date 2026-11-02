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

export const authedFetch = async (url: string, options: RequestInit = {}, expectedUid?: string): Promise<Response> => {
  const user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid)) throw new Error('Sign in again to sync your account');
  const idToken = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Account changed');
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
        Authorization: 'Bearer ' + idToken,
        ...(DEVICE_ID ? { 'X-Device-Id': DEVICE_ID } : {}),
      },
    });
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
};
