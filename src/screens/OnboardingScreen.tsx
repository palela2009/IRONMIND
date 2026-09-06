import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { DifficultyLevel, DIFFICULTY_WINDOW_SECONDS } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DailyLimitLevel } from '../constants/dailyLimit';
import { APPS_LIST, colorForApp, abbrForApp } from '../constants/apps';
import { useAuth } from '../context/AuthContext';
import { syncAppMonitor } from '../hooks/useAppMonitor';

interface OnboardingProps {
  onComplete: () => void;
}

const ONBOARDING_URL = `${API_BASE_URL}/api/user/onboarding`;
const TOTAL_STEPS = 5;

const HOURS = [
  { value: 1, label: 'Under 2 hours' },
  { value: 2, label: 'About 2 hours' },
  { value: 3, label: 'About 3 hours' },
  { value: 5, label: 'About 5 hours' },
  { value: 7, label: '7 hours or more' },
];

const GOALS = [
  { id: 'doomscroll', label: 'STOP DOOMSCROLLING', sub: 'Break the endless feed loop' },
  { id: 'focus', label: 'BUILD FOCUS', sub: 'Train deep work habits' },
  { id: 'habit', label: 'BREAK THE HABIT', sub: 'Rewire compulsive checking' },
  { id: 'sleep', label: 'SLEEP BETTER', sub: 'No screens before bed' },
  { id: 'time', label: 'RECLAIM TIME', sub: 'Get hours back every week' },
];

const INTENSITIES: {
  id: string;
  label: string;
  sub: string;
  difficulty: DifficultyLevel;
  limit: DailyLimitLevel;
}[] = [
  {
    id: 'measured',
    label: 'MEASURED',
    sub: `${DIFFICULTY_WINDOW_SECONDS.EASY}s to exit · ${DAILY_LIMIT_VALUES.EASY} challenges a day`,
    difficulty: 'EASY',
    limit: 'EASY',
  },
  {
    id: 'standard',
    label: 'STANDARD',
    sub: `${DIFFICULTY_WINDOW_SECONDS.INTERMEDIATE}s to exit · ${DAILY_LIMIT_VALUES.MEDIUM} challenges a day`,
    difficulty: 'INTERMEDIATE',
    limit: 'MEDIUM',
  },
  {
    id: 'brutal',
    label: 'BRUTAL',
    sub: `${DIFFICULTY_WINDOW_SECONDS.HARD}s to exit · ${DAILY_LIMIT_VALUES.HARD} challenges a day`,
    difficulty: 'HARD',
    limit: 'HARD',
  },
];

const daysPerYear = (hoursPerDay: number): number => Math.round((hoursPerDay * 365) / 24);

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { fbUser } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [hours, setHours] = useState<number | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [intensity, setIntensity] = useState<string>('standard');
  const [saving, setSaving] = useState<boolean>(false);
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [usageOpened, setUsageOpened] = useState<boolean>(false);

  useEffect(() => {
    if (step === TOTAL_STEPS) {
      Notifications.getPermissionsAsync().then(({ status }) => {
        if (status === 'granted') setNotifStatus('granted');
        else if (status === 'denied') setNotifStatus('denied');
      });
    }
  }, [step]);

  const toggleApp = (app: string) =>
    setSelectedApps((prev) => (prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]));

  const requestNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status === 'granted' ? 'granted' : 'denied');
  };

  const openUsageAccess = async () => {
    setUsageOpened(true);
    try {
      if (Platform.OS === 'android') await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
      else await Linking.openSettings();
    } catch {
      await Linking.openSettings();
    }
  };

  const canAdvance = (): boolean => {
    if (step === 1) return selectedApps.length > 0;
    if (step === 2) return hours !== null;
    if (step === 3) return goal !== '';
    return true;
  };

  const finish = async () => {
    setSaving(true);
    const chosen = INTENSITIES.find((i) => i.id === intensity) ?? INTENSITIES[1];
    const dailyChallengeLimit = DAILY_LIMIT_VALUES[chosen.limit];

    const data = {
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

  return (
    <View style={styles.root}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <View style={styles.topBar}>
        <Text style={styles.stepCount}>STEP {step} OF {TOTAL_STEPS}</Text>
        {step > 1 && (
          <TouchableOpacity onPress={() => setStep(step - 1)} activeOpacity={0.8}>
            <Text style={styles.back}>← BACK</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <>
            <Text style={styles.title}>WHAT OWNS{'\n'}YOUR ATTENTION?</Text>
            <Text style={styles.sub}>
              Pick the apps that pull you in. Open one and IRONMIND fires a timed challenge — exit
              fast or take the loss.
            </Text>
            {APPS_LIST.map((app) => {
              const on = selectedApps.includes(app);
              return (
                <TouchableOpacity
                  key={app}
                  style={[styles.optionRow, on && styles.optionRowOn]}
                  onPress={() => toggleApp(app)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.appIcon, { backgroundColor: colorForApp(app) }]}>
                    <Text style={styles.appIconText}>{abbrForApp(app)}</Text>
                  </View>
                  <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{app}</Text>
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on && <Text style={styles.checkGlyph}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>HOW MUCH TIME{'\n'}ARE YOU LOSING?</Text>
            <Text style={styles.sub}>
              Rough guess is fine. This is your starting line — you will see the real number
              tomorrow.
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
                  <Text style={[styles.optionLabel, styles.optionLabelWide, on && styles.optionLabelOn]}>
                    {h.label}
                  </Text>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}

            {hours !== null && (
              <View style={styles.impactCard}>
                <Text style={styles.impactNum}>{daysPerYear(hours)}</Text>
                <Text style={styles.impactLabel}>DAYS A YEAR</Text>
                <Text style={styles.impactSub}>
                  At that rate you spend {daysPerYear(hours)} full days a year inside these apps.
                  IRONMIND exists to take some of that back.
                </Text>
              </View>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>WHY ARE{'\n'}YOU HERE?</Text>
            <Text style={styles.sub}>Your reason shows up when a challenge fires. Pick one.</Text>
            {GOALS.map((g) => {
              const on = goal === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.optionRow, on && styles.optionRowOn]}
                  onPress={() => setGoal(g.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.optionBody}>
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{g.label}</Text>
                    <Text style={styles.optionSub}>{g.sub}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.title}>HOW HARD{'\n'}SHOULD IT PUSH?</Text>
            <Text style={styles.sub}>
              This sets how long you get to exit and how often challenges fire. You can change it
              any time in your profile.
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
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>{i.label}</Text>
                    <Text style={styles.optionSub}>{i.sub}</Text>
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 5 && (
          <>
            <Text style={styles.title}>TWO{'\n'}PERMISSIONS.</Text>
            <Text style={styles.sub}>
              IRONMIND cannot detect anything without these. It takes about ten seconds.
            </Text>

            <View style={[styles.permCard, notifStatus === 'granted' && styles.permCardDone]}>
              <View style={styles.permHead}>
                <View style={[styles.permNum, notifStatus === 'granted' && styles.permNumDone]}>
                  <Text style={[styles.permNumText, notifStatus === 'granted' && styles.permNumTextDone]}>
                    {notifStatus === 'granted' ? '✓' : '1'}
                  </Text>
                </View>
                <Text style={styles.permTitle}>NOTIFICATIONS</Text>
              </View>
              <Text style={styles.permDesc}>
                {notifStatus === 'granted'
                  ? 'Granted. Challenges will arrive as alerts.'
                  : 'Challenges arrive as alerts. Without this you will never see one.'}
              </Text>
              {notifStatus !== 'granted' && (
                <TouchableOpacity style={styles.permBtn} onPress={requestNotifications} activeOpacity={0.85}>
                  <Text style={styles.permBtnText}>ALLOW NOTIFICATIONS →</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.permCard, usageOpened && styles.permCardDone]}>
              <View style={styles.permHead}>
                <View style={[styles.permNum, usageOpened && styles.permNumDone]}>
                  <Text style={[styles.permNumText, usageOpened && styles.permNumTextDone]}>
                    {usageOpened ? '✓' : '2'}
                  </Text>
                </View>
                <Text style={styles.permTitle}>USAGE ACCESS</Text>
              </View>
              <Text style={styles.permDesc}>
                Lets IRONMIND see which app is open so it knows when to fire. Find IRONMIND in the
                list and turn it on.
              </Text>
              <TouchableOpacity style={styles.permBtn} onPress={openUsageAccess} activeOpacity={0.85}>
                <Text style={styles.permBtnText}>
                  {usageOpened ? 'OPEN SETTINGS AGAIN' : 'OPEN USAGE ACCESS →'}
                </Text>
              </TouchableOpacity>
            </View>
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
              {step === TOTAL_STEPS ? 'START TRAINING' : 'CONTINUE'}
            </Text>
          )}
        </TouchableOpacity>
        {step === 1 && selectedApps.length === 0 && (
          <Text style={styles.hint}>Pick at least one app to continue.</Text>
        )}
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  progressTrack: { height: 3, backgroundColor: c.surfaceRaised, marginTop: 48 },
  progressFill: { height: '100%', backgroundColor: c.accent },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  stepCount: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  back: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },

  title: { color: c.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.md, marginBottom: spacing.xl },

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
  optionBody: { flex: 1 },
  optionLabel: { color: c.textSecondary, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  optionLabelWide: { flex: 1 },
  optionLabelOn: { color: c.textPrimary },
  optionSub: { color: c.textTertiary, fontSize: 11, marginTop: 3 },

  appIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  appIconText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },

  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  checkOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkGlyph: { color: c.accentContrast, fontSize: 11, fontWeight: '900' },

  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  radioOn: { borderColor: c.accent },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent },

  impactCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent,
    padding: spacing.xl,
    marginTop: spacing.lg,
    alignItems: 'center',
    ...cardShadow,
  },
  impactNum: { color: c.accent, fontSize: 56, fontWeight: '900', letterSpacing: -2 },
  impactLabel: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginTop: -spacing.xs },
  impactSub: { color: c.textTertiary, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: spacing.md },

  permCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  permCardDone: { borderColor: c.accentDim },
  permHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  permNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permNumDone: { backgroundColor: c.accent },
  permNumText: { color: c.textSecondary, fontSize: 12, fontWeight: '900' },
  permNumTextDone: { color: c.accentContrast },
  permTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  permDesc: { color: c.textTertiary, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  permBtn: {
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.sm,
    paddingVertical: 13,
    alignItems: 'center',
  },
  permBtnText: { color: c.textPrimary, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  cta: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.3 },
  ctaText: { color: c.accentContrast, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  hint: { color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
