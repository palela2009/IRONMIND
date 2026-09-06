import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

interface OnboardingProps {
  onComplete: () => void;
}

const APPS_LIST = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'X (Twitter)', 'Reddit', 'Snapchat'];

const GOALS = [
  { id: 'doomscroll', label: 'QUIT DOOMSCROLLING', sub: 'Stop mindless feed browsing' },
  { id: 'focus', label: 'BUILD FOCUS', sub: 'Train deep work habits' },
  { id: 'habit', label: 'BREAK THE HABIT', sub: 'Rewire compulsive checking' },
  { id: 'sleep', label: 'IMPROVE SLEEP', sub: 'No screens before bed' },
  { id: 'time', label: 'RECLAIM TIME', sub: 'Get hours back every week' },
];
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { DEFAULT_DIFFICULTY } from '../constants/difficulty';
import { useAuth } from '../context/AuthContext';
import { syncAppMonitor } from '../hooks/useAppMonitor';

const ONBOARDING_URL = `${API_BASE_URL}/api/user/onboarding`;

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();

  const { fbUser } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [usageOpened, setUsageOpened] = useState<boolean>(false);

  useEffect(() => {
    if (step === 3) checkNotifStatus();
  }, [step]);

  const checkNotifStatus = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') setNotifStatus('granted');
    else if (status === 'denied') setNotifStatus('denied');
  };

  const toggleApp = (app: string) => {
    setSelectedApps((prev) =>
      prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]
    );
  };

  const handleRequestNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status === 'granted' ? 'granted' : 'denied');
  };

  const handleOpenUsageAccess = async () => {
    setUsageOpened(true);
    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings();
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    const data = {
      targetApps: selectedApps,
      goals: [selectedGoal],
      notificationsGranted: notifStatus === 'granted',
      usageAccessOpened: usageOpened,
    };

    try {
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify(data));
      await authedFetch(ONBOARDING_URL, {
        method: 'POST',
        body: JSON.stringify({
          targetApps: data.targetApps,
          goals: data.goals,
          difficultyLevel: DEFAULT_DIFFICULTY,
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

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <View style={styles.root}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <View style={styles.stepTag}>
        <Text style={styles.stepTagText}>{step} / 3</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {step === 1 && (
          <>
            <Text style={styles.title}>WHAT OWNS{'\n'}YOUR ATTENTION?</Text>
            <Text style={styles.sub}>
              Pick every app that pulls you in. When you open one, IRONMIND will fire a 10-second exit challenge.
            </Text>
            {APPS_LIST.map((app) => {
              const on = selectedApps.includes(app);
              return (
                <TouchableOpacity
                  key={app}
                  style={[styles.appRow, on && styles.appRowOn]}
                  onPress={() => toggleApp(app)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.appLabel, on && styles.appLabelOn]}>{app}</Text>
                  <View style={[styles.appCheck, on && styles.appCheckOn]}>
                    {on && <Text style={styles.checkGlyph}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>WHAT ARE YOU{'\n'}TRAINING FOR?</Text>
            <Text style={styles.sub}>Your goal shapes your mindset. Pick one.</Text>
            {GOALS.map((g) => {
              const on = selectedGoal === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.goalRow, on && styles.goalRowOn]}
                  onPress={() => setSelectedGoal(g.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.goalLeft}>
                    <Text style={[styles.goalLabel, on && styles.goalLabelOn]}>{g.label}</Text>
                    <Text style={styles.goalSub}>{g.sub}</Text>
                  </View>
                  <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
                    {on && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>GRANT{'\n'}PERMISSIONS.</Text>
            <Text style={styles.sub}>
              Two permissions are required. Tap each button — it takes less than 10 seconds total.
            </Text>

            <View style={[styles.permCard, notifStatus === 'granted' && styles.permCardDone]}>
              <View style={styles.permRow}>
                <View style={[styles.permNumBadge, notifStatus === 'granted' && styles.permNumBadgeDone]}>
                  <Text style={[styles.permNumText, notifStatus === 'granted' && styles.permNumTextDone]}>
                    {notifStatus === 'granted' ? '✓' : '01'}
                  </Text>
                </View>
                <View style={styles.permInfo}>
                  <Text style={styles.permTitle}>NOTIFICATIONS</Text>
                  <Text style={styles.permDesc}>
                    {notifStatus === 'granted'
                      ? 'Permission granted. Challenges will arrive as alerts.'
                      : 'Tap below — a dialog will appear. Tap "Allow".'}
                  </Text>
                </View>
              </View>
              {notifStatus !== 'granted' && (
                <TouchableOpacity style={styles.permAction} onPress={handleRequestNotifications} activeOpacity={0.85}>
                  <Text style={styles.permActionText}>ALLOW NOTIFICATIONS →</Text>
                </TouchableOpacity>
              )}
              {notifStatus === 'denied' && (
                <Text style={styles.permDenied}>
                  Denied. Go to phone Settings → Apps → IRONMIND → Notifications to enable manually.
                </Text>
              )}
            </View>

            <View style={[styles.permCard, usageOpened && styles.permCardPending]}>
              <View style={styles.permRow}>
                <View style={[styles.permNumBadge, usageOpened && styles.permNumBadgePending]}>
                  <Text style={[styles.permNumText, usageOpened && styles.permNumTextDone]}>
                    {usageOpened ? '→' : '02'}
                  </Text>
                </View>
                <View style={styles.permInfo}>
                  <Text style={styles.permTitle}>USAGE ACCESS</Text>
                  <Text style={styles.permDesc}>
                    {usageOpened
                      ? 'Settings opened. Find IRONMIND in the list and toggle it ON, then come back.'
                      : 'Tap below → Android Settings opens → find IRONMIND → toggle ON.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.permAction} onPress={handleOpenUsageAccess} activeOpacity={0.85}>
                <Text style={styles.permActionText}>
                  {usageOpened ? 'OPEN SETTINGS AGAIN →' : 'OPEN USAGE ACCESS SETTINGS →'}
                </Text>
              </TouchableOpacity>
              <View style={styles.usageNote}>
                <Text style={styles.usageNoteTitle}>WHY IS THIS NEEDED?</Text>
                <Text style={styles.usageNoteBody}>
                  Android doesn't let apps detect when you open Instagram automatically — unless you grant Usage Access. This is the only way IRONMIND knows when to send you a challenge.
                </Text>
              </View>
            </View>

            <View style={styles.skipNote}>
              <Text style={styles.skipNoteText}>
                You can grant these later in the APPS tab. Without them, challenges will not fire.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextBtn,
            step === 1 && selectedApps.length === 0 && styles.nextBtnDisabled,
            step === 2 && !selectedGoal && styles.nextBtnDisabled,
          ]}
          disabled={saving || (step === 1 && selectedApps.length === 0) || (step === 2 && !selectedGoal)}
          onPress={() => {
            if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
            else handleFinish();
          }}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={palette.accentContrast} />
          ) : (
            <Text style={styles.nextBtnText}>
              {step < 3 ? 'CONTINUE →' : "ALL SET — ENTER IRONMIND →"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  progressBar: { height: 2, backgroundColor: c.surfaceRaised },
  progressFill: { height: '100%', backgroundColor: c.accent },
  stepTag: { alignSelf: 'flex-end', paddingHorizontal: 20, paddingTop: 14, marginBottom: 4 },
  stepTagText: { color: c.textFaint, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },

  title: { color: c.textPrimary, fontSize: 34, fontWeight: '900', lineHeight: 40, letterSpacing: -0.5, marginBottom: 10 },
  sub: { color: c.textTertiary, fontSize: 13, lineHeight: 20, marginBottom: 28 },

  appRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.surfaceRaised, paddingHorizontal: 18, paddingVertical: 17, borderRadius: 14, marginBottom: 10 },
  appRowOn: { borderColor: c.accent, backgroundColor: c.accentMuted },
  appLabel: { color: c.textSecondary, fontSize: 16, fontWeight: '700' },
  appLabelOn: { color: c.accent },
  appCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  appCheckOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkGlyph: { color: c.accentContrast, fontSize: 12, fontWeight: '900' },

  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.surfaceRaised, paddingHorizontal: 18, paddingVertical: 16, borderRadius: 14, marginBottom: 10 },
  goalRowOn: { borderColor: c.accent, backgroundColor: c.accentMuted },
  goalLeft: { flex: 1, marginRight: 16 },
  goalLabel: { color: c.textSecondary, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  goalLabelOn: { color: c.accent },
  goalSub: { color: c.textFaint, fontSize: 11, marginTop: 3 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  radioOuterOn: { borderColor: c.accent },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent },

  permCard: { backgroundColor: c.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  permCardDone: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  permCardPending: { borderColor: c.border, backgroundColor: c.bg },
  permRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  permNumBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  permNumBadgeDone: { backgroundColor: c.accent },
  permNumBadgePending: { backgroundColor: c.accentDim },
  permNumText: { color: c.textSecondary, fontSize: 11, fontWeight: '900' },
  permNumTextDone: { color: c.accentContrast },
  permInfo: { flex: 1 },
  permTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  permDesc: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
  permAction: { backgroundColor: c.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  permActionText: { color: c.accentContrast, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  permDenied: { color: c.danger, fontSize: 11, marginTop: 10, lineHeight: 17 },

  usageNote: { marginTop: 14, borderTopWidth: 1, borderColor: c.border, paddingTop: 12 },
  usageNoteTitle: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  usageNoteBody: { color: c.textTertiary, fontSize: 12, lineHeight: 19 },

  skipNote: { backgroundColor: c.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: c.surfaceRaised },
  skipNoteText: { color: c.textFaint, fontSize: 12, lineHeight: 19, textAlign: 'center' },

  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 14, borderTopWidth: 1, borderColor: c.surface, backgroundColor: c.bg },
  backBtn: { width: 54, height: 56, backgroundColor: c.surface, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: c.surfaceRaised },
  backBtnText: { color: c.textPrimary, fontSize: 18, fontWeight: '900' },
  nextBtn: { flex: 1, height: 56, backgroundColor: c.accent, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: c.surfaceRaised },
  nextBtnText: { color: c.accentContrast, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
});
