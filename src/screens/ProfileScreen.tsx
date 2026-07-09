import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, NativeModules, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserStats } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';
import { API_BASE_URL } from '../config/api';

interface ProfileProps {
  stats: UserStats;
  onNavigate: (state: any) => void;
}

const APPS_LIST = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'X (Twitter)', 'Reddit', 'Snapchat'];
const ONBOARDING_URL = `${API_BASE_URL}/api/user/onboarding`;

const DIFFICULTIES: { id: DifficultyLevel; label: string; desc: string }[] = [
  { id: 'EASY', label: 'EASY', desc: `${DIFFICULTY_WINDOW_SECONDS.EASY} second window — most forgiving` },
  { id: 'INTERMEDIATE', label: 'MEDIUM', desc: `${DIFFICULTY_WINDOW_SECONDS.INTERMEDIATE} second window` },
  { id: 'HARD', label: 'HARD', desc: `${DIFFICULTY_WINDOW_SECONDS.HARD} second window — fastest reflexes only` },
];

const getAchievements = (s: UserStats) => [
  { id: '01', title: 'FIRST STEP', desc: 'Completed your first challenge', done: s.totalChallenges >= 1 },
  { id: '02', title: 'SPEED DEMON', desc: 'Exit in under 3 seconds', done: s.bestReactionTime > 0 && s.bestReactionTime < 3.0 },
  { id: '03', title: 'REFLEXES OF STEEL', desc: 'Exit in under 1 second', done: s.bestReactionTime > 0 && s.bestReactionTime < 1.0 },
  { id: '04', title: 'WEEK ONE', desc: '7-day streak unbroken', done: s.longestStreak >= 7 },
  { id: '05', title: 'IRON DISCIPLINE', desc: '30-day streak', done: s.longestStreak >= 30 },
  { id: '06', title: 'CENTURY', desc: '100 challenges completed', done: s.totalChallenges >= 100 },
  { id: '07', title: 'PERFECT DAY', desc: 'All 5 daily challenges won', done: false },
  { id: '08', title: 'MARATHON', desc: '500 challenges completed', done: s.totalChallenges >= 500 },
];

export const ProfileScreen: React.FC<ProfileProps> = ({ stats }) => {
  const { fbUser } = useAuth();
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [editingApps, setEditingApps] = useState<boolean>(false);
  const [pendingApps, setPendingApps] = useState<string[]>([]);
  const [savingApps, setSavingApps] = useState<boolean>(false);

  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DEFAULT_DIFFICULTY);
  const [editingDifficulty, setEditingDifficulty] = useState<boolean>(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<DifficultyLevel>(DEFAULT_DIFFICULTY);
  const [savingDifficulty, setSavingDifficulty] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem('@ironmind_onboarding').then((raw) => {
      if (raw) {
        const data = JSON.parse(raw);
        if (data.targetApps) setMonitoredApps(data.targetApps);
        if (data.difficultyLevel) setDifficulty(data.difficultyLevel);
      }
    }).catch(() => {});
  }, []);

  const restartMonitor = (apps: string[], difficultyLevel: DifficultyLevel) => {
    if (Platform.OS !== 'android' || !NativeModules.UsageMonitor) return;
    NativeModules.UsageMonitor.stopMonitoring();
    if (apps.length > 0) {
      NativeModules.UsageMonitor.startMonitoring(apps, DIFFICULTY_WINDOW_SECONDS[difficultyLevel]);
    }
  };

  const syncOnboarding = (fields: { targetApps: string[]; difficultyLevel: DifficultyLevel; goals: string[] }) => {
    fetch(ONBOARDING_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: fbUser?.uid, ...fields }),
    }).catch(() => {});
  };

  const openAppEditor = () => {
    setPendingApps(monitoredApps);
    setEditingApps(true);
  };

  const togglePendingApp = (app: string) => {
    setPendingApps((prev) => (prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]));
  };

  const saveMonitoredApps = async () => {
    setSavingApps(true);
    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const data = raw ? JSON.parse(raw) : {};
      const updated = { ...data, targetApps: pendingApps };
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify(updated));
      setMonitoredApps(pendingApps);
      restartMonitor(pendingApps, data.difficultyLevel ?? difficulty);
      syncOnboarding({ targetApps: pendingApps, difficultyLevel: data.difficultyLevel ?? difficulty, goals: data.goals ?? [] });
    } catch {}
    setSavingApps(false);
    setEditingApps(false);
  };

  const openDifficultyEditor = () => {
    setPendingDifficulty(difficulty);
    setEditingDifficulty(true);
  };

  const saveDifficulty = async () => {
    setSavingDifficulty(true);
    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const data = raw ? JSON.parse(raw) : {};
      const updated = { ...data, difficultyLevel: pendingDifficulty };
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify(updated));
      setDifficulty(pendingDifficulty);
      restartMonitor(data.targetApps ?? monitoredApps, pendingDifficulty);
      syncOnboarding({ targetApps: data.targetApps ?? monitoredApps, difficultyLevel: pendingDifficulty, goals: data.goals ?? [] });
    } catch {}
    setSavingDifficulty(false);
    setEditingDifficulty(false);
  };

  const achievements = getAchievements(stats);
  const doneCount = achievements.filter((a) => a.done).length;
  const rankPct = Math.min(((stats.currentXP % 500) / 500) * 100, 100);
  const rxnDisplay = stats.bestReactionTime > 0 ? `${stats.bestReactionTime.toFixed(2)}s` : '—';
  const successRate = stats.totalChallenges > 0
    ? `${Math.round((stats.successCount / stats.totalChallenges) * 100)}%`
    : '—';

  const handleSignOut = async () => {
    try { await signOut(auth); } catch {}
  };

  const getInitials = () => {
    if (fbUser?.displayName) {
      return fbUser.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'IM';
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <Text style={styles.settingsGlyph}>⚙</Text>
      </View>

      <View style={styles.athleteCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.athleteBadge}>
            <Text style={styles.athleteBadgeText}>ATHLETE</Text>
          </View>
          <Text style={styles.athleteNo}>LV.{stats.level} · {stats.currentXP} XP</Text>
        </View>
        <View style={styles.cardBody}>
          {fbUser?.photoURL ? (
            <Image source={{ uri: fbUser.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarBox}>
              <Text style={styles.avatarLetters}>{getInitials()}</Text>
              <View style={styles.avatarDiag} />
            </View>
          )}
          <View style={styles.athleteDetails}>
            <Text style={styles.handleText} numberOfLines={1} adjustsFontSizeToFit>
              {fbUser?.displayName || 'IRON ATHLETE'}
            </Text>
            <Text style={styles.emailText}>{fbUser?.email || ''}</Text>
            <View style={styles.threeStats}>
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.currentStreak}</Text>
                <Text style={styles.tStatLabel}>STREAK</Text>
              </View>
              <View style={styles.tStatLine} />
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.longestStreak}</Text>
                <Text style={styles.tStatLabel}>BEST</Text>
              </View>
              <View style={styles.tStatLine} />
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.totalChallenges}</Text>
                <Text style={styles.tStatLabel}>TOTAL</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.rankLabelRow}>
        <Text style={styles.rankLabel}>RANK PROGRESS → LV.{stats.level + 1}</Text>
        <Text style={styles.rankPct}>{Math.round(rankPct)}%</Text>
      </View>
      <View style={styles.rankBarBg}>
        <View style={[styles.rankBarFill, { width: `${rankPct}%` }]} />
      </View>

      <View style={styles.quickRow}>
        {[
          { label: 'CHALLENGES', val: String(stats.totalChallenges) },
          { label: 'BEST RXN', val: rxnDisplay, accent: true },
          { label: 'SUCCESS', val: successRate },
          { label: 'LONGEST', val: `${stats.longestStreak}d` },
        ].map((s) => (
          <View key={s.label} style={styles.quickStat}>
            <Text style={[styles.quickStatVal, s.accent && styles.accentVal]}>{s.val}</Text>
            <Text style={styles.quickStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        <Text style={styles.achieveCount}>{doneCount} / {achievements.length}</Text>
      </View>

      <View style={styles.achieveGrid}>
        {achievements.map((a) => (
          <View key={a.id} style={[styles.achieveCard, !a.done && styles.achieveCardLocked]}>
            <View style={styles.achieveTopRow}>
              <Text style={[styles.achieveId, a.done && styles.achieveIdDone]}>#{a.id}</Text>
              {a.done && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={[styles.achieveTitle, !a.done && styles.achieveTitleLocked]}>{a.title}</Text>
            <Text style={styles.achieveDesc}>{a.desc}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.settingsSection}>SETTINGS</Text>

      <TouchableOpacity style={styles.settingRow} onPress={openAppEditor} activeOpacity={0.7}>
        <Text style={styles.settingLabel}>MONITORED APPS</Text>
        <Text style={styles.settingValue}>
          {monitoredApps.length > 0 ? `${monitoredApps.length} APPS` : 'NONE'} ›
        </Text>
      </TouchableOpacity>

      {editingApps && (
        <View style={styles.appEditor}>
          {APPS_LIST.map((app) => {
            const on = pendingApps.includes(app);
            return (
              <TouchableOpacity
                key={app}
                style={[styles.appEditRow, on && styles.appEditRowOn]}
                onPress={() => togglePendingApp(app)}
                activeOpacity={0.75}
              >
                <Text style={[styles.appEditLabel, on && styles.appEditLabelOn]}>{app}</Text>
                <View style={[styles.appEditCheck, on && styles.appEditCheckOn]}>
                  {on && <Text style={styles.appEditCheckGlyph}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={styles.appEditActions}>
            <TouchableOpacity
              style={styles.appEditCancel}
              onPress={() => setEditingApps(false)}
              activeOpacity={0.8}
              disabled={savingApps}
            >
              <Text style={styles.appEditCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.appEditSave}
              onPress={saveMonitoredApps}
              activeOpacity={0.85}
              disabled={savingApps}
            >
              {savingApps ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.appEditSaveText}>SAVE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.settingRow} onPress={openDifficultyEditor} activeOpacity={0.7}>
        <Text style={styles.settingLabel}>CHALLENGE WINDOW</Text>
        <Text style={styles.settingValue}>
          {DIFFICULTY_WINDOW_SECONDS[difficulty]} SECONDS · {DIFFICULTIES.find((d) => d.id === difficulty)?.label} ›
        </Text>
      </TouchableOpacity>

      {editingDifficulty && (
        <View style={styles.appEditor}>
          {DIFFICULTIES.map((d) => {
            const on = pendingDifficulty === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.diffRow, on && styles.appEditRowOn]}
                onPress={() => setPendingDifficulty(d.id)}
                activeOpacity={0.75}
              >
                <View style={styles.diffLeft}>
                  <Text style={[styles.appEditLabel, on && styles.appEditLabelOn]}>{d.label}</Text>
                  <Text style={styles.diffDesc}>{d.desc}</Text>
                </View>
                <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
                  {on && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={styles.appEditActions}>
            <TouchableOpacity
              style={styles.appEditCancel}
              onPress={() => setEditingDifficulty(false)}
              activeOpacity={0.8}
              disabled={savingDifficulty}
            >
              <Text style={styles.appEditCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.appEditSave}
              onPress={saveDifficulty}
              activeOpacity={0.85}
              disabled={savingDifficulty}
            >
              {savingDifficulty ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.appEditSaveText}>SAVE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {[
        { label: 'DAILY CHALLENGES', value: '5 / DAY' },
        { label: 'NOTIFICATIONS', value: 'ON' },
      ].map((s) => (
        <TouchableOpacity key={s.label} style={styles.settingRow}>
          <Text style={styles.settingLabel}>{s.label}</Text>
          <Text style={styles.settingValue}>{s.value}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.settingRow} onPress={handleSignOut}>
        <Text style={styles.signOut}>SIGN OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 20,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  settingsGlyph: { color: '#555555', fontSize: 16 },

  athleteCard: { backgroundColor: '#111111', marginHorizontal: 16, borderRadius: 14, padding: 16, marginBottom: 20 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  athleteBadge: { backgroundColor: '#CCFF00', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  athleteBadgeText: { color: '#000000', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  athleteNo: { color: '#555555', fontSize: 10, fontWeight: '700' },

  cardBody: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  avatarBox: { width: 80, height: 80, backgroundColor: '#CCFF00', borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#CCFF00' },
  avatarLetters: { color: '#000000', fontSize: 28, fontWeight: '900', zIndex: 1 },
  avatarDiag: { position: 'absolute', top: -8, right: -8, width: 28, height: 110, backgroundColor: 'rgba(0,0,0,0.12)', transform: [{ rotate: '18deg' }] },
  athleteDetails: { flex: 1, overflow: 'hidden' },
  handleText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  emailText: { color: '#666666', fontSize: 11, fontWeight: '600', marginBottom: 10 },
  threeStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tStat: { alignItems: 'center' },
  tStatVal: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  tStatLabel: { color: '#444444', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  tStatLine: { width: 1, height: 22, backgroundColor: '#222222' },

  rankLabelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  rankLabel: { color: '#444444', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rankPct: { color: '#CCFF00', fontSize: 10, fontWeight: '800' },
  rankBarBg: { height: 4, backgroundColor: '#1A1A1A', marginHorizontal: 20, marginBottom: 24, overflow: 'hidden' },
  rankBarFill: { height: '100%', backgroundColor: '#CCFF00' },

  quickRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 32 },
  quickStat: {},
  quickStatVal: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  quickStatLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  accentVal: { color: '#CCFF00' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  achieveCount: { color: '#CCFF00', fontSize: 12, fontWeight: '800' },

  achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 36 },
  achieveCard: { width: '48%', backgroundColor: '#111111', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#1C1C1C' },
  achieveCardLocked: { opacity: 0.4 },
  achieveTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  achieveId: { color: '#333333', fontSize: 10, fontWeight: '800' },
  achieveIdDone: { color: '#CCFF00' },
  checkMark: { color: '#CCFF00', fontSize: 12, fontWeight: '900' },
  achieveTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', marginBottom: 4 },
  achieveTitleLocked: { color: '#444444' },
  achieveDesc: { color: '#444444', fontSize: 10, lineHeight: 14 },

  settingsSection: { color: '#444444', fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 8 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderColor: '#141414' },
  settingLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  settingValue: { color: '#666666', fontSize: 13, fontWeight: '600' },
  signOut: { color: '#FF1133', fontSize: 13, fontWeight: '900' },

  appEditor: { backgroundColor: '#0D0D0D', marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1A1A1A' },
  appEditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', borderWidth: 1, borderColor: '#1E1E21', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginBottom: 8 },
  appEditRowOn: { borderColor: '#CCFF00', backgroundColor: '#0B1800' },
  appEditLabel: { color: '#888888', fontSize: 14, fontWeight: '700' },
  appEditLabelOn: { color: '#CCFF00' },
  appEditCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#2E2E2E', justifyContent: 'center', alignItems: 'center' },
  appEditCheckOn: { backgroundColor: '#CCFF00', borderColor: '#CCFF00' },
  appEditCheckGlyph: { color: '#000000', fontSize: 11, fontWeight: '900' },
  appEditActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  appEditCancel: { flex: 1, height: 46, backgroundColor: '#1A1A1A', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  appEditCancelText: { color: '#888888', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  appEditSave: { flex: 1, height: 46, backgroundColor: '#CCFF00', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  appEditSaveText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#141414', borderWidth: 1, borderColor: '#1E1E21', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, marginBottom: 8 },
  diffLeft: { flex: 1, marginRight: 12 },
  diffDesc: { color: '#444444', fontSize: 11, marginTop: 3 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#2E2E2E', justifyContent: 'center', alignItems: 'center' },
  radioOuterOn: { borderColor: '#CCFF00' },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#CCFF00' },
});
