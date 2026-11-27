import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTabScrollReset } from '../hooks/useTabScrollReset';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, AppState, ActivityIndicator } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChallengeItem } from '../types/training';
import { useScreenTime, formatMinutes } from '../hooks/useScreenTime';
import { syncAppMonitor } from '../hooks/useAppMonitor';
import { APPS_LIST, FEED_LABEL_FOR_APP, colorForApp } from '../constants/apps';
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
const DAILY_GOALS = [120, 180, 240, 300];

const chipLabel = (mins: number) => (mins >= 60 ? (mins % 60 === 0 ? `${mins / 60}h` : `${mins / 60}h`) : `${mins}m`);

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
  const [dailyGoal, setDailyGoal] = useState<number>(0);
  const [editingGoal, setEditingGoal] = useState(false);

  const loadApps = useCallback(async () => {
    const raw = await AsyncStorage.getItem('@ironmind_onboarding').catch(() => null);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      setMonitoredApps(Array.isArray(data.targetApps) ? data.targetApps.filter((a: string) => APPS_LIST.includes(a)) : []);
      const limits: Record<string, number> = {};
      for (const entry of data.appLimits ?? []) {
        if (entry?.app && Number(entry.minutes) > 0) limits[entry.app] = entry.minutes;
      }
      setAppLimits(limits);
      setDailyGoal(typeof data.dailyGoalMinutes === 'number' ? data.dailyGoalMinutes : 0);
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

  const saveDailyGoal = async (mins: number) => {
    setDailyGoal(mins);
    setEditingGoal(false);
    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const data = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify({ ...data, dailyGoalMinutes: mins }));
    } catch {}
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
  const goalPct = dailyGoal > 0 ? Math.min(Math.round((totalMinutes / dailyGoal) * 100), 100) : totalMinutes > 0 ? Math.min(Math.round((trackedToday / totalMinutes) * 100), 100) : 0;
  const overDailyGoal = dailyGoal > 0 && totalMinutes >= dailyGoal;

  return (
    <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>APPS & LIMITS</Text>
        <Text style={styles.headerSub}>
          {monitoredApps.length > 0 ? `${monitoredApps.length} of ${APPS_LIST.length} feeds protected` : 'Nothing protected yet'}
        </Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>ALL APPS TODAY</Text>
          <TouchableOpacity style={styles.goalPill} onPress={() => setEditingGoal((v) => !v)} activeOpacity={0.85}>
            <Text style={styles.goalPillText}>
              {dailyGoal > 0 ? `GOAL: ${chipLabel(dailyGoal)}` : '＋ SET DAILY GOAL'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroValue}>{stLoading ? '—' : formatMinutes(totalMinutes)}</Text>
        <View style={styles.ratioTrack}>
          <View style={[styles.ratioFill, { width: `${Math.max(goalPct, totalMinutes > 0 ? 4 : 0)}%`, backgroundColor: overDailyGoal ? palette.danger : palette.accent }]} />
        </View>
        <Text style={[styles.heroSub, overDailyGoal && styles.overText]}>
          {dailyGoal > 0
            ? overDailyGoal
              ? `Over daily goal (${formatMinutes(totalMinutes)} of ${chipLabel(dailyGoal)})`
              : `${formatMinutes(Math.max(0, dailyGoal - totalMinutes))} left under your ${chipLabel(dailyGoal)} daily goal`
            : `${formatMinutes(trackedToday)} in your tracked short-video apps`}
        </Text>

        {editingGoal && (
          <View style={styles.goalPicker}>
            <Text style={styles.goalPickerHint}>Target max total screen time per day:</Text>
            <View style={styles.limitChips}>
              {DAILY_GOALS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.chip, dailyGoal === m && styles.chipOn]}
                  onPress={() => void saveDailyGoal(m)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, dailyGoal === m && styles.chipTextOn]}>{chipLabel(m)}</Text>
                </TouchableOpacity>
              ))}
              {dailyGoal > 0 && (
                <TouchableOpacity style={styles.chip} onPress={() => void saveDailyGoal(0)} activeOpacity={0.85}>
                  <Text style={styles.chipText}>OFF</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {reelsTest && (
        <TouchableOpacity
          style={[
            styles.scrollCard,
            reelsTest.isActive ? styles.scrollCardActive : styles.scrollCardHighlight,
          ]}
          onPress={reelsTest.open}
          activeOpacity={0.85}
        >
          <View style={styles.scrollCardHead}>
            <Text style={styles.scrollCardTitle}>SCROLL CHALLENGES · BIG 5</Text>
            <View
              style={[
                styles.scrollBadge,
                reelsTest.isActive ? styles.scrollBadgeActive : styles.scrollBadgeWarn,
              ]}
            >
              <Text
                style={[
                  styles.scrollBadgeText,
                  reelsTest.isActive ? styles.scrollBadgeTextActive : styles.scrollBadgeTextWarn,
                ]}
              >
                {reelsTest.status}
              </Text>
            </View>
          </View>
          <Text style={styles.scrollCardDesc}>
            Challenges fire ONLY when scrolling Instagram Reels, TikTok, YouTube Shorts, Facebook Reels, or Snapchat Spotlight — silent during DMs, Snaps, or studying.
          </Text>
          <Text style={styles.scrollCardAction}>
            {reelsTest.isActive
              ? `${reelsTest.countToday}/${reelsTest.maxPerDay} scroll challenges today · Tap to manage`
              : reelsTest.needsSetup
              ? 'TAP TO FINISH 1-STEP SETUP GUIDE →'
              : 'ACTIVATE WITH STEP-BY-STEP GUIDE →'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionLabel}>TRACKED APPS ({monitoredApps.length})</Text>
        <TouchableOpacity
          style={[styles.editPill, editing && styles.editPillActive]}
          onPress={openEditor}
          activeOpacity={0.85}
        >
          <Text style={[styles.editPillText, editing && styles.editPillTextActive]}>
            {editing ? '✕ CLOSE' : '＋ ADD / REMOVE'}
          </Text>
        </TouchableOpacity>
      </View>

      {editing && (
        <View style={styles.editor}>
          <Text style={styles.editorHeader}>SELECT APPS TO TRACK · {pending.length} / {APPS_LIST.length}</Text>
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
                <View style={styles.editBody}>
                  <Text style={[styles.editLabel, on && styles.editLabelOn]}>{app}</Text>
                  {FEED_LABEL_FOR_APP[app] && <Text style={styles.editFeed}>{FEED_LABEL_FOR_APP[app]}</Text>}
                </View>
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
              {saving ? <ActivityIndicator color={palette.accentContrast} size="small" /> : <Text style={styles.saveText}>SAVE APPS ({pending.length})</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!editing && monitoredApps.length === 0 && (
        <TouchableOpacity style={styles.emptyCard} onPress={openEditor} activeOpacity={0.85}>
          <Text style={styles.emptyTitle}>NO APPS TRACKED</Text>
          <Text style={styles.emptySub}>Pick which short-video feeds you want IRONMIND to protect.</Text>
        </TouchableOpacity>
      )}

      {!editing &&
        monitoredApps.map((app) => {
          const { total, successes, bestTime, today } = statsForApp(app);
          const rate = total > 0 ? Math.round((successes / total) * 100) : null;
          const mins = minutesForApp(app);
          const limit = limitFor(app);
          const over = limit > 0 && mins >= limit;
          const near = limit > 0 && !over && mins >= limit * 0.8;
          const pct = limit > 0 ? Math.min((mins / limit) * 100, 100) : Math.min((mins / maxMins) * 100, 100);
          const barColor = over ? palette.danger : near ? '#FFA23B' : colorForApp(app);
          const suggested = suggestFor(app);
          const isEditingThis = editingLimitFor === app;

          return (
            <View key={app} style={styles.appCard}>
              <View style={styles.appTop}>
                <AppIcon app={app} style={styles.appIcon} textStyle={styles.appIconText} />
                <View style={styles.appBody}>
                  <View style={styles.appNameRow}>
                    <Text style={styles.appName}>{app}</Text>
                    {FEED_LABEL_FOR_APP[app] && (
                      <View style={styles.scrollChip}>
                        <Text style={styles.scrollChipText}>{FEED_LABEL_FOR_APP[app].toUpperCase()}</Text>
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

              <View style={[styles.budgetBox, over && styles.budgetBoxOver, near && styles.budgetBoxNear]}>
                <View style={styles.budgetHead}>
                  <View style={styles.budgetLabelWrap}>
                    <Text style={styles.budgetKicker}>⏱ DAILY LIMIT</Text>
                    <Text style={[styles.budgetStatus, over && styles.limitOver, near && styles.limitNear]}>
                      {limit > 0
                        ? over
                          ? `OVER LIMIT · ${formatMinutes(mins)} / ${chipLabel(limit)}`
                          : `${formatMinutes(mins)} / ${chipLabel(limit)} · ${Math.ceil(limit - mins)}m left`
                        : 'Not set yet'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.budgetBtn, limit > 0 && styles.budgetBtnSet]}
                    onPress={() => setEditingLimitFor(isEditingThis ? null : app)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.budgetBtnText, limit > 0 && styles.budgetBtnTextSet]}>
                      {isEditingThis ? 'CLOSE' : limit > 0 ? 'EDIT' : 'SET LIMIT'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.barWrap}>
                  <View style={[styles.bar, { width: `${Math.max(pct, mins > 0 ? 4 : 0)}%`, backgroundColor: barColor }]} />
                  {limit > 0 && <View style={styles.warnNotch} />}
                </View>

                {isEditingThis && (
                  <View style={styles.limitEditor}>
                    <Text style={styles.limitHint}>
                      {mins > 0
                        ? `Used ${formatMinutes(mins)} today · Suggested: ${chipLabel(suggested)} (warns at 80% & alerts every time you open past limit)`
                        : 'Pick a daily limit — warns at 80%, then alerts every time you open the app past your limit.'}
                    </Text>
                    <View style={styles.limitChips}>
                      {LIMIT_CHIPS.map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.chip, limit === m && styles.chipOn, suggested === m && styles.chipSuggested]}
                          onPress={() => void saveLimit(app, m)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.chipText, limit === m && styles.chipTextOn]}>{chipLabel(m)}</Text>
                        </TouchableOpacity>
                      ))}
                      {limit > 0 && (
                        <TouchableOpacity style={styles.chipOff} onPress={() => void saveLimit(app, 0)} activeOpacity={0.85}>
                          <Text style={styles.chipOffText}>REMOVE</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
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

      {!editing && monitoredApps.length > 0 && (
        <TouchableOpacity style={styles.manageAppsBtn} onPress={openEditor} activeOpacity={0.85}>
          <Text style={styles.manageAppsBtnText}>＋ ADD OR REMOVE TRACKED APPS</Text>
        </TouchableOpacity>
      )}

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
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  goalPill: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  goalPillText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroValue: { color: c.textPrimary, fontSize: 42, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  ratioTrack: { height: 7, borderRadius: 4, backgroundColor: c.borderSubtle, overflow: 'hidden', marginTop: spacing.md },
  ratioFill: { height: '100%', borderRadius: 4 },
  heroSub: { color: c.textSecondary, fontSize: 12, marginTop: spacing.sm, fontWeight: '600' },
  overText: { color: c.danger, fontWeight: '800' },
  goalPicker: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: c.borderSubtle },
  goalPickerHint: { color: c.textTertiary, fontSize: 11, marginBottom: spacing.sm },

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
  scrollCardHighlight: { borderColor: c.accent, backgroundColor: c.accentMuted },
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
  editPill: {
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  editPillActive: { backgroundColor: c.surfaceRaised, borderColor: c.border },
  editPillText: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  editPillTextActive: { color: c.textSecondary },
  editorHeader: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.9, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },

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
  editIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  editIconText: { fontSize: 10, fontWeight: '900' },
  editBody: { flex: 1 },
  editLabel: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },
  editLabelOn: { color: c.textPrimary },
  editFeed: { color: c.textTertiary, fontSize: 11, marginTop: 1 },
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
    borderRadius: radius.lg,
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
  appName: { color: c.textPrimary, fontSize: 15, fontWeight: '900' },
  scrollChip: { backgroundColor: c.accentMuted, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  scrollChipText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  appSub: { color: c.textTertiary, fontSize: 11, marginTop: 2 },
  appRight: { alignItems: 'flex-end' },
  appMinutes: { color: c.textPrimary, fontSize: 16, fontWeight: '900' },
  appMinutesLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },

  budgetBox: {
    marginTop: spacing.md,
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    padding: spacing.md,
  },
  budgetBoxNear: { borderColor: '#FFA23B' },
  budgetBoxOver: { borderColor: c.danger, backgroundColor: c.dangerMuted },
  budgetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  budgetLabelWrap: { flex: 1 },
  budgetKicker: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  budgetStatus: { color: c.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 2 },
  limitNear: { color: '#FFA23B' },
  limitOver: { color: c.danger },
  budgetBtn: {
    backgroundColor: c.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  budgetBtnSet: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  budgetBtnText: { color: c.accentContrast, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  budgetBtnTextSet: { color: c.accent },

  barWrap: { height: 7, backgroundColor: c.bg, borderRadius: 4, overflow: 'hidden', marginTop: spacing.sm, position: 'relative' },
  bar: { height: '100%', borderRadius: 4 },
  warnNotch: { position: 'absolute', left: '80%', top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255, 162, 59, 0.7)' },

  limitEditor: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: c.border },
  limitHint: { color: c.textSecondary, fontSize: 11, marginBottom: spacing.md, lineHeight: 16 },
  limitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipOn: { backgroundColor: c.accent, borderColor: c.accent },
  chipSuggested: { borderColor: c.accentDim },
  chipText: { color: c.textSecondary, fontSize: 11, fontWeight: '900' },
  chipTextOn: { color: c.accentContrast },
  chipOff: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.danger,
  },
  chipOffText: { color: c.danger, fontSize: 11, fontWeight: '900' },

  statsRow: { flexDirection: 'row', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderColor: c.borderSubtle },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: c.textPrimary, fontSize: 14, fontWeight: '900' },
  statAccent: { color: c.accent },
  statLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: c.borderSubtle },

  manageAppsBtn: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accentDim,
    backgroundColor: c.accentMuted,
    alignItems: 'center',
  },
  manageAppsBtnText: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },

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
