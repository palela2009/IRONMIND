import { auth } from '../config/firebase';

export const authedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const idToken = await auth.currentUser?.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
  });
};
