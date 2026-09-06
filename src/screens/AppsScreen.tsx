import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, AppState, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChallengeItem } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { useScreenTime, formatMinutes } from '../hooks/useScreenTime';
import { syncAppMonitor } from '../hooks/useAppMonitor';
import { APPS_LIST, colorForApp, abbrForApp } from '../constants/apps';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { colors, radius, spacing, cardShadow } from '../theme';

interface AppsProps {
  history: ChallengeItem[];
  onSettingsChanged?: () => void;
  onNavigate: (state: any) => void;
}

const ONBOARDING_URL = `${API_BASE_URL}/api/user/onboarding`;

export const AppsScreen: React.FC<AppsProps> = ({ history, onSettingsChanged }) => {
  const { fbUser } = useAuth();
  const { screenTime, loading: stLoading } = useScreenTime(fbUser?.uid);
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadApps = useCallback(async () => {
    const raw = await AsyncStorage.getItem('@ironmind_onboarding').catch(() => null);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      setMonitoredApps(Array.isArray(data.targetApps) ? data.targetApps : []);
    } catch {}
  }, []);

  useEffect(() => {
    loadApps();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadApps();
    });
    return () => sub.remove();
  }, [loadApps]);

  const openEditor = () => {
    if (editing) {
      setEditing(false);
      return;
    }
    setPending(monitoredApps);
    setEditing(true);
  };

  const togglePending = (app: string) => {
    setPending((prev) => (prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]));
  };

  const save = async () => {
    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const data = raw ? JSON.parse(raw) : {};
      const updated = { ...data, targetApps: pending };
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify(updated));
      setMonitoredApps(pending);

      await authedFetch(ONBOARDING_URL, {
        method: 'POST',
        body: JSON.stringify({
          targetApps: pending,
          goals: data.goals ?? [],
          difficultyLevel: data.difficultyLevel ?? 'EASY',
          dailyChallengeLimit: data.dailyChallengeLimit ?? 5,
        }),
      }).catch(() => {});

      await syncAppMonitor();
      onSettingsChanged?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const statsForApp = (app: string) => {
    const items = history.filter((i) => i.targetApp === app);
    const successes = items.filter((i) => i.wasSuccessful).length;
    const bestTime = items
      .filter((i) => i.wasSuccessful && i.elapsedTime > 0)
      .reduce((best, i) => (best === 0 || i.elapsedTime < best ? i.elapsedTime : best), 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = items.filter((i) => i.timestamp >= todayStart.getTime()).length;
    return { total: items.length, successes, bestTime, today };
  };

  const minutesForApp = (app: string) => screenTime.find((s) => s.app === app)?.minutes ?? 0;

  const totalMinutes = screenTime.reduce((sum, item) => sum + item.minutes, 0);
  const maxMins = screenTime.length > 0 ? screenTime[0].minutes || 1 : 1;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>APPS</Text>
        <Text style={styles.headerSub}>
          {monitoredApps.length > 0 ? `${monitoredApps.length} tracked` : 'Nothing tracked yet'}
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>TODAY'S SCREEN TIME</Text>
        <Text style={styles.heroValue}>{stLoading ? '—' : formatMinutes(totalMinutes)}</Text>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>TRACKED APPS</Text>
        <TouchableOpacity onPress={openEditor} activeOpacity={0.8}>
          <Text style={styles.editLink}>{editing ? 'CLOSE' : 'EDIT'}</Text>
        </TouchableOpacity>
      </View>

      {editing && (
        <View style={styles.editor}>
          {APPS_LIST.map((app) => {
            const on = pending.includes(app);
            return (
              <TouchableOpacity
                key={app}
                style={[styles.editRow, on && styles.editRowOn]}
                onPress={() => togglePending(app)}
                activeOpacity={0.75}
              >
                <View style={[styles.editIcon, { backgroundColor: colorForApp(app) }]}>
                  <Text style={styles.editIconText}>{abbrForApp(app)}</Text>
                </View>
                <Text style={[styles.editLabel, on && styles.editLabelOn]}>{app}</Text>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on && <Text style={styles.checkGlyph}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)} disabled={saving} activeOpacity={0.8}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#000000" size="small" /> : <Text style={styles.saveText}>SAVE</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!editing && monitoredApps.length === 0 && (
        <TouchableOpacity style={styles.emptyCard} onPress={openEditor} activeOpacity={0.85}>
          <Text style={styles.emptyTitle}>NO APPS TRACKED</Text>
          <Text style={styles.emptySub}>Pick the apps that pull you in. Tap EDIT to choose.</Text>
        </TouchableOpacity>
      )}

      {!editing &&
        monitoredApps.map((app) => {
          const { total, successes, bestTime, today } = statsForApp(app);
          const rate = total > 0 ? Math.round((successes / total) * 100) : null;
          const mins = minutesForApp(app);
          const barPct = Math.min((mins / maxMins) * 100, 100);

          return (
            <View key={app} style={styles.appCard}>
              <View style={styles.appTop}>
                <View style={[styles.appIcon, { backgroundColor: colorForApp(app) }]}>
                  <Text style={styles.appIconText}>{abbrForApp(app)}</Text>
                </View>
                <View style={styles.appBody}>
                  <Text style={styles.appName}>{app}</Text>
                  <Text style={styles.appSub}>
                    {today > 0 ? `${today} challenge${today > 1 ? 's' : ''} today` : 'No challenges today'}
                  </Text>
                </View>
                <View style={styles.appRight}>
                  <Text style={styles.appMinutes}>{mins > 0 ? formatMinutes(mins) : '—'}</Text>
                  <Text style={styles.appMinutesLabel}>TODAY</Text>
                </View>
              </View>

              <View style={styles.barWrap}>
                <View style={[styles.bar, { width: `${barPct}%`, backgroundColor: colorForApp(app) }]} />
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <Text style={styles.statVal}>{total}</Text>
                  <Text style={styles.statLabel}>CHALLENGES</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={[styles.statVal, rate !== null && rate >= 50 && styles.statAccent]}>
                    {rate !== null ? `${rate}%` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>SUCCESS</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={[styles.statVal, bestTime > 0 && styles.statAccent]}>
                    {bestTime > 0 ? `${bestTime.toFixed(2)}s` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>BEST</Text>
                </View>
              </View>
            </View>
          );
        })}

      {!editing && screenTime.length > 0 && (
        <>
          <Text style={styles.sectionLabelAlone}>ALL APPS TODAY</Text>
          <View style={styles.allCard}>
            {screenTime.slice(0, 10).map((item) => (
              <View key={item.app} style={styles.stRow}>
                <View style={[styles.stIcon, { backgroundColor: colorForApp(item.app) }]}>
                  <Text style={styles.stIconText}>{abbrForApp(item.app)}</Text>
                </View>
                <Text style={styles.stApp} numberOfLines={1}>{item.app}</Text>
                <View style={styles.stBarWrap}>
                  <View style={[styles.stBar, { width: `${Math.max((item.minutes / maxMins) * 100, 3)}%` }]} />
                </View>
                <Text style={styles.stTime}>{formatMinutes(item.minutes)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 52, paddingBottom: 48 },

  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { color: colors.textTertiary, fontSize: 12, marginTop: 3 },

  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  heroLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroValue: { color: colors.textPrimary, fontSize: 40, fontWeight: '900', letterSpacing: -1.5, marginTop: 6 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sectionLabelAlone: {
    color: colors.textTertiary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  editLink: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  editor: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  editRowOn: { backgroundColor: colors.accentMuted },
  editIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  editIconText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  editLabel: { flex: 1, color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  editLabelOn: { color: colors.textPrimary },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkGlyph: { color: '#000000', fontSize: 11, fontWeight: '900' },

  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  cancelText: { color: colors.textSecondary, fontSize: 12, fontWeight: '900' },
  saveBtn: { flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.accent },
  saveText: { color: '#000000', fontSize: 12, fontWeight: '900' },

  appCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  appIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  appIconText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  appBody: { flex: 1 },
  appName: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  appSub: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  appRight: { alignItems: 'flex-end' },
  appMinutes: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
  appMinutesLabel: { color: colors.textFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },

  barWrap: { height: 4, backgroundColor: colors.surfaceRaised, borderRadius: 2, overflow: 'hidden', marginTop: spacing.md },
  bar: { height: '100%', borderRadius: 2 },

  statsRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: colors.borderSubtle },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: colors.textSecondary, fontSize: 14, fontWeight: '900' },
  statAccent: { color: colors.accent },
  statLabel: { color: colors.textFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: colors.borderSubtle },

  allCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: spacing.md },
  stIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stIconText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  stApp: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', width: 78 },
  stBarWrap: { flex: 1, height: 5, backgroundColor: colors.surfaceRaised, borderRadius: 3, overflow: 'hidden' },
  stBar: { height: '100%', backgroundColor: colors.accent, borderRadius: 3 },
  stTime: { color: colors.accent, fontSize: 12, fontWeight: '900', width: 48, textAlign: 'right' },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  emptySub: { color: colors.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
