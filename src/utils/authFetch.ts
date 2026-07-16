import { auth } from '../config/firebase';

export const authedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const idToken = await auth.currentUser?.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      // Only claim a JSON content type when there's an actual body — sending it on a
      // bodyless POST/DELETE makes Express's JSON body-parser try to parse an empty
      // request body and reject with its own generic 400 before our route ever runs.
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
  });
};
