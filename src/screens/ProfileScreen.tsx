import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, NativeModules, Platform, ActivityIndicator, Alert, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { UserStats } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { usePro } from '../context/ProContext';
import { ProScreen } from './ProScreen';
import { StatusCard } from '../components/StatusCard';
import { signOut, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DEFAULT_DAILY_LIMIT, DailyLimitLevel } from '../constants/dailyLimit';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { XP_PER_LEVEL } from '../constants/leveling';
import { colors, spacing, radius, cardShadow } from '../theme';

interface ProfileProps {
  stats: UserStats;
  onSettingsChanged?: () => void;
  onNavigate: (state: any) => void;
}

const ONBOARDING_URL = `${API_BASE_URL}/api/user/onboarding`;
const DELETE_ACCOUNT_URL = `${API_BASE_URL}/api/user/account`;
const PHOTO_UPLOAD_URL = `${API_BASE_URL}/api/user/photo`;
const photoUrlFor = (uid: string) => `${API_BASE_URL}/api/public/photo/${uid}?t=${Date.now()}`;

const DIFFICULTIES: { id: DifficultyLevel; label: string; desc: string }[] = [
  { id: 'EASY', label: 'EASY', desc: `${DIFFICULTY_WINDOW_SECONDS.EASY} second window — most forgiving` },
  { id: 'INTERMEDIATE', label: 'MEDIUM', desc: `${DIFFICULTY_WINDOW_SECONDS.INTERMEDIATE} second window` },
  { id: 'HARD', label: 'HARD', desc: `${DIFFICULTY_WINDOW_SECONDS.HARD} second window — fastest reflexes only` },
];

const DAILY_LIMITS: { id: DailyLimitLevel; label: string; desc: string }[] = [
  { id: 'EASY', label: 'EASY', desc: `${DAILY_LIMIT_VALUES.EASY} challenges a day — fewest chances to slip up` },
  { id: 'MEDIUM', label: 'MEDIUM', desc: `${DAILY_LIMIT_VALUES.MEDIUM} challenges a day` },
  { id: 'HARD', label: 'HARD', desc: `${DAILY_LIMIT_VALUES.HARD} challenges a day — most exposure, most discipline required` },
];

const dailyLimitLevelFor = (limit: number): DailyLimitLevel => {
  const match = (Object.entries(DAILY_LIMIT_VALUES) as [DailyLimitLevel, number][]).find(([, v]) => v === limit);
  return match ? match[0] : DEFAULT_DAILY_LIMIT;
};

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

export const ProfileScreen: React.FC<ProfileProps> = ({ stats, onSettingsChanged }) => {
  const { fbUser, refreshUser } = useAuth();
  const { isPro, streakFreezes } = usePro();
  const [showPro, setShowPro] = useState<boolean>(false);
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);

  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DEFAULT_DIFFICULTY);
  const [editingDifficulty, setEditingDifficulty] = useState<boolean>(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<DifficultyLevel>(DEFAULT_DIFFICULTY);
  const [savingDifficulty, setSavingDifficulty] = useState<boolean>(false);

  const [dailyLimit, setDailyLimit] = useState<number>(DAILY_LIMIT_VALUES[DEFAULT_DAILY_LIMIT]);
  const [editingDailyLimit, setEditingDailyLimit] = useState<boolean>(false);
  const [pendingDailyLimit, setPendingDailyLimit] = useState<DailyLimitLevel>(DEFAULT_DAILY_LIMIT);
  const [savingDailyLimit, setSavingDailyLimit] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.getItem('@ironmind_onboarding').then((raw) => {
      if (raw) {
        const data = JSON.parse(raw);
        if (data.targetApps) setMonitoredApps(data.targetApps);
        if (data.difficultyLevel) setDifficulty(data.difficultyLevel);
        if (data.dailyChallengeLimit) setDailyLimit(data.dailyChallengeLimit);
      }
    }).catch(() => {});
  }, []);

  const restartMonitor = (apps: string[], difficultyLevel: DifficultyLevel, dailyChallengeLimit: number) => {
    if (Platform.OS !== 'android' || !NativeModules.UsageMonitor) return;
    NativeModules.UsageMonitor.stopMonitoring();
    if (apps.length > 0) {
      NativeModules.UsageMonitor.startMonitoring(apps, DIFFICULTY_WINDOW_SECONDS[difficultyLevel], dailyChallengeLimit);
    }
  };

  const syncOnboarding = (fields: { targetApps: string[]; difficultyLevel: DifficultyLevel; dailyChallengeLimit: number; goals: string[] }) => {
    authedFetch(ONBOARDING_URL, {
      method: 'POST',
      body: JSON.stringify({
        ...fields,
        email: fbUser?.email,
        displayName: fbUser?.displayName,
        photoURL: fbUser?.photoURL,
      }),
    }).catch(() => {});
  };

  const openDifficultyEditor = () => {
    if (editingDifficulty) { setEditingDifficulty(false); return; }
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
      const effectiveApps = data.targetApps ?? monitoredApps;
      const effectiveDailyLimit = data.dailyChallengeLimit ?? dailyLimit;
      restartMonitor(effectiveApps, pendingDifficulty, effectiveDailyLimit);
      syncOnboarding({ targetApps: effectiveApps, difficultyLevel: pendingDifficulty, dailyChallengeLimit: effectiveDailyLimit, goals: data.goals ?? [] });
      onSettingsChanged?.();
    } catch {}
    setSavingDifficulty(false);
    setEditingDifficulty(false);
  };

  const openDailyLimitEditor = () => {
    if (editingDailyLimit) { setEditingDailyLimit(false); return; }
    setPendingDailyLimit(dailyLimitLevelFor(dailyLimit));
    setEditingDailyLimit(true);
  };

  const saveDailyLimit = async () => {
    setSavingDailyLimit(true);
    try {
      const resolvedLimit = DAILY_LIMIT_VALUES[pendingDailyLimit];
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const data = raw ? JSON.parse(raw) : {};
      const updated = { ...data, dailyChallengeLimit: resolvedLimit };
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify(updated));
      setDailyLimit(resolvedLimit);
      const effectiveApps = data.targetApps ?? monitoredApps;
      const effectiveDifficulty = data.difficultyLevel ?? difficulty;
      restartMonitor(effectiveApps, effectiveDifficulty, resolvedLimit);
      syncOnboarding({ targetApps: effectiveApps, difficultyLevel: effectiveDifficulty, dailyChallengeLimit: resolvedLimit, goals: data.goals ?? [] });
      onSettingsChanged?.();
    } catch {}
    setSavingDailyLimit(false);
    setEditingDailyLimit(false);
  };

  const achievements = getAchievements(stats);
  const doneCount = achievements.filter((a) => a.done).length;
  const rankPct = Math.min(((stats.currentXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100, 100);
  const rxnDisplay = stats.bestReactionTime > 0 ? `${stats.bestReactionTime.toFixed(2)}s` : '—';
  const successRate = stats.totalChallenges > 0
    ? `${Math.round((stats.successCount / stats.totalChallenges) * 100)}%`
    : '—';

  const handleSignOut = async () => {
    try { await signOut(auth); } catch {}
  };

  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);

  const performDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await authedFetch(DELETE_ACCOUNT_URL, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Alert.alert('Could not delete account', body.message ?? 'Try again.');
        setDeletingAccount(false);
        return;
      }
      await AsyncStorage.multiRemove([
        '@ironmind_stats_v2',
        '@ironmind_history_v2',
        '@ironmind_onboarded',
        '@ironmind_onboarding',
        '@ironmind_push_token',
        '@ironmind_last_uid',
      ]);
      await signOut(auth);
    } catch {
      Alert.alert('Could not delete account', 'Network error — try again.');
      setDeletingAccount(false);
    }
  };

  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [editingName, setEditingName] = useState<boolean>(false);
  const [pendingName, setPendingName] = useState<string>('');
  const [savingName, setSavingName] = useState<boolean>(false);

  const resyncIdentityToBackend = (displayName?: string | null, photoURL?: string | null) => {
    authedFetch(ONBOARDING_URL, {
      method: 'POST',
      body: JSON.stringify({ displayName, photoURL, email: fbUser?.email }),
    }).catch(() => {});
  };

  const handlePickPhoto = async () => {
    if (uploadingPhoto || !fbUser) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      setUploadingPhoto(true);
      const uploadRes = await authedFetch(PHOTO_UPLOAD_URL, {
        method: 'POST',
        body: JSON.stringify({ imageBase64: result.assets[0].base64, contentType: 'image/jpeg' }),
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        Alert.alert('Could not update photo', body.message ?? 'Try again.');
        setUploadingPhoto(false);
        return;
      }

      const newPhotoUrl = photoUrlFor(fbUser.uid);
      await updateProfile(auth.currentUser!, { photoURL: newPhotoUrl });
      await refreshUser();
      resyncIdentityToBackend(fbUser.displayName, newPhotoUrl);
    } catch (e) {
      Alert.alert('Could not update photo', 'Try again.');
    }
    setUploadingPhoto(false);
  };

  const openNameEditor = () => {
    setPendingName(fbUser?.displayName ?? '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = pendingName.trim();
    if (!trimmed || !fbUser) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(auth.currentUser!, { displayName: trimmed });
      await refreshUser();
      resyncIdentityToBackend(trimmed, fbUser.photoURL);
    } catch {
      Alert.alert('Could not update name', 'Try again.');
    }
    setSavingName(false);
    setEditingName(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account, streak, history, and friends. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: performDeleteAccount },
      ]
    );
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
      </View>

      <View style={styles.athleteCard}>
        <View style={styles.heroGlow} />
        <View style={styles.cardTopRow}>
          <View style={styles.athleteBadge}>
            <Text style={styles.athleteBadgeText}>ATHLETE</Text>
          </View>
          <Text style={styles.athleteNo}>LV {stats.level} · {stats.currentXP} XP</Text>
        </View>
        <View style={styles.cardBody}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} disabled={uploadingPhoto}>
            {uploadingPhoto ? (
              <View style={styles.avatarBox}><ActivityIndicator color="#000000" /></View>
            ) : fbUser?.photoURL ? (
              <Image source={{ uri: fbUser.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarBox}>
                <Text style={styles.avatarLetters}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}><Text style={styles.avatarEditBadgeText}>✎</Text></View>
          </TouchableOpacity>
          <View style={styles.athleteDetails}>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={pendingName}
                  onChangeText={setPendingName}
                  placeholder="Your name"
                  placeholderTextColor={colors.textFaint}
                  autoFocus
                  maxLength={40}
                  editable={!savingName}
                />
                <TouchableOpacity onPress={saveName} disabled={savingName} style={styles.nameSaveBtn}>
                  {savingName ? <ActivityIndicator color="#000000" size="small" /> : <Text style={styles.nameSaveBtnText}>✓</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={openNameEditor} activeOpacity={0.7}>
                <Text style={styles.handleText} numberOfLines={1} adjustsFontSizeToFit>
                  {fbUser?.displayName || 'IRON ATHLETE'} <Text style={styles.nameEditHint}>✎</Text>
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.emailText}>{fbUser?.email || ''}</Text>
            <View style={styles.threeStats}>
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.currentStreak}</Text>
                <Text style={styles.tStatLabel}>STREAK</Text>
              </View>
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.longestStreak}</Text>
                <Text style={styles.tStatLabel}>BEST</Text>
              </View>
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.totalChallenges}</Text>
                <Text style={styles.tStatLabel}>TOTAL</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rankLabelRow}>
          <Text style={styles.rankLabel}>NEXT · LV {stats.level + 1}</Text>
          <Text style={styles.rankPct}>{Math.round(rankPct)}%</Text>
        </View>
        <View style={styles.rankBarBg}>
          <View style={[styles.rankBarFill, { width: `${rankPct}%` }]} />
        </View>
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

      <TouchableOpacity
        style={[styles.proBanner, isPro && styles.proBannerActive]}
        onPress={() => setShowPro(true)}
        activeOpacity={0.85}
      >
        <View style={styles.proBannerBody}>
          <Text style={styles.proBannerTitle}>{isPro ? 'IRONMIND PRO' : 'UPGRADE TO PRO'}</Text>
          <Text style={styles.proBannerSub}>
            {isPro
              ? `${streakFreezes} streak ${streakFreezes === 1 ? 'freeze' : 'freezes'} remaining`
              : 'Streak protection, themes, elite badges, full analytics'}
          </Text>
        </View>
        <Text style={styles.proBannerArrow}>{isPro ? '✓' : '→'}</Text>
      </TouchableOpacity>

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

      <Text style={styles.settingsSection}>PERMISSIONS</Text>

      <StatusCard />

      <Text style={styles.settingsSection}>SETTINGS</Text>

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

      <TouchableOpacity style={styles.settingRow} onPress={openDailyLimitEditor} activeOpacity={0.7}>
        <Text style={styles.settingLabel}>DAILY CHALLENGES</Text>
        <Text style={styles.settingValue}>
          {dailyLimit} / DAY · {DAILY_LIMITS.find((d) => d.id === dailyLimitLevelFor(dailyLimit))?.label} ›
        </Text>
      </TouchableOpacity>

      {editingDailyLimit && (
        <View style={styles.appEditor}>
          {DAILY_LIMITS.map((d) => {
            const on = pendingDailyLimit === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.diffRow, on && styles.appEditRowOn]}
                onPress={() => setPendingDailyLimit(d.id)}
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
              onPress={() => setEditingDailyLimit(false)}
              activeOpacity={0.8}
              disabled={savingDailyLimit}
            >
              <Text style={styles.appEditCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.appEditSave}
              onPress={saveDailyLimit}
              activeOpacity={0.85}
              disabled={savingDailyLimit}
            >
              {savingDailyLimit ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.appEditSaveText}>SAVE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {[
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

      <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount} disabled={deletingAccount}>
        {deletingAccount ? (
          <ActivityIndicator color={colors.danger} size="small" />
        ) : (
          <Text style={styles.deleteAccount}>DELETE ACCOUNT</Text>
        )}
      </TouchableOpacity>

      <ProScreen visible={showPro} onClose={() => setShowPro(false)} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101403',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    ...cardShadow,
  },
  proBannerActive: { backgroundColor: colors.surface, borderColor: '#2E3D00' },
  proBannerBody: { flex: 1 },
  proBannerTitle: { color: colors.accent, fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  proBannerSub: { color: colors.textTertiary, fontSize: 11, marginTop: 4 },
  proBannerArrow: { color: colors.accent, fontSize: 16, fontWeight: '900' },

  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: 52,
    paddingBottom: spacing.xl,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },

  athleteCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...cardShadow,
  },
  heroGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accent,
    opacity: 0.08,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  athleteBadge: { backgroundColor: colors.accentMuted, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  athleteBadgeText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  athleteNo: { color: colors.textTertiary, fontSize: 11, fontWeight: '700' },

  cardBody: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', marginBottom: spacing.lg },
  avatarBox: { width: 76, height: 76, backgroundColor: colors.accent, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImage: { width: 76, height: 76, borderRadius: radius.lg },
  avatarLetters: { color: '#000000', fontSize: 26, fontWeight: '900' },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceRaised, borderWidth: 2, borderColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  avatarEditBadgeText: { color: colors.textPrimary, fontSize: 11 },

  nameEditHint: { color: colors.textFaint, fontSize: 14 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: { flex: 1, color: colors.textPrimary, fontSize: 18, fontWeight: '800', borderBottomWidth: 1, borderColor: colors.accent, paddingVertical: 2 },
  nameSaveBtn: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  nameSaveBtnText: { color: '#000000', fontSize: 14, fontWeight: '900' },
  athleteDetails: { flex: 1, overflow: 'hidden' },
  handleText: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  emailText: { color: colors.textTertiary, fontSize: 11, fontWeight: '600', marginBottom: spacing.md },
  threeStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  tStat: { alignItems: 'center' },
  tStatVal: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
  tStatLabel: { color: colors.textTertiary, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  rankLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  rankLabel: { color: colors.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rankPct: { color: colors.accent, fontSize: 10, fontWeight: '800' },
  rankBarBg: { height: 6, backgroundColor: colors.borderSubtle, borderRadius: radius.pill, overflow: 'hidden' },
  rankBarFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill },

  quickRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
  quickStat: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: spacing.lg },
  quickStatVal: { color: colors.textPrimary, fontSize: 19, fontWeight: '900' },
  quickStatLabel: { color: colors.textTertiary, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, marginTop: spacing.xs },
  accentVal: { color: colors.accent },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  achieveCount: { color: colors.accent, fontSize: 12, fontWeight: '800' },

  achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.xxl },
  achieveCard: { width: '47.5%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  achieveCardLocked: { opacity: 0.4 },
  achieveTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  achieveId: { color: colors.textFaint, fontSize: 10, fontWeight: '800' },
  achieveIdDone: { color: colors.accent },
  checkMark: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  achieveTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '900', marginBottom: spacing.xs },
  achieveTitleLocked: { color: colors.textTertiary },
  achieveDesc: { color: colors.textFaint, fontSize: 10, lineHeight: 14 },

  settingsSection: { color: colors.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  settingLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  settingValue: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  signOut: { color: colors.danger, fontSize: 13, fontWeight: '900' },
  deleteAccount: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },

  appEditor: { backgroundColor: colors.surface, marginHorizontal: spacing.lg, marginTop: -spacing.xs, marginBottom: spacing.md, borderRadius: radius.lg, padding: spacing.md, ...cardShadow },
  appEditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm },
  appEditRowOn: { backgroundColor: colors.accentMuted },
  appEditLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
  appEditLabelOn: { color: colors.accent },
  appEditCheck: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  appEditCheckOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  appEditCheckGlyph: { color: '#000000', fontSize: 11, fontWeight: '900' },
  appEditActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  appEditCancel: { flex: 1, height: 46, backgroundColor: colors.surfaceRaised, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  appEditCancelText: { color: colors.textSecondary, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  appEditSave: { flex: 1, height: 46, backgroundColor: colors.accent, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  appEditSaveText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm },
  diffLeft: { flex: 1, marginRight: spacing.md },
  diffDesc: { color: colors.textTertiary, fontSize: 11, marginTop: spacing.xs },
  radioOuter: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  radioOuterOn: { borderColor: colors.accent },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
});
