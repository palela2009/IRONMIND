import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { DifficultyLevel, DIFFICULTY_WINDOW_SECONDS } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DailyLimitLevel } from '../constants/dailyLimit';
import { APPS_LIST, FEED_LABEL_FOR_APP } from '../constants/apps';
import { AppIcon } from '../components/AppIcon';
import { useAuth } from '../context/AuthContext';
import { syncAppMonitor } from '../hooks/useAppMonitor';
import { deviceTimeZone } from '../utils/challengeTime';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionSteps } from '../components/PermissionSteps';
import type { ShortVideoController } from '../hooks/useInstagramReelsTest';

interface OnboardingProps {
  onComplete: () => void;
  reelsTest?: ShortVideoController | null;
}

const ONBOARDING_URL = `${API_BASE_URL}/api/user/onboarding`;
const TOTAL_STEPS = 5;

const HOURS = [
  { value: 1.5, label: '1 – 2 hours', sub: 'Light habit, ready to tighten up' },
  { value: 3, label: '2 – 4 hours', sub: 'Typical daily scroll zone' },
  { value: 5, label: '4 – 6 hours', sub: 'Stealing serious focus every day' },
  { value: 7, label: '6+ hours', sub: 'Time for a full reset' },
];

const GOALS = [
  { id: 'sleep', icon: '🌙', label: 'PROTECT MY SLEEP', sub: 'Stop turning "5 more minutes" into 2 AM', alertText: 'Protect your sleep tonight' },
  { id: 'focus', icon: '🎯', label: 'STUDY & WORK FOCUS', sub: 'Stay locked in without grabbing your phone', alertText: 'Protect your study & work focus' },
  { id: 'morning', icon: '🌅', label: 'CLEAN MORNINGS', sub: 'Never start your day stuck in a feed', alertText: 'Start your mornings clean' },
  { id: 'time', icon: '⏳', label: 'RECLAIM MY FREE TIME', sub: 'More hours for gym, projects, and real life', alertText: 'Reclaim your free time' },
  { id: 'doomscroll', icon: '⚡', label: 'KILL AUTOPILOT SCROLLING', sub: 'Stop opening apps without even thinking', alertText: 'Kill the autopilot scroll loop' },
];

const INTENSITIES: {
  id: string;
  label: string;
  badge?: string;
  sub: string;
  difficulty: DifficultyLevel;
  limit: DailyLimitLevel;
}[] = [
  {
    id: 'measured',
    label: 'WARM-UP',
    sub: `${DIFFICULTY_WINDOW_SECONDS.EASY}s exit window · ${DAILY_LIMIT_VALUES.EASY} challenges / day`,
    difficulty: 'EASY',
    limit: 'EASY',
  },
  {
    id: 'standard',
    label: 'STANDARD',
    badge: 'POPULAR',
    sub: `${DIFFICULTY_WINDOW_SECONDS.INTERMEDIATE}s exit window · ${DAILY_LIMIT_VALUES.MEDIUM} challenges / day`,
    difficulty: 'INTERMEDIATE',
    limit: 'MEDIUM',
  },
  {
    id: 'brutal',
    label: 'BEAST MODE',
    badge: 'HARD',
    sub: `${DIFFICULTY_WINDOW_SECONDS.HARD}s exit window · ${DAILY_LIMIT_VALUES.HARD} challenges / day`,
    difficulty: 'HARD',
    limit: 'HARD',
  },
];

const daysPerYear = (hoursPerDay: number): number => Math.round((hoursPerDay * 365) / 24);
const monthsPerDecade = (hoursPerDay: number): number => Math.round((hoursPerDay * 3650) / (24 * 30));

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete, reelsTest }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { fbUser } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [selectedApps, setSelectedApps] = useState<string[]>(['Instagram', 'TikTok', 'YouTube']);
  const [hours, setHours] = useState<number | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [intensity, setIntensity] = useState<string>('standard');
  const [saving, setSaving] = useState<boolean>(false);
  const perms = usePermissions();

  const toggleApp = (app: string) =>
    setSelectedApps((prev) => (prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]));

  const allThreeReady = perms.coreGranted && (!reelsTest || reelsTest.isActive);
  const readyCount = (perms.status.notifications ? 1 : 0) + (perms.status.usage ? 1 : 0) + (reelsTest?.isActive ? 1 : 0);
  const totalPerms = reelsTest ? 3 : 2;

  const canAdvance = (): boolean => {
    if (step === 1) return selectedApps.length > 0;
    if (step === 2) return hours !== null;
    if (step === 3) return goal !== '';
    if (step === TOTAL_STEPS) return allThreeReady;
    return true;
  };

  const finish = async () => {
    setSaving(true);
    const chosen = INTENSITIES.find((i) => i.id === intensity) ?? INTENSITIES[1];
    const dailyChallengeLimit = DAILY_LIMIT_VALUES[chosen.limit];

    const data = {
      timeZone: deviceTimeZone(),
      targetApps: selectedApps,
      goals: [goal],
      difficultyLevel: chosen.difficulty,
      dailyChallengeLimit,
      reportedHours: hours,
    };

    try {
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify(data));
      await authedFetch(ONBOARDING_URL, {
        method: 'POST',
        body: JSON.stringify({
          timeZone: data.timeZone,
          targetApps: data.targetApps,
          goals: data.goals,
          difficultyLevel: data.difficultyLevel,
          dailyChallengeLimit,
          email: fbUser?.email,
          displayName: fbUser?.displayName,
          photoURL: fbUser?.photoURL,
        }),
      });
      await syncAppMonitor();
    } catch {}

    setSaving(false);
    onComplete();
  };

  const next = () => (step === TOTAL_STEPS ? finish() : setStep(step + 1));
  const pickedGoal = GOALS.find((g) => g.id === goal);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <View style={styles.topBar}>
        <Text style={styles.stepCount}>STEP {step} OF {TOTAL_STEPS}</Text>
        {step > 1 ? (
          <TouchableOpacity onPress={() => setStep(step - 1)} activeOpacity={0.8}>
            <Text style={styles.back}>← BACK</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.selectedPill}>{selectedApps.length} SELECTED</Text>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <>
            <Text style={styles.title}>WHICH FEEDS{'\n'}STEAL YOUR TIME?</Text>
            <Text style={styles.sub}>
              IRONMIND only alerts you when you start scrolling short videos — never during DMs, Snaps, or studying on YouTube.
            </Text>
            <View style={styles.appGrid}>
              {APPS_LIST.map((app) => {
                const on = selectedApps.includes(app);
                return (
                  <TouchableOpacity
                    key={app}
                    style={[styles.appTile, on && styles.appTileOn]}
                    onPress={() => toggleApp(app)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.appTileTop}>
                      <AppIcon app={app} style={styles.appIcon} textStyle={styles.appIconText} />
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on && <Text style={styles.checkGlyph}>✓</Text>}
                      </View>
                    </View>
                    <Text style={[styles.appTileName, on && styles.optionLabelOn]} numberOfLines={1}>{app}</Text>
                    {FEED_LABEL_FOR_APP[app] && (
                      <Text style={styles.appTileFeed} numberOfLines={1}>{FEED_LABEL_FOR_APP[app]}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>HOW MUCH TIME{'\n'}GOES TO YOUR PHONE?</Text>
            <Text style={styles.sub}>
              Rough estimate is fine. We use this to calculate how many real hours you win back each day.
            </Text>
            {HOURS.map((h) => {
              const on = hours === h.value;
              return (
                <TouchableOpacity
                  key={h.value}
                  style={[styles.optionRow, on && styles.optionRowOn]}
                  onPress={() => setHours(h.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionBody}>
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{h.label}</Text>
                    <Text style={styles.optionSub}>{h.sub}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}

            {hours !== null && (
              <View style={styles.impactCard}>
                <View style={styles.impactRow}>
                  <View style={styles.impactCol}>
                    <Text style={styles.impactNum}>{daysPerYear(hours)}</Text>
                    <Text style={styles.impactLabel}>DAYS / YEAR</Text>
                  </View>
                  <View style={styles.impactDivider} />
                  <View style={styles.impactCol}>
                    <Text style={styles.impactNum}>{monthsPerDecade(hours)}</Text>
                    <Text style={styles.impactLabel}>MONTHS / 10 YRS</Text>
                  </View>
                </View>
                <Text style={styles.impactSub}>
                  That's full 24-hour days spent inside a screen. IRONMIND helps you take them back.
                </Text>
              </View>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>WHAT ARE YOU{'\n'}TAKING BACK?</Text>
            <Text style={styles.sub}>
              Pick your main reason — it appears right inside your challenge alert to snap you off autopilot.
            </Text>
            {GOALS.map((g) => {
              const on = goal === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.optionRow, on && styles.optionRowOn]}
                  onPress={() => setGoal(g.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.goalIcon}>{g.icon}</Text>
                  <View style={styles.optionBody}>
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{g.label}</Text>
                    <Text style={styles.optionSub}>{g.sub}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}

            {pickedGoal && (
              <View style={styles.previewNotif}>
                <Text style={styles.previewKicker}>LIVE ALERT PREVIEW</Text>
                <View style={styles.previewRow}>
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>IM</Text>
                  </View>
                  <View style={styles.previewBody}>
                    <Text style={styles.previewTitle}>STILL SCROLLING {FEED_LABEL_FOR_APP[selectedApps[0] ?? 'Instagram']?.toUpperCase() ?? 'REELS'}?</Text>
                    <Text style={styles.previewText}>
                      Leave within 10s · Goal: {pickedGoal.alertText}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.title}>PICK YOUR{'\n'}CHALLENGE SPEED.</Text>
            <Text style={styles.sub}>
              Sets how fast you have to exit when an alert fires. You can adjust this anytime in You → Settings.
            </Text>
            {INTENSITIES.map((i) => {
              const on = intensity === i.id;
              return (
                <TouchableOpacity
                  key={i.id}
                  style={[styles.optionRow, on && styles.optionRowOn]}
                  onPress={() => setIntensity(i.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionBody}>
                    <View style={styles.labelBadgeRow}>
                      <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{i.label}</Text>
                      {i.badge && (
                        <View style={styles.intensityBadge}>
                          <Text style={styles.intensityBadgeText}>{i.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.optionSub}>{i.sub}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.smartNote}>
              <Text style={styles.smartNoteTitle}>100% SCROLL-ONLY PROTECTION</Text>
              <Text style={styles.smartNoteBody}>
                Study on YouTube, answer DMs, reply to Snaps, or watch 1 reel a friend sent — <Text style={styles.smartNoteStrong}>IRONMIND stays completely silent</Text> until your thumb starts doomscrolling Reels, TikTok, Shorts, or Spotlight.
              </Text>
            </View>
          </>
        )}

        {step === 5 && (
          <>
            <Text style={styles.title}>{reelsTest ? 'THREE QUICK\nSWITCHES.' : 'TWO QUICK\nPERMISSIONS.'}</Text>
            <Text style={styles.sub}>
              {reelsTest
                ? `${readyCount} of ${totalPerms} ready — turn all three green (~20 seconds) so your very first Reels, TikTok, Shorts or Spotlight scroll works immediately.`
                : 'Just two switches to enter the app — powers your Screen Time, Leaderboard, and automatic Duel sync.'}
            </Text>
            <PermissionSteps perms={perms} reelsTest={reelsTest} />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, !canAdvance() && styles.ctaDisabled]}
          onPress={next}
          activeOpacity={0.85}
          disabled={!canAdvance() || saving}
        >
          {saving ? (
            <ActivityIndicator color={palette.accentContrast} />
          ) : (
            <Text style={styles.ctaText}>
              {step === TOTAL_STEPS ? 'LAUNCH IRONMIND →' : 'CONTINUE'}
            </Text>
          )}
        </TouchableOpacity>
        {step === TOTAL_STEPS && perms.coreGranted && reelsTest && !reelsTest.isActive && (
          <TouchableOpacity style={styles.skipScrollBtn} onPress={finish} disabled={saving} activeOpacity={0.8}>
            <Text style={styles.skipScrollText}>SKIP SCROLL CHALLENGES FOR NOW (TURN ON LATER)</Text>
          </TouchableOpacity>
        )}
        {step === TOTAL_STEPS && !perms.coreGranted && (
          <Text style={styles.hint}>Turn on Notifications and Usage Access to continue.</Text>
        )}
        {step === 1 && selectedApps.length === 0 && (
          <Text style={styles.hint}>Pick at least one app to continue.</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  progressTrack: { height: 3, backgroundColor: c.surfaceRaised, marginTop: spacing.sm },
  progressFill: { height: '100%', backgroundColor: c.accent },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  stepCount: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  selectedPill: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  back: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },

  title: { color: c.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.md, marginBottom: spacing.xl },

  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  appTile: {
    width: '48.2%',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
  },
  appTileOn: { borderColor: c.accent, backgroundColor: c.accentMuted },
  appTileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  appTileName: { color: c.textSecondary, fontSize: 14, fontWeight: '800' },
  appTileFeed: { color: c.textTertiary, fontSize: 11, fontWeight: '700', marginTop: 2 },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionRowOn: { borderColor: c.accent, backgroundColor: c.accentMuted },
  goalIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  optionBody: { flex: 1 },
  labelBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  intensityBadge: { backgroundColor: c.accentMuted, borderWidth: 1, borderColor: c.accentDim, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  intensityBadgeText: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  optionLabel: { color: c.textSecondary, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  optionLabelOn: { color: c.textPrimary },
  optionSub: { color: c.textTertiary, fontSize: 12, marginTop: 3 },

  appIcon: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  appIconText: { fontSize: 12, fontWeight: '900' },

  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  checkOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkGlyph: { color: c.accentContrast, fontSize: 11, fontWeight: '900' },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: c.accent },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent },

  previewNotif: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.accentDim,
  },
  previewKicker: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.sm },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },
  previewBadgeText: { color: c.accentContrast, fontSize: 12, fontWeight: '900' },
  previewBody: { flex: 1 },
  previewTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '900' },
  previewText: { color: c.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },

  smartNote: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
  },
  smartNoteTitle: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs },
  smartNoteBody: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
  smartNoteStrong: { color: c.textPrimary, fontWeight: '800' },

  impactCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...cardShadow,
  },
  impactRow: { flexDirection: 'row', alignItems: 'center' },
  impactCol: { flex: 1, alignItems: 'center' },
  impactDivider: { width: 1, height: 48, backgroundColor: c.border },
  impactNum: { color: c.accent, fontSize: 44, fontWeight: '900', letterSpacing: -1.5 },
  impactLabel: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  impactSub: { color: c.textTertiary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: spacing.md },

  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.md },
  cta: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.3 },
  ctaText: { color: c.accentContrast, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  skipScrollBtn: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.xs },
  skipScrollText: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  hint: { color: c.textTertiary, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
});
