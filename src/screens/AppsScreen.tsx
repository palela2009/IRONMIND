import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTabScrollReset } from '../hooks/useTabScrollReset';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, AppState, ActivityIndicator } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChallengeItem } from '../types/training';
import { useScreenTime, formatMinutes } from '../hooks/useScreenTime';
import { syncAppMonitor } from '../hooks/useAppMonitor';
import { APPS_LIST, SHORT_VIDEO_APPS, colorForApp } from '../constants/apps';
import { AppIcon } from '../components/AppIcon';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { deviceTimeZone } from '../utils/challengeTime';
import { radius, spacing, cardShadow, Palette } from '../theme';
import type { ShortVideoController } from '../hooks/useInstagramReelsTest';

interface AppsProps {
  history: ChallengeItem[];
  onSettingsChanged?: () => void;
  onNavigate: (state: any) => void;
  reelsTest?: ShortVideoController | null;
}

const ONBOARDING_URL = `${API_BASE_URL}/api/user/onboarding`;
const LIMIT_CHIPS = [15, 30, 45, 60, 90, 120];

export const AppsScreen: React.FC<AppsProps> = ({ history, onSettingsChanged, reelsTest }) => {
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<any>(null);
  useTabScrollReset('APPS', scrollRef);
  const palette = useTheme();

  const { screenTime, loading: stLoading, totalToday, trackedToday } = useScreenTime();
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [appLimits, setAppLimits] = useState<Record<string, number>>({});
  const [editingLimitFor, setEditingLimitFor] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    const raw = await AsyncStorage.getItem('@ironmind_onboarding').catch(() => null);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      setMonitoredApps(Array.isArray(data.targetApps) ? data.targetApps : []);
      const limits: Record<string, number> = {};
      for (const entry of data.appLimits ?? []) {
        if (entry?.app && Number(entry.minutes) > 0) limits[entry.app] = entry.minutes;
      }
      setAppLimits(limits);
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
          appLimits: data.appLimits ?? [],
          timeZone: data.timeZone ?? deviceTimeZone(),
        }),
      }).catch(() => {});

      await syncAppMonitor();
      onSettingsChanged?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const limitFor = (app: string): number => appLimits[app] ?? 0;

  const minutesForApp = (app: string) => screenTime.find((s) => s.app === app)?.minutes ?? 0;

  const suggestFor = (app: string): number => {
    const mins = minutesForApp(app);
    if (mins <= 0) return 30;
    const rawTarget = mins * 0.7;
    return LIMIT_CHIPS.reduce((best, chip) => (Math.abs(chip - rawTarget) < Math.abs(best - rawTarget) ? chip : best), LIMIT_CHIPS[1]);
  };

  const saveLimit = async (app: string, minutes: number) => {
    const next = { ...appLimits };
    if (minutes > 0) next[app] = minutes;
    else delete next[app];
    setAppLimits(next);
    setEditingLimitFor(null);

    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const data = raw ? JSON.parse(raw) : {};
      const asArray = Object.entries(next).map(([a, m]) => ({ app: a, minutes: m }));
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify({ ...data, appLimits: asArray }));

      await authedFetch(ONBOARDING_URL, {
        method: 'POST',
        body: JSON.stringify({
          targetApps: data.targetApps ?? monitoredApps,
          goals: data.goals ?? [],
          difficultyLevel: data.difficultyLevel ?? 'EASY',
          dailyChallengeLimit: data.dailyChallengeLimit ?? 5,
          appLimits: asArray,
          timeZone: data.timeZone ?? deviceTimeZone(),
        }),
      }).catch(() => {});

      await syncAppMonitor();
      onSettingsChanged?.();
    } catch {}
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

  const totalMinutes = totalToday;
  const maxMins = screenTime.length > 0 ? screenTime[0].minutes || 1 : 1;
  const trackedSharePct = totalMinutes > 0 ? Math.min(Math.round((trackedToday / totalMinutes) * 100), 100) : 0;

  return (
    <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>APPS</Text>
        <Text style={styles.headerSub}>
          {monitoredApps.length > 0 ? `${monitoredApps.length} tracked` : 'Nothing tracked yet'}
        </Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>TODAY'S SCREEN TIME</Text>
        <Text style={styles.heroValue}>{stLoading ? '—' : formatMinutes(totalMinutes)}</Text>
        <View style={styles.ratioTrack}>
          <View style={[styles.ratioFill, { width: `${Math.max(trackedSharePct, trackedToday > 0 ? 4 : 0)}%` }]} />
        </View>
        <Text style={styles.heroSub}>
          {formatMinutes(trackedToday)} in tracked apps{totalMinutes > 0 ? ` (${trackedSharePct}% of total)` : ''}
        </Text>
      </View>

      {reelsTest && (
        <TouchableOpacity
          style={[
            styles.scrollCard,
            reelsTest.isActive && styles.scrollCardActive,
            reelsTest.needsSetup && styles.scrollCardWarn,
          ]}
          onPress={reelsTest.open}
          activeOpacity={0.85}
        >
          <View style={styles.scrollCardHead}>
            <Text style={styles.scrollCardTitle}>SCROLL-ONLY DETECTION</Text>
            <View
              style={[
                styles.scrollBadge,
                reelsTest.isActive && styles.scrollBadgeActive,
                reelsTest.needsSetup && styles.scrollBadgeWarn,
              ]}
            >
              <Text
                style={[
                  styles.scrollBadgeText,
                  reelsTest.isActive && styles.scrollBadgeTextActive,
                  reelsTest.needsSetup && styles.scrollBadgeTextWarn,
                ]}
              >
                {reelsTest.status}
              </Text>
            </View>
          </View>
          <Text style={styles.scrollCardDesc}>
            Challenges fire ONLY when scrolling Instagram Reels, TikTok, YouTube Shorts, or Facebook Reels — never while texting or watching 1 shared video.
          </Text>
          <Text style={styles.scrollCardAction}>
            {reelsTest.isActive
              ? `${reelsTest.countToday}/${reelsTest.maxPerDay} short-video alerts today · Tap to manage`
              : reelsTest.needsSetup
              ? 'TAP TO FINISH 1-STEP SETUP GUIDE →'
              : 'TURN ON WITH STEP-BY-STEP GUIDE →'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>TRACKED APPS</Text>
        <TouchableOpacity onPress={openEditor} activeOpacity={0.8}>
          <Text style={styles.editLink}>{editing ? 'CLOSE' : 'EDIT APPS'}</Text>
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
                <AppIcon app={app} style={styles.editIcon} textStyle={styles.editIconText} />
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
              {saving ? <ActivityIndicator color={palette.accentContrast} size="small" /> : <Text style={styles.saveText}>SAVE</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!editing && monitoredApps.length === 0 && (
        <TouchableOpacity style={styles.emptyCard} onPress={openEditor} activeOpacity={0.85}>
          <Text style={styles.emptyTitle}>NO APPS TRACKED</Text>
          <Text style={styles.emptySub}>Pick the apps that pull you in. Tap EDIT APPS to choose.</Text>
        </TouchableOpacity>
      )}

      {!editing &&
        monitoredApps.map((app) => {
          const { total, successes, bestTime, today } = statsForApp(app);
          const rate = total > 0 ? Math.round((successes / total) * 100) : null;
          const mins = minutesForApp(app);
          const barPct = Math.min((mins / maxMins) * 100, 100);
          const scrollSupported = (SHORT_VIDEO_APPS as readonly string[]).includes(app);
          const scrollModeActive = Boolean(reelsTest?.isActive && scrollSupported);

          return (
            <View key={app} style={styles.appCard}>
              <View style={styles.appTop}>
                <AppIcon app={app} style={styles.appIcon} textStyle={styles.appIconText} />
                <View style={styles.appBody}>
                  <View style={styles.appNameRow}>
                    <Text style={styles.appName}>{app}</Text>
                    {scrollModeActive && (
                      <View style={styles.scrollChip}>
                        <Text style={styles.scrollChipText}>SCROLL-ONLY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.appSub}>
                    {today > 0 ? `${today} challenge${today > 1 ? 's' : ''} today` : 'No challenges today'}
                  </Text>
                </View>
                <View style={styles.appRight}>
                  <Text style={styles.appMinutes}>{mins > 0 ? formatMinutes(mins) : '—'}</Text>
                  <Text style={styles.appMinutesLabel}>TODAY</Text>
                </View>
              </View>

              {(() => {
                const limit = limitFor(app);
                const over = limit > 0 && mins >= limit;
                const near = limit > 0 && !over && mins >= limit * 0.8;
                const pct = limit > 0 ? Math.min((mins / limit) * 100, 100) : barPct;
                const barColor = over ? palette.danger : near ? '#FFA23B' : colorForApp(app);
                const suggested = suggestFor(app);

                return (
                  <>
                    <View style={styles.barWrap}>
                      <View style={[styles.bar, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>

                    <TouchableOpacity
                      style={styles.limitRow}
                      onPress={() => setEditingLimitFor(editingLimitFor === app ? null : app)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.limitText, over && styles.limitOver, near && styles.limitNear]}>
                        {limit > 0
                          ? over
                            ? `Over limit — ${formatMinutes(mins)} of ${limit}m`
                            : `${formatMinutes(mins)} of ${limit}m daily budget`
                          : 'No daily budget set'}
                      </Text>
                      <Text style={styles.limitAction}>{limit > 0 ? 'CHANGE' : 'SET BUDGET'}</Text>
                    </TouchableOpacity>

                    {editingLimitFor === app && (
                      <View style={styles.limitEditor}>
                        <Text style={styles.limitHint}>
                          {mins > 0
                            ? `Used ${formatMinutes(mins)} today · Suggested target: ${suggested}m`
                            : 'Pick a daily budget. IRONMIND warns you at 80%.'}
                        </Text>
                        <View style={styles.limitChips}>
                          {LIMIT_CHIPS.map((m) => (
                            <TouchableOpacity
                              key={m}
                              style={[styles.chip, limit === m && styles.chipOn, suggested === m && styles.chipSuggested]}
                              onPress={() => saveLimit(app, m)}
                              activeOpacity={0.85}
                            >
                              <Text style={[styles.chipText, limit === m && styles.chipTextOn]}>{m}m</Text>
                            </TouchableOpacity>
                          ))}
                          {limit > 0 && (
                            <TouchableOpacity style={styles.chip} onPress={() => saveLimit(app, 0)} activeOpacity={0.85}>
                              <Text style={styles.chipText}>OFF</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </>
                );
              })()}

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
                  <Text style={styles.statLabel}>WIN RATE</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCell}>
                  <Text style={[styles.statVal, bestTime > 0 && styles.statAccent]}>
                    {bestTime > 0 ? `${bestTime.toFixed(2)}s` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>BEST EXIT</Text>
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
                <AppIcon app={item.app} style={styles.stIcon} textStyle={styles.stIconText} />
                <Text style={styles.stApp} numberOfLines={1}>{item.app}</Text>
                <View style={styles.stBarWrap}>
                  <View style={[styles.stBar, { width: `${Math.max((item.minutes / maxMins) * 100, 3)}%`, backgroundColor: colorForApp(item.app) }]} />
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

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: spacing.lg, paddingBottom: 48 },

  header: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  headerTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { color: c.textTertiary, fontSize: 12, marginTop: 3 },

  hero: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    ...cardShadow,
  },
  heroLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  heroValue: { color: c.textPrimary, fontSize: 42, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  ratioTrack: { height: 6, borderRadius: 3, backgroundColor: c.borderSubtle, overflow: 'hidden', marginTop: spacing.md },
  ratioFill: { height: '100%', backgroundColor: c.accent, borderRadius: 3 },
  heroSub: { color: c.textSecondary, fontSize: 12, marginTop: spacing.sm, fontWeight: '600' },

  scrollCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  scrollCardActive: { borderColor: c.accentDim },
  scrollCardWarn: { borderColor: '#FFA23B' },
  scrollCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  scrollCardTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
  scrollBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.surfaceRaised },
  scrollBadgeActive: { backgroundColor: c.accentMuted },
  scrollBadgeWarn: { backgroundColor: 'rgba(255, 162, 59, 0.16)' },
  scrollBadgeText: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  scrollBadgeTextActive: { color: c.accent },
  scrollBadgeTextWarn: { color: '#FFA23B' },
  scrollCardDesc: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  scrollCardAction: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginTop: spacing.sm },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  sectionLabelAlone: {
    color: c.textTertiary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  editLink: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  editor: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
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
  editRowOn: { backgroundColor: c.accentMuted },
  editIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  editIconText: { fontSize: 10, fontWeight: '900' },
  editLabel: { flex: 1, color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  editLabelOn: { color: c.textPrimary },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  checkOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkGlyph: { color: c.accentContrast, fontSize: 11, fontWeight: '900' },

  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: radius.sm, backgroundColor: c.surfaceRaised },
  cancelText: { color: c.textSecondary, fontSize: 12, fontWeight: '900' },
  saveBtn: { flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: radius.sm, backgroundColor: c.accent },
  saveText: { color: c.accentContrast, fontSize: 12, fontWeight: '900' },

  appCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  appTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  appIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  appIconText: { fontSize: 13, fontWeight: '900' },
  appBody: { flex: 1 },
  appNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  appName: { color: c.textPrimary, fontSize: 15, fontWeight: '800' },
  scrollChip: { backgroundColor: c.accentMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  scrollChipText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  appSub: { color: c.textTertiary, fontSize: 11, marginTop: 2 },
  appRight: { alignItems: 'flex-end' },
  appMinutes: { color: c.textPrimary, fontSize: 15, fontWeight: '900' },
  appMinutesLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },

  barWrap: { height: 5, backgroundColor: c.surfaceRaised, borderRadius: 3, overflow: 'hidden', marginTop: spacing.md },
  bar: { height: '100%', borderRadius: 3 },

  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  limitText: { color: c.textSecondary, fontSize: 11, fontWeight: '600' },
  limitNear: { color: '#FFA23B', fontWeight: '800' },
  limitOver: { color: c.danger, fontWeight: '900' },
  limitAction: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  limitEditor: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: c.borderSubtle },
  limitHint: { color: c.textTertiary, fontSize: 11, marginBottom: spacing.md, lineHeight: 16 },
  limitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipOn: { backgroundColor: c.accent, borderColor: c.accent },
  chipSuggested: { borderColor: c.accentDim },
  chipText: { color: c.textSecondary, fontSize: 11, fontWeight: '900' },
  chipTextOn: { color: c.accentContrast },

  statsRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: c.borderSubtle },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: c.textPrimary, fontSize: 14, fontWeight: '900' },
  statAccent: { color: c.accent },
  statLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: c.borderSubtle },

  allCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  stRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: spacing.md },
  stIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stIconText: { fontSize: 10, fontWeight: '900' },
  stApp: { color: c.textSecondary, fontSize: 12, fontWeight: '700', width: 82 },
  stBarWrap: { flex: 1, height: 6, backgroundColor: c.surfaceRaised, borderRadius: 3, overflow: 'hidden' },
  stBar: { height: '100%', borderRadius: 3 },
  stTime: { color: c.textPrimary, fontSize: 12, fontWeight: '900', width: 48, textAlign: 'right' },

  emptyCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  emptyTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  emptySub: { color: c.textTertiary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
