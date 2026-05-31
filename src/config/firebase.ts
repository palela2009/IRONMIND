import { initializeApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDkgyXjB30uNgQ_I_xIbmsoEALEEPSdaPM",
  authDomain: "ironmind-d80cc.firebaseapp.com",
  projectId: "ironmind-d80cc",
  storageBucket: "ironmind-d80cc.firebasestorage.app",
  messagingSenderId: "1094826576454",
  appId: "1:1094826576454:android:0386588a3f7ffcd2795847"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});