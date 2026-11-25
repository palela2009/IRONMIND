import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTabScrollReset } from '../hooks/useTabScrollReset';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, NativeModules, AppState, Animated, Easing } from 'react-native';
import { appAlert } from '../components/AppDialog';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { UserStats, ChallengeItem } from '../types/training';
import { AnalyticsScreen } from './AnalyticsScreen';
import { HistoryScreen } from './HistoryScreen';
import { usePause, resumeMonitoring, resetPauseCache } from '../hooks/usePause';
import { syncAppMonitor, revokeBackgroundSync } from '../hooks/useAppMonitor';
import { useAuth } from '../context/AuthContext';
import { usePro } from '../context/ProContext';
import { ProScreen } from './ProScreen';
import { StatusCard } from '../components/StatusCard';
import { CoachCard } from '../components/CoachCard';
import { NotificationSettings } from '../components/NotificationSettings';
import { ELITE_BADGES, earnedBadges } from '../constants/badges';
import { rankForLevel } from '../constants/ranks';
import { frameById, nameEffectById, glowStyle } from '../constants/cosmetics';
import { signOut, updateProfile } from 'firebase/auth';
import { auth } from '../config/firebase';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DEFAULT_DAILY_LIMIT, DailyLimitLevel } from '../constants/dailyLimit';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { challengeDay, deviceTimeZone } from '../utils/challengeTime';
import { XP_PER_LEVEL } from '../constants/leveling';
import { spacing, radius, cardShadow, Palette } from '../theme';
import type { ShortVideoController } from '../hooks/useInstagramReelsTest';

interface ProfileProps {
  stats: UserStats;
  history: ChallengeItem[];
  challengeTimeZone: string;
  syncStatus: string;
  syncMessage: string;
  pendingCount: number;
  onRetrySync: () => Promise<void>;
  onSettingsChanged?: () => void;
  onNavigate: (state: any) => void;
  reelsTest?: ShortVideoController | null;
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

const hadPerfectDay = (history: ChallengeItem[], dailyLimit: number, zone: string): boolean => {
  const byDay = new Map<string, { total: number; won: number }>();
  for (const h of history) {
    if (h.counted === false) continue;
    const key = challengeDay(h.timestamp, zone);
    const e = byDay.get(key) ?? { total: 0, won: 0 };
    e.total += 1;
    if (h.wasSuccessful) e.won += 1;
    byDay.set(key, e);
  }
  for (const e of byDay.values()) {
    if (e.total >= dailyLimit && e.won === e.total) return true;
  }
  return false;
};

const getAchievements = (s: UserStats, history: ChallengeItem[], dailyLimit: number, zone: string) => [
  { id: '01', title: 'FIRST STEP', desc: 'Completed your first challenge', done: s.totalChallenges >= 1 },
  { id: '02', title: 'SPEED DEMON', desc: 'Exit in under 5 seconds', done: s.bestReactionTime > 0 && s.bestReactionTime < 5.0 },
  { id: '03', title: 'REFLEXES OF STEEL', desc: 'Exit in under 3 seconds', done: s.bestReactionTime > 0 && s.bestReactionTime < 3.0 },
  { id: '04', title: 'ON A ROLL', desc: '5 challenges won in a row', done: s.longestStreak >= 5 },
  { id: '05', title: 'IRON DISCIPLINE', desc: '15 challenges won in a row', done: s.longestStreak >= 15 },
  { id: '06', title: 'DEDICATED', desc: '50 challenges completed', done: s.totalChallenges >= 50 },
  { id: '07', title: 'PERFECT DAY', desc: `All ${dailyLimit} daily challenges won`, done: hadPerfectDay(history, dailyLimit, zone) },
  { id: '08', title: 'CENTURY', desc: '100 challenges completed', done: s.totalChallenges >= 100 },
];

export const ProfileScreen: React.FC<ProfileProps> = ({
  stats,
  history,
  challengeTimeZone,
  onSettingsChanged,
  onNavigate,
  syncStatus,
  syncMessage,
  pendingCount,
  onRetrySync,
  reelsTest,
}) => {
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<any>(null);
  useTabScrollReset('PROFILE', scrollRef);
  const palette = useTheme();

  const { fbUser, refreshUser } = useAuth();
  const { isPro, isOwner, streakFreezes, equippedFrame, equippedNameEffect } = usePro();
  const [showPro, setShowPro] = useState<boolean>(false);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const { paused, remaining } = usePause();
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);

  const [difficulty, setDifficulty] = useState<DifficultyLevel>(DEFAULT_DIFFICULTY);
  const [editingDifficulty, setEditingDifficulty] = useState<boolean>(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<DifficultyLevel>(DEFAULT_DIFFICULTY);
  const [savingDifficulty, setSavingDifficulty] = useState<boolean>(false);

  const [dailyLimit, setDailyLimit] = useState<number>(DAILY_LIMIT_VALUES[DEFAULT_DAILY_LIMIT]);
  const [editingDailyLimit, setEditingDailyLimit] = useState<boolean>(false);
  const [pendingDailyLimit, setPendingDailyLimit] = useState<DailyLimitLevel>(DEFAULT_DAILY_LIMIT);
  const [savingDailyLimit, setSavingDailyLimit] = useState<boolean>(false);

  const framePulse = useRef(new Animated.Value(1)).current;
  const frame = frameById(equippedFrame);
  const nameFx = nameEffectById(equippedNameEffect);
  const rank = rankForLevel(stats.level);

  useEffect(() => {
    if (equippedFrame !== 'galactic') {
      framePulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(framePulse, { toValue: 1.045, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(framePulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [equippedFrame]);

  const loadSettings = useCallback(() => {
    AsyncStorage.getItem('@ironmind_onboarding').then((raw) => {
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.targetApps) setMonitoredApps(data.targetApps);
      if (data.difficultyLevel) setDifficulty(data.difficultyLevel);
      if (data.dailyChallengeLimit) setDailyLimit(data.dailyChallengeLimit);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadSettings();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') loadSettings();
    });
    return () => sub.remove();
  }, [loadSettings]);

  const syncOnboarding = (fields: {
    targetApps: string[];
    difficultyLevel: DifficultyLevel;
    dailyChallengeLimit: number;
    goals: string[];
    appLimits: any[];
    timeZone: string;
  }) => {
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
      await syncAppMonitor();
      syncOnboarding({
        targetApps: effectiveApps,
        difficultyLevel: pendingDifficulty,
        dailyChallengeLimit: effectiveDailyLimit,
        goals: data.goals ?? [],
        appLimits: data.appLimits ?? [],
        timeZone: data.timeZone ?? deviceTimeZone(),
      });
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
      await syncAppMonitor();
      syncOnboarding({
        targetApps: effectiveApps,
        difficultyLevel: effectiveDifficulty,
        dailyChallengeLimit: resolvedLimit,
        goals: data.goals ?? [],
        appLimits: data.appLimits ?? [],
        timeZone: data.timeZone ?? deviceTimeZone(),
      });
      onSettingsChanged?.();
    } catch {}
    setSavingDailyLimit(false);
    setEditingDailyLimit(false);
  };

  const achievements = getAchievements(stats, history, dailyLimit, challengeTimeZone);
  const doneCount = achievements.filter((a) => a.done).length;
  const earnedElite = earnedBadges(stats, isOwner);
  const rankPct = Math.min(((stats.currentXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100, 100);
  const rxnDisplay = stats.bestReactionTime > 0 ? `${stats.bestReactionTime.toFixed(2)}s` : '—';
  const successRate = stats.totalChallenges > 0
    ? `${Math.round((stats.successCount / stats.totalChallenges) * 100)}%`
    : '—';

  const performSignOut = async () => {
    try {
      const uid = fbUser?.uid;
      const pushToken = await AsyncStorage.getItem('@ironmind_push_token');
      if (pushToken) {
        await authedFetch(`${API_BASE_URL}/api/save-token`, { method: 'DELETE', body: JSON.stringify({ pushToken }) }).catch(() => {});
      }
      await AsyncStorage.removeItem('@ironmind_push_token_synced').catch(() => {});
      await revokeBackgroundSync(uid);
      resetPauseCache();
      await GoogleSignin.signOut().catch(() => {});
      await signOut(auth);
    } catch {}
  };

  const handleSignOut = () => {
    appAlert('Sign out?', 'You can sign back in anytime. Background monitoring pauses until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void performSignOut() },
    ]);
  };

  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);

  const performDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await authedFetch(DELETE_ACCOUNT_URL, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        appAlert('Could not delete account', body.message ?? 'Try again.');
        setDeletingAccount(false);
        return;
      }
      const uid = fbUser?.uid;
      if (uid) {
        NativeModules.UsageMonitor?.clearSyncToken?.();
        await NativeModules.UsageMonitor?.clearAccountData?.(uid).catch?.(() => {});
      }
      const allKeys = await AsyncStorage.getAllKeys().catch(() => []);
      await AsyncStorage.multiRemove([
        ...(uid ? allKeys.filter((key) => key.startsWith(`@ironmind_shop_pending:${uid}:`) || key.includes(`:${uid}`)) : []),
        '@ironmind_pro_v1',
        '@ironmind_stats_v2',
        '@ironmind_history_v2',
        '@ironmind_onboarded',
        '@ironmind_onboarding',
        '@ironmind_push_token',
        '@ironmind_push_token_synced',
        '@ironmind_last_uid',
      ]).catch(() => {});
      resetPauseCache();
      await GoogleSignin.signOut().catch(() => {});
      await signOut(auth);
    } catch {
      appAlert('Could not delete account', 'Network error — try again.');
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
        appAlert('Permission needed', 'Allow photo library access to set a profile picture.');
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
        appAlert('Could not update photo', body.message ?? 'Try again.');
        setUploadingPhoto(false);
        return;
      }

      const newPhotoUrl = photoUrlFor(fbUser.uid);
      await updateProfile(auth.currentUser!, { photoURL: newPhotoUrl });
      await refreshUser();
      resyncIdentityToBackend(fbUser.displayName, newPhotoUrl);
    } catch {
      appAlert('Could not update photo', 'Try again.');
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
      appAlert('Could not update name', 'Try again.');
    }
    setSavingName(false);
    setEditingName(false);
  };

  const handleDeleteAccount = () => {
    appAlert(
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

  const frameBoxStyle = frame
    ? {
        borderWidth: 3,
        borderColor: frame.ring,
        ...(frame.glow ? { shadowColor: frame.glow, shadowOpacity: 0.85, shadowRadius: 10, elevation: 8 } : {}),
      }
    : null;

  return (
    <ScrollView ref={scrollRef} style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>YOU</Text>
      </View>

      <View style={styles.athleteCard}>
        <View style={[styles.cardAccentStrip, { backgroundColor: rank.color }]} />
        <View style={styles.cardTopRow}>
          <View style={[styles.athleteBadge, { borderColor: rank.color }]}>
            <Text style={[styles.athleteBadgeText, { color: rank.color }]}>{rank.name}</Text>
          </View>
          <Text style={styles.athleteNo}>LV {stats.level} · {stats.currentXP} XP</Text>
        </View>
        <View style={styles.cardBody}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} disabled={uploadingPhoto}>
            <Animated.View style={[styles.avatarWrap, frameBoxStyle, { transform: [{ scale: framePulse }] }]}>
              {uploadingPhoto ? (
                <View style={styles.avatarBox}><ActivityIndicator color={palette.accentContrast} /></View>
              ) : fbUser?.photoURL ? (
                <Image source={{ uri: fbUser.photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarLetters}>{getInitials()}</Text>
                </View>
              )}
            </Animated.View>
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
                  placeholderTextColor={palette.textFaint}
                  autoFocus
                  maxLength={40}
                  editable={!savingName}
                />
                <TouchableOpacity onPress={saveName} disabled={savingName} style={styles.nameSaveBtn}>
                  {savingName ? <ActivityIndicator color={palette.accentContrast} size="small" /> : <Text style={styles.nameSaveBtnText}>✓</Text>}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={openNameEditor} activeOpacity={0.7}>
                <Text
                  style={[
                    styles.handleText,
                    nameFx ? [{ color: nameFx.color }, glowStyle(nameFx.glow)] : null,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {fbUser?.displayName || 'IRON ATHLETE'} <Text style={styles.nameEditHint}>✎</Text>
                </Text>
              </TouchableOpacity>
            )}
            <Text style={styles.emailText} numberOfLines={1}>{fbUser?.email || ''}</Text>
            <Text style={styles.totalLine}>{stats.totalChallenges} lifetime challenges</Text>
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
          { label: 'STREAK', val: `🔥 ${stats.currentStreak}` },
          { label: 'BEST EXIT', val: rxnDisplay, accent: true },
          { label: 'WIN RATE', val: successRate },
          { label: 'LONGEST', val: String(stats.longestStreak) },
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
          <Text style={styles.proBannerTitle}>{isPro ? 'IRONMIND PRO' : 'UNLOCK IRONMIND PRO'}</Text>
          <Text style={styles.proBannerSub}>
            {isPro
              ? `${streakFreezes} streak ${streakFreezes === 1 ? 'freeze' : 'freezes'} remaining`
              : 'Freezes, themes, elite badges & full analytics — earn free via invites or coins'}
          </Text>
        </View>
        <Text style={styles.proBannerArrow}>{isPro ? '✓' : '→'}</Text>
      </TouchableOpacity>

      <CoachCard isPro={isPro} stats={stats} onUnlock={() => setShowPro(true)} />

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

      <TouchableOpacity
        style={styles.analyticsRow}
        onPress={() => (isPro ? setShowAnalytics(true) : setShowPro(true))}
        activeOpacity={0.85}
      >
        <View style={styles.analyticsBody}>
          <Text style={styles.analyticsTitle}>ADVANCED ANALYTICS</Text>
          <Text style={styles.analyticsSub}>
            {isPro
              ? '30-day trends, app breakdown and escape speed history'
              : 'Unlock 30-day charts and per-app trends with Pro'}
          </Text>
        </View>
        <Text style={styles.analyticsArrow}>{isPro ? '→' : '🔒'}</Text>
      </TouchableOpacity>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>ELITE BADGES</Text>
        <Text style={styles.achieveCount}>
          {isPro ? `${earnedElite.length} / ${ELITE_BADGES.length}` : 'PRO'}
        </Text>
      </View>

      {!isPro && (
        <TouchableOpacity style={styles.eliteLockRow} onPress={() => setShowPro(true)} activeOpacity={0.85}>
          <Text style={styles.eliteLockText}>
            Elite badges shine next to your name on the leaderboard. Unlock with Pro →
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.eliteGrid}>
        {ELITE_BADGES.map((b) => {
          const earned = isOwner || (isPro && b.earned(stats));
          return (
            <View key={b.id} style={[styles.eliteCard, !earned && styles.eliteCardLocked]}>
              <Text style={[styles.eliteGlyph, { color: earned ? b.color : palette.textFaint }]}>{b.glyph}</Text>
              <Text style={[styles.eliteName, earned && { color: b.color }]}>{b.name}</Text>
              <Text style={styles.eliteDesc}>{b.desc}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.settingsSection}>PERMISSIONS & MONITORING</Text>
      <StatusCard />

      <Text style={[styles.settingsSection, styles.settingsSpaced]}>SETTINGS</Text>

      {reelsTest && (
        <TouchableOpacity style={styles.settingRow} onPress={reelsTest.open} accessibilityRole="button">
          <View style={styles.settingCol}>
            <Text style={styles.settingLabel}>SCROLL-ONLY DETECTION</Text>
            <Text style={styles.pauseSub}>Only challenges when scrolling Reels, TikTok or Shorts</Text>
          </View>
          <Text style={[styles.settingStatus, reelsTest.isActive && styles.settingStatusOn]}>
            {reelsTest.status} ›
          </Text>
        </TouchableOpacity>
      )}

      {paused && (
        <TouchableOpacity style={[styles.settingRow, styles.pauseRowActive]} onPress={resumeMonitoring} activeOpacity={0.8}>
          <View style={styles.settingCol}>
            <Text style={styles.pauseActiveLabel}>RESUME MONITORING</Text>
            <Text style={styles.pauseSub}>Paused · resumes automatically in {remaining}</Text>
          </View>
          <Text style={styles.pauseActiveLabel}>▶</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.settingRow} onPress={openDifficultyEditor} activeOpacity={0.7}>
        <Text style={styles.settingLabel}>CHALLENGE WINDOW</Text>
        <Text style={styles.settingValue}>
          {DIFFICULTY_WINDOW_SECONDS[difficulty]}s · {DIFFICULTIES.find((d) => d.id === difficulty)?.label} ›
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
                <ActivityIndicator color={palette.accentContrast} size="small" />
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
                <ActivityIndicator color={palette.accentContrast} size="small" />
              ) : (
                <Text style={styles.appEditSaveText}>SAVE</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {(syncStatus === 'offline' || syncStatus === 'error') && (
        <TouchableOpacity style={styles.settingRow} onPress={onRetrySync}>
          <View style={styles.settingCol}>
            <Text style={styles.settingLabel}>PROGRESS NOT SYNCED</Text>
            <Text style={styles.pauseSub}>
              {syncStatus === 'error' ? syncMessage : pendingCount ? `${pendingCount} results saved on this phone` : 'Tap to reconnect'}
            </Text>
          </View>
          <Text style={styles.settingValue}>RETRY ›</Text>
        </TouchableOpacity>
      )}
      <NotificationSettings />

      <TouchableOpacity style={styles.settingRow} onPress={handleSignOut}>
        <Text style={styles.signOut}>SIGN OUT</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount} disabled={deletingAccount}>
        {deletingAccount ? (
          <ActivityIndicator color={palette.danger} size="small" />
        ) : (
          <Text style={styles.deleteAccount}>DELETE ACCOUNT</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.settingRow} onPress={() => setShowHistory(true)} activeOpacity={0.8}>
        <Text style={styles.settingLabel}>THE STORY OF IRONMIND</Text>
        <Text style={styles.settingValue}>›</Text>
      </TouchableOpacity>

      <ProScreen
        visible={showPro}
        onClose={() => setShowPro(false)}
        onOpenFriends={() => {
          setShowPro(false);
          onNavigate('FRIENDS');
        }}
        onOpenHome={() => {
          setShowPro(false);
          onNavigate('HOME');
        }}
      />

      <HistoryScreen visible={showHistory} onClose={() => setShowHistory(false)} />

      <AnalyticsScreen
        visible={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        history={history}
        stats={stats}
      />
    </ScrollView>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: spacing.lg, paddingBottom: 48 },

  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  headerTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },

  athleteCard: {
    backgroundColor: c.surface,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardAccentStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.9 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  athleteBadge: { borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.surfaceRaised },
  athleteBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  athleteNo: { color: c.textTertiary, fontSize: 11, fontWeight: '800' },

  cardBody: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', marginBottom: spacing.lg },
  avatarWrap: { width: 78, height: 78, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarBox: { width: '100%', height: '100%', backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarLetters: { color: c.accentContrast, fontSize: 26, fontWeight: '900' },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: c.surfaceRaised, borderWidth: 2, borderColor: c.surface, justifyContent: 'center', alignItems: 'center' },
  avatarEditBadgeText: { color: c.textPrimary, fontSize: 11 },

  nameEditHint: { color: c.textTertiary, fontSize: 14 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: { flex: 1, color: c.textPrimary, fontSize: 18, fontWeight: '800', borderBottomWidth: 1, borderColor: c.accent, paddingVertical: 2 },
  nameSaveBtn: { width: 28, height: 28, borderRadius: radius.pill, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },
  nameSaveBtnText: { color: c.accentContrast, fontSize: 14, fontWeight: '900' },
  athleteDetails: { flex: 1, overflow: 'hidden' },
  handleText: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  emailText: { color: c.textTertiary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  totalLine: { color: c.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 6 },

  rankLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  rankLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rankPct: { color: c.accent, fontSize: 10, fontWeight: '900' },
  rankBarBg: { height: 6, backgroundColor: c.borderSubtle, borderRadius: radius.pill, overflow: 'hidden' },
  rankBarFill: { height: '100%', backgroundColor: c.accent, borderRadius: radius.pill },

  quickRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  quickStat: { flex: 1, alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingVertical: spacing.md },
  quickStatVal: { color: c.textPrimary, fontSize: 17, fontWeight: '900' },
  quickStatLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.3, marginTop: 4 },
  accentVal: { color: c.accent },

  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accentMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...cardShadow,
  },
  proBannerActive: { backgroundColor: c.surface, borderColor: c.accentDim },
  proBannerBody: { flex: 1, marginRight: spacing.sm },
  proBannerTitle: { color: c.accent, fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  proBannerSub: { color: c.textSecondary, fontSize: 11, marginTop: 4, lineHeight: 16 },
  proBannerArrow: { color: c.accent, fontSize: 16, fontWeight: '900' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  achieveCount: { color: c.accent, fontSize: 12, fontWeight: '800' },

  achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.xl },
  achieveCard: { width: '48%', flexGrow: 1, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.md },
  achieveCardLocked: { opacity: 0.5 },
  achieveTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  achieveId: { color: c.textTertiary, fontSize: 10, fontWeight: '800' },
  achieveIdDone: { color: c.accent },
  checkMark: { color: c.accent, fontSize: 12, fontWeight: '900' },
  achieveTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '900', marginBottom: spacing.xs },
  achieveTitleLocked: { color: c.textSecondary },
  achieveDesc: { color: c.textTertiary, fontSize: 11, lineHeight: 15 },

  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  analyticsBody: { flex: 1, marginRight: spacing.sm },
  analyticsTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  analyticsSub: { color: c.textTertiary, fontSize: 11, marginTop: 3, lineHeight: 16 },
  analyticsArrow: { color: c.accent, fontSize: 15, fontWeight: '900' },

  eliteLockRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: c.accentMuted,
  },
  eliteLockText: { color: c.accent, fontSize: 11, lineHeight: 16, fontWeight: '700' },

  eliteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  eliteCard: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  eliteCardLocked: { opacity: 0.5 },
  eliteGlyph: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  eliteName: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.4, textAlign: 'center' },
  eliteDesc: { color: c.textTertiary, fontSize: 10, lineHeight: 13, textAlign: 'center', marginTop: 3 },

  settingsSection: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  settingsSpaced: { marginTop: spacing.xl },
  settingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  settingCol: { flex: 1, marginRight: spacing.sm },
  settingLabel: { color: c.textPrimary, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  settingValue: { color: c.textSecondary, fontSize: 12, fontWeight: '700', flexShrink: 1, marginLeft: 'auto', textAlign: 'right' },
  settingStatus: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  settingStatusOn: { color: c.accent },
  pauseRowActive: { backgroundColor: c.accentMuted, borderColor: c.accent },
  pauseActiveLabel: { color: c.accent, fontSize: 13, fontWeight: '900' },
  pauseSub: { color: c.textTertiary, fontSize: 11, marginTop: 3 },
  pauseChoices: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  pauseChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
  },
  pauseChipText: { color: c.textPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  signOut: { color: c.danger, fontSize: 13, fontWeight: '900' },
  deleteAccount: { color: c.textTertiary, fontSize: 12, fontWeight: '700' },

  appEditor: { backgroundColor: c.surface, marginHorizontal: spacing.lg, marginTop: -spacing.xs, marginBottom: spacing.md, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: c.border, ...cardShadow },
  appEditRowOn: { backgroundColor: c.accentMuted },
  appEditLabel: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },
  appEditLabelOn: { color: c.accent },
  appEditActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  appEditCancel: { flex: 1, height: 46, backgroundColor: c.surfaceRaised, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  appEditCancelText: { color: c.textSecondary, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  appEditSave: { flex: 1, height: 46, backgroundColor: c.accent, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  appEditSaveText: { color: c.accentContrast, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  diffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: c.surfaceRaised, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderRadius: radius.md, marginBottom: spacing.sm },
  diffLeft: { flex: 1, marginRight: spacing.md },
  diffDesc: { color: c.textTertiary, fontSize: 11, marginTop: spacing.xs },
  radioOuter: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 2, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  radioOuterOn: { borderColor: c.accent },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent },
});
