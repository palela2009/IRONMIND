import React, { useEffect, useRef, useState } from 'react';
import { AppState, Switch, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing } from '../theme';
import { authedFetch } from '../utils/authFetch';
import { API_BASE_URL } from '../config/api';

export const NotificationSettings = () => {
  const { fbUser } = useAuth();
  const palette = useTheme();
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const retry = useRef<() => Promise<void>>(async () => {});
  const save = useRef<(value: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    const uid = fbUser?.uid;
    if (!uid) return;
    const key = `@ironmind_notifications:${uid}`;
    let cancelled = false;
    let running = false;
    let pending: boolean | undefined;
    const sync = async () => {
      if (running) return;
      running = true;
      setBusy(true);
      try {
        const desired = pending;
        const response = await authedFetch(`${API_BASE_URL}/api/user/notifications`, desired === undefined ? {} : { method: 'PATCH', body: JSON.stringify({ socialNotifications: desired }) }, uid);
        if (!response.ok) throw new Error('Could not sync');
        const body = await response.json();
        if (cancelled) return;
        pending = undefined;
        setEnabled(body.socialNotifications);
        await AsyncStorage.setItem(key, JSON.stringify({ enabled: body.socialNotifications, pending: false }));
        setMessage('');
      } catch { if (!cancelled) setMessage('Not synced yet. Tap here to retry.'); }
      finally { running = false; if (!cancelled) setBusy(false); }
    };
    retry.current = sync;
    save.current = async (value) => {
      if (running || cancelled) return;
      try {
        await AsyncStorage.setItem(key, JSON.stringify({ enabled: value, pending: true }));
        pending = value;
        setEnabled(value);
        await sync();
      } catch { setMessage('Could not save this setting. Try again.'); }
    };
    void AsyncStorage.getItem(key).then((raw) => {
      if (cancelled) return;
      if (raw) { const cached = JSON.parse(raw); setEnabled(cached.enabled); if (cached.pending) pending = cached.enabled; }
      return sync();
    }).catch(() => { if (!cancelled) setMessage('Could not load settings. Tap to retry.'); });
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void sync(); });
    return () => { cancelled = true; sub.remove(); };
  }, [fbUser?.uid]);

  return <View style={{ backgroundColor: palette.surface, borderRadius: radius.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: palette.textPrimary, fontSize: 13, fontWeight: '700', flex: 1, marginRight: spacing.md }}>FRIENDS & DUELS</Text>
      <Switch accessibilityLabel="Friend and duel notifications" value={enabled} disabled={busy} onValueChange={(value) => { void save.current(value); }} trackColor={{ false: palette.surfaceRaised, true: palette.accentMuted }} thumbColor={enabled ? palette.accent : palette.textSecondary} ios_backgroundColor={palette.surfaceRaised} />
    </View>
    {!!message && <TouchableOpacity onPress={() => { void retry.current(); }} disabled={busy}>
      <Text style={{ color: palette.textSecondary, fontSize: 11, marginTop: spacing.sm }}>{message}</Text>
    </TouchableOpacity>}
  </View>;
};
