import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTabScrollReset } from '../hooks/useTabScrollReset';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, NativeModules, Platform, AppState } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { UserStats, ChallengeItem, TrainingState } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { usePro } from '../context/ProContext';
import { ShopScreen } from './ShopScreen';
import { usePause, resumeMonitoring } from '../hooks/usePause';
import { XP_PER_LEVEL } from '../constants/leveling';
import { useScreenTime, formatMinutes, todayKey } from '../hooks/useScreenTime';
import { totalUsageMinutes } from '../utils/screenTime';
import { AppIcon } from '../components/AppIcon';
import { challengeDay } from '../utils/challengeTime';
import { colorForApp, SHORT_VIDEO_APPS } from '../constants/apps';
import { rankForLevel } from '../constants/ranks';
import { frameById } from '../constants/cosmetics';
import { spacing, radius, cardShadow, Palette } from '../theme';
import type { ShortVideoController } from '../hooks/useInstagramReelsTest';

interface HomeProps {
  stats: UserStats;
  history: ChallengeItem[];
  dailyChallengeLimit: number;
  challengeTimeZone: string;
  reportedHours?: number | null;
  reelsTest?: ShortVideoController | null;
  onNavigate: (state: TrainingState) => void;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const getTodayCount = (history: ChallengeItem[], zone: string): number =>
  history.filter((item) => item.counted !== false && challengeDay(item.timestamp, zone) === challengeDay(Date.now(), zone)).length;

const getTodaySuccess = (history: ChallengeItem[], zone: string): number =>
  history.filter((item) => item.counted !== false && item.wasSuccessful && challengeDay(item.timestamp, zone) === challengeDay(Date.now(), zone)).length;

const getTodayBarIndex = (): number => {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
};

const timeAgo = (ts: number) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
};

const kindBadgeFor = (kind?: ChallengeItem['challengeKind']): string | null => {
  if (kind === 'instagram_reels') return 'REELS';
  if (kind === 'facebook_reels') return 'FB REELS';
  if (kind === 'tiktok_feed') return 'TIKTOK';
  if (kind === 'youtube_shorts') return 'SHORTS';
  if (kind === 'snapchat_spotlight') return 'SPOTLIGHT';
  return null;
};

const gradeForExit = (seconds: number): { label: string; hot: boolean } => {
  if (seconds > 0 && seconds < 1.5) return { label: '⚡ GODLIKE', hot: true };
  if (seconds > 0 && seconds < 2.5) return { label: 'SHARP', hot: true };
  return { label: 'WIN', hot: false };
};

const coachLineFor = (
  totalToday: number,
  average: number | null,
  streak: number,
  bestRxn: number,
  todaySuccess: number,
  dailyLimit: number,
): string => {
  if (dailyLimit > 0 && todaySuccess >= dailyLimit) {
    return 'Perfect day locked in. The feed took an L today.';
  }
  if (bestRxn > 0 && bestRxn < 1.5 && streak >= 3) {
    return `${bestRxn.toFixed(2)}s record exit & ${streak} streak. Unreal reflexes.`;
  }
  if (average !== null && totalToday > 0 && totalToday < average * 0.8) {
    return `${formatMinutes(average - totalToday)} under your daily average — protect that lead tonight.`;
  }
  if (average !== null && totalToday > average * 1.15) {
    return 'Above your daily average today. Snap out fast on the very next challenge.';
  }
  if (streak >= 5) {
    return `${streak} straight wins. Stay sharp — most streaks die on autopilot.`;
  }
  if (streak === 0) {
    return 'One clean exit starts a new run. Next alert is yours.';
  }
  return 'Every quick exit rewires the reflex. Stack another win today.';
};

const useFiredToday = (refreshKey: number): number | null => {
  const [fired, setFired] = useState<number | null>(null);

  const read = useCallback(async () => {
    if (Platform.OS !== 'android' || !NativeModules.UsageMonitor?.getChallengeCountToday) return;
    try {
      const result = await NativeModules.UsageMonitor.getChallengeCountToday();
      setFired(result.fired);
    } catch {}
  }, []);

  useEffect(() => {
    read();
  }, [read, refreshKey]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') read();
    });
    return () => sub.remove();
  }, [read]);

  return fired;
};

const DOTS_PER_COLUMN = 5;
const RECENT_PAGE = 5;

export const HomeScreen: React.FC<HomeProps> = ({
  stats,
  history,
  dailyChallengeLimit,
  challengeTimeZone,
  reportedHours,
  reelsTest,
  onNavigate,
}) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const scrollRef = useRef<any>(null);
  useTabScrollReset('HOME', scrollRef);
  const { coins, streakFreezes, equippedFrame } = usePro();
  const [showShop, setShowShop] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(RECENT_PAGE);
  const firedToday = useFiredToday(history.length + dailyChallengeLimit);
  const { paused, remaining } = usePause();
  const { screenTime, tracked, week, totalToday, trackedToday, limits, loading: screenTimeLoading } = useScreenTime();
  const { fbUser } = useAuth();

  const now = new Date();
  const dateStr = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const dayOfWeek = now.getDay();
  const daysSinceMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMon);
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const weekNum = String(Math.ceil((dayOfYear + start.getDay() + 1) / 7)).padStart(2, '0');

  const todayCount = getTodayCount(history, challengeTimeZone);
  const todaySuccess = getTodaySuccess(history, challengeTimeZone);
  const firedRemaining = Math.max(dailyChallengeLimit - Math.max(firedToday ?? 0, todayCount), 0);
  const isPerfectToday = dailyChallengeLimit > 0 && todaySuccess >= dailyChallengeLimit && todayCount === todaySuccess;
  const dotColumns = Array.from({ length: Math.ceil(dailyChallengeLimit / DOTS_PER_COLUMN) }, (_, col) =>
    Array.from({ length: Math.min(DOTS_PER_COLUMN, dailyChallengeLimit - col * DOTS_PER_COLUMN) }, (_, row) => col * DOTS_PER_COLUMN + row)
  );
  const todayBarIdx = getTodayBarIndex();
  const trackedRows = tracked
    .map((app) => ({ app, minutes: screenTime.find((s) => s.app === app)?.minutes ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 4);
  const maxAppMinutes = Math.max(...trackedRows.map((r) => r.minutes), 1);
  const weekMinutes = DAYS.map((_, i) => {
    if (i === todayBarIdx) return totalToday;
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return totalUsageMinutes(week.find((w) => w.date === todayKey(d))?.apps ?? []);
  });
  const maxWeek = Math.max(...weekMinutes, 1);
  const pastDays = week.filter((w) => w.date < todayKey()).slice(-7).map((w) => totalUsageMinutes(w.apps));
  const average = pastDays.length ? pastDays.reduce((a, b) => a + b, 0) / pastDays.length : null;
  const compare =
    average === null
      ? { text: 'Across all apps today', better: false, worse: false }
      : totalToday > average
      ? { text: `▲ Above daily avg (${formatMinutes(average)})`, better: false, worse: true }
      : { text: `▼ ${formatMinutes(Math.max(0, average - totalToday))} under avg (${formatMinutes(average)})`, better: true, worse: false };

  const reclaimedMins =
    reportedHours && reportedHours > 0 && !screenTimeLoading && totalToday < reportedHours * 60
      ? Math.round(reportedHours * 60 - totalToday)
      : 0;

  const rank = rankForLevel(stats.level);
  const frame = frameById(equippedFrame);
  const streakStr = String(stats.currentStreak);
  const rxnDisplay = stats.bestReactionTime > 0 ? `${stats.bestReactionTime.toFixed(2)}s` : '—';
  const winRateDisplay = stats.totalChallenges > 0 ? `${Math.round((stats.successCount / stats.totalChallenges) * 100)}%` : '—';
  const xpPct = Math.min(((stats.currentXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100, 100);
  const hasShortVideoTracked = tracked.some((a) => (SHORT_VIDEO_APPS as readonly string[]).includes(a));
  const cooldownMins = reelsTest?.cooldownRemainingMs ? Math.ceil(reelsTest.cooldownRemainingMs / 60_000) : 0;
  const coachLine = coachLineFor(totalToday, average, stats.currentStreak, stats.bestReactionTime, todaySuccess, dailyChallengeLimit);

  const getInitials = () => {
    if (fbUser?.displayName) {
      return fbUser.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'IM';
  };

  return (
    <>
      <FlatList
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        data={history.slice(0, visibleCount)}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <View style={styles.brand}>
                <Image source={require('../../assets/icon.png')} style={styles.logoBox} />
                <View>
                  <Text style={styles.brandName}>IRONMIND</Text>
                  <Text style={[styles.brandRank, { color: rank.color }]}>{rank.short} · LV {stats.level}</Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                <TouchableOpacity style={styles.freezeChip} onPress={() => setShowShop(true)} activeOpacity={0.8}>
                  <Text style={styles.freezeChipText}>❄ {streakFreezes}</Text>
                </TouchableOpacity>
                <Text style={styles.dateText}>{dateStr}</Text>
                <TouchableOpacity
                  style={[
                    styles.avatarBtn,
                    frame && { borderWidth: 2.5, borderColor: frame.ring },
                  ]}
                  onPress={() => onNavigate('PROFILE')}
                  activeOpacity={0.8}
                >
                  {fbUser?.photoURL ? (
                    <Image source={{ uri: fbUser.photoURL }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarBtnText}>{getInitials()}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroAccentStrip} />
              <View style={styles.heroTopRow}>
                <Text style={styles.metaChipText}>SCREEN TIME TODAY</Text>
                <View style={styles.weekPill}>
                  <Text style={styles.weekPillText}>WK {weekNum}</Text>
                </View>
              </View>

              <Text style={styles.stValue}>{screenTimeLoading ? '—' : formatMinutes(totalToday)}</Text>

              <View style={styles.compareRow}>
                <View style={[styles.comparePill, compare.better && styles.compareBetterBg, compare.worse && styles.compareWorseBg]}>
                  <Text style={[styles.stCompare, compare.better && styles.stBetter, compare.worse && styles.stWorse]}>
                    {compare.text}
                  </Text>
                </View>
                {reclaimedMins >= 15 && (
                  <View style={styles.reclaimPill}>
                    <Text style={styles.reclaimText}>⚡ {formatMinutes(reclaimedMins)} saved</Text>
                  </View>
                )}
              </View>

              {trackedRows.length > 0 && (
                <View style={styles.stApps}>
                  <View style={styles.trackedHeaderRow}>
                    <Text style={styles.trackedSummary}>TRACKED APPS</Text>
                    <Text style={styles.trackedSummaryVal}>{formatMinutes(trackedToday)}</Text>
                  </View>
                  {trackedRows.map((row) => {
                    const lim = limits[row.app] ?? 0;
                    const over = lim > 0 && row.minutes >= lim;
                    const left = lim > 0 && !over ? Math.ceil(lim - row.minutes) : 0;
                    const pct = lim > 0 ? Math.min((row.minutes / lim) * 100, 100) : Math.max((row.minutes / maxAppMinutes) * 100, 3);
                    const barColor = over ? palette.danger : colorForApp(row.app);
                    return (
                      <View key={row.app} style={styles.stAppRow}>
                        <AppIcon app={row.app} style={styles.stAppIcon} textStyle={styles.stAppIconText} />
                        <View style={styles.stAppMain}>
                          <View style={styles.stAppNameLine}>
                            <Text style={styles.stAppName} numberOfLines={1}>{row.app}</Text>
                            {over ? (
                              <Text style={styles.limitOverTag}>LIMIT REACHED</Text>
                            ) : left > 0 ? (
                              <Text style={styles.limitLeftTag}>{left}m left</Text>
                            ) : null}
                          </View>
                          <View style={styles.stAppBarBg}>
                            <View style={[styles.stAppBarFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: barColor }]} />
                          </View>
                        </View>
                        <Text style={[styles.stAppMinutes, over && styles.stWorse]}>{formatMinutes(row.minutes)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.barChart}>
                {weekMinutes.map((m, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[
                        styles.bar,
                        { height: Math.max((m / maxWeek) * 52, 4) },
                        i === todayBarIdx && styles.barToday,
                      ]} />
                    </View>
                    <Text style={[styles.dayLabel, i === todayBarIdx && styles.dayToday]}>{DAYS[i]}</Text>
                  </View>
                ))}
              </View>
            </View>

            {paused && (
              <TouchableOpacity style={styles.pausedBanner} onPress={resumeMonitoring} activeOpacity={0.85}>
                <View style={styles.pausedBody}>
                  <Text style={styles.pausedTitle}>MONITORING PAUSED</Text>
                  <Text style={styles.pausedSub}>No challenges will fire · resumes in {remaining}</Text>
                </View>
                <Text style={styles.pausedAction}>RESUME</Text>
              </TouchableOpacity>
            )}

            {reelsTest && hasShortVideoTracked && (
              reelsTest.isActive ? (
                <TouchableOpacity style={styles.scrollStrip} onPress={reelsTest.open} activeOpacity={0.85}>
                  <View style={styles.scrollDot} />
                  <Text style={styles.scrollStripText} numberOfLines={1}>
                    {`Scroll Challenges · ${reelsTest.countToday}/${reelsTest.maxPerDay} today${cooldownMins > 0 ? ` · ${cooldownMins}m cooldown` : ' · Ready'}`}
                  </Text>
                  <Text style={styles.scrollStripCta}>LIVE</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.activateScrollCard} onPress={reelsTest.open} activeOpacity={0.85}>
                  <View style={styles.activateScrollBody}>
                    <Text style={styles.activateScrollKicker}>
                      {reelsTest.needsSetup ? 'FINISH 1-STEP SETUP' : 'ACTIVATE SCROLL CHALLENGES'}
                    </Text>
                    <Text style={styles.activateScrollSub}>
                      Catches doomscrolling on Reels, TikTok, Shorts & Spotlight — silent during DMs & YouTube study.
                    </Text>
                  </View>
                  <View style={styles.activateScrollBtn}>
                    <Text style={styles.activateScrollBtnText}>TURN ON →</Text>
                  </View>
                </TouchableOpacity>
              )
            )}

            <View style={styles.halfRow}>
              <View style={styles.halfCard}>
                <View style={styles.halfHead}>
                  <Text style={styles.todayLabel}>STREAK</Text>
                  <View style={styles.lvBadge}>
                    <Text style={styles.lvText}>LV {stats.level}</Text>
                  </View>
                </View>
                <View style={styles.streakNumRow}>
                  <Text style={styles.halfNum}>{streakStr}</Text>
                  {stats.currentStreak >= 3 && <Text style={styles.streakFlame}>🔥</Text>}
                </View>
                <View style={styles.xpBarBg}>
                  <View style={[styles.xpBarFill, { width: `${xpPct}%` }]} />
                </View>
                <Text style={styles.xpLabel}>{stats.currentXP % XP_PER_LEVEL} / {XP_PER_LEVEL} XP</Text>
              </View>

              <View style={styles.halfCard}>
                <View style={styles.halfHead}>
                  <Text style={styles.todayLabel}>CHALLENGES</Text>
                  <View style={styles.todayDots}>
                    {dotColumns.map((column, c) => (
                      <View key={c} style={styles.dotColumn}>
                        {column.map((i) => (
                          <View
                            key={i}
                            style={[
                              styles.dot,
                              i < todaySuccess && styles.dotSuccess,
                              i >= todaySuccess && i < todayCount && styles.dotFail,
                            ]}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={styles.halfNum}>
                  {todayCount}<Text style={styles.todayOf}> / {dailyChallengeLimit}</Text>
                </Text>
                <Text style={[styles.todayRemain, isPerfectToday ? styles.todayPerfect : firedRemaining === 0 && styles.todayCapped]}>
                  {isPerfectToday
                    ? '★ Perfect day!'
                    : firedRemaining > 0
                    ? `${todaySuccess} won · ${firedRemaining} left`
                    : `${todaySuccess} won · done today`}
                </Text>
              </View>
            </View>

            <View style={styles.quickRow}>
              <View style={styles.quickCell}>
                <Text style={[styles.quickVal, styles.accentVal]}>{rxnDisplay}</Text>
                <Text style={styles.quickLabel}>BEST EXIT</Text>
              </View>
              <View style={styles.quickCell}>
                <Text style={styles.quickVal}>{winRateDisplay}</Text>
                <Text style={styles.quickLabel}>WIN RATE</Text>
              </View>
              <TouchableOpacity style={styles.shopCell} onPress={() => setShowShop(true)} activeOpacity={0.85}>
                <Text style={styles.coinVal}>◉ {coins}</Text>
                <Text style={styles.shopLabel}>SHOP →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.coachBanner}>
              <Text style={styles.coachKicker}>COACH</Text>
              <Text style={styles.coachText}>{coachLine}</Text>
            </View>

            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>RECENT CHALLENGES</Text>
              {history.length > 0 && <Text style={styles.recentCount}>{history.length} total</Text>}
            </View>
          </>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>SCROLL-ONLY PROTECTION READY</Text>
            <Text style={styles.emptySub}>Challenges only fire when you scroll Reels, TikTok, Shorts, or Spotlight — DMs, Snaps, and regular videos stay untouched.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => onNavigate('APPS')} activeOpacity={0.85}>
              <Text style={styles.emptyBtnText}>MANAGE APPS →</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item }) => {
          const kindBadge = kindBadgeFor(item.challengeKind);
          const grade = item.wasSuccessful ? gradeForExit(item.elapsedTime) : null;
          return (
            <View style={styles.repRow}>
              <AppIcon app={item.targetApp} style={styles.repIcon} textStyle={styles.repIconText} />
              <View style={styles.repMain}>
                <View style={styles.repTitleLine}>
                  <Text style={styles.repApp} numberOfLines={1}>{item.targetApp}</Text>
                  {kindBadge && (
                    <View style={styles.kindPill}>
                      <Text style={styles.kindPillText}>{kindBadge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.repTime}>{timeAgo(item.timestamp)}</Text>
              </View>
              <View style={styles.repRight}>
                <Text style={item.wasSuccessful ? styles.repReact : styles.repFailTime}>
                  {item.elapsedTime > 0 ? `${item.elapsedTime.toFixed(2)}s` : '—'}
                </Text>
                {item.wasSuccessful && grade ? (
                  <Text style={[styles.repGrade, grade.hot && styles.repGradeHot]}>{grade.label}</Text>
                ) : item.freezeUsed ? (
                  <Text style={styles.repFrozenLabel}>❄ SAVED</Text>
                ) : (
                  <Text style={styles.repFailLabel}>FAIL</Text>
                )}
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.repDivider} />}
        ListFooterComponent={(
          <>
            {history.length > visibleCount ? (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setVisibleCount((n) => n + 10)} activeOpacity={0.8}>
                <Text style={styles.moreText}>SHOW MORE · {history.length - visibleCount}</Text>
              </TouchableOpacity>
            ) : visibleCount > RECENT_PAGE ? (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setVisibleCount(RECENT_PAGE)} activeOpacity={0.8}>
                <Text style={styles.moreText}>SHOW LESS</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      />
      <ShopScreen visible={showShop} onClose={() => setShowShop(false)} />
    </>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: spacing.lg, paddingBottom: 32 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox: { width: 32, height: 32, borderRadius: radius.sm },
  brandName: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 1.4 },
  brandRank: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateText: { color: c.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  freezeChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  freezeChipText: { color: '#9FD8FF', fontSize: 12, fontWeight: '900' },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarBtnText: { color: c.accentContrast, fontSize: 11, fontWeight: '900' },

  heroCard: {
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
  heroAccentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: c.accent,
    opacity: 0.85,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  metaChipText: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  weekPill: {
    backgroundColor: c.surfaceRaised,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  weekPillText: { color: c.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },

  stValue: { color: c.textPrimary, fontSize: 54, fontWeight: '900', letterSpacing: -2, lineHeight: 58 },
  compareRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  comparePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.surfaceRaised },
  compareBetterBg: { backgroundColor: c.accentMuted },
  compareWorseBg: { backgroundColor: c.dangerMuted },
  stCompare: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  stBetter: { color: c.accent },
  stWorse: { color: c.danger },
  reclaimPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: c.accentMuted, borderWidth: 1, borderColor: c.accentDim },
  reclaimText: { color: c.accent, fontSize: 11, fontWeight: '900' },

  stApps: { gap: 12, marginBottom: spacing.lg },
  trackedHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackedSummary: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  trackedSummaryVal: { color: c.textSecondary, fontSize: 11, fontWeight: '900' },
  stAppRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stAppIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  stAppIconText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  stAppMain: { flex: 1, gap: 5 },
  stAppNameLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  stAppName: { color: c.textPrimary, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  limitLeftTag: { color: c.textTertiary, fontSize: 10, fontWeight: '800' },
  limitOverTag: { color: c.danger, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  stAppBarBg: { height: 6, borderRadius: 3, backgroundColor: c.borderSubtle, overflow: 'hidden' },
  stAppBarFill: { height: 6, borderRadius: 3 },
  stAppMinutes: { color: c.textPrimary, fontSize: 12, fontWeight: '900', width: 48, textAlign: 'right' },

  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 74, justifyContent: 'space-between', paddingTop: spacing.xs, borderTopWidth: 1, borderColor: c.borderSubtle },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: 52, justifyContent: 'flex-end' },
  bar: { width: 16, backgroundColor: c.surfaceRaised, borderRadius: 8 },
  barToday: { backgroundColor: c.accent },
  dayLabel: { color: c.textFaint, fontSize: 10, fontWeight: '800' },
  dayToday: { color: c.accent, fontWeight: '900' },

  scrollStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  scrollStripWarn: { borderColor: '#FFA23B', backgroundColor: 'rgba(255, 162, 59, 0.1)' },
  scrollDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  scrollDotWarn: { backgroundColor: '#FFA23B' },
  scrollStripText: { flex: 1, color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  scrollStripCta: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  scrollStripCtaWarn: { color: '#FFA23B' },
  activateScrollCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accent,
  },
  activateScrollBody: { flex: 1 },
  activateScrollKicker: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  activateScrollSub: { color: c.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  activateScrollBtn: { backgroundColor: c.accent, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9 },
  activateScrollBtnText: { color: c.accentContrast, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  halfRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  halfCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  halfHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 26 },
  streakNumRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  streakFlame: { fontSize: 22 },
  halfNum: { color: c.textPrimary, fontSize: 38, fontWeight: '900', letterSpacing: -1.5, marginBottom: spacing.sm },
  lvBadge: { backgroundColor: c.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  lvText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },

  xpBarBg: { height: 6, backgroundColor: c.borderSubtle, borderRadius: radius.pill, marginBottom: spacing.xs, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: c.accent, borderRadius: radius.pill },
  xpLabel: { color: c.textTertiary, fontSize: 11, fontWeight: '700' },

  todayLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs },
  todayOf: { fontSize: 15, color: c.textTertiary, fontWeight: '700' },
  todayRemain: { color: c.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  todayPerfect: { color: c.accent, fontWeight: '900' },
  todayCapped: { color: c.textTertiary },
  todayDots: { flexDirection: 'row', gap: 6 },
  dotColumn: { gap: 6 },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: c.borderSubtle, borderWidth: 1, borderColor: c.border },
  dotSuccess: { backgroundColor: c.accent, borderColor: c.accent },
  dotFail: { backgroundColor: c.danger, borderColor: c.danger },

  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  quickCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: spacing.md,
  },
  quickVal: { color: c.textPrimary, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  quickLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 3 },
  accentVal: { color: c.accent },

  shopCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent,
    paddingVertical: spacing.md,
  },
  coinVal: { color: c.accent, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  shopLabel: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginTop: 3 },

  coachBanner: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
  },
  coachKicker: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 3 },
  coachText: { color: c.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '600' },

  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: c.dangerMuted,
    borderWidth: 1,
    borderColor: c.danger,
  },
  pausedBody: { flex: 1 },
  pausedTitle: { color: c.danger, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  pausedSub: { color: c.textSecondary, fontSize: 11, marginTop: 3 },
  pausedAction: { color: c.danger, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  recentTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
  recentCount: { color: c.textTertiary, fontSize: 11, fontWeight: '700' },

  repRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: 14, gap: spacing.md },
  repIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  repIconText: { fontSize: 11, fontWeight: '900' },
  repMain: { flex: 1, gap: 2 },
  repTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repApp: { color: c.textPrimary, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  kindPill: {
    backgroundColor: c.surfaceRaised,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: c.border,
  },
  kindPillText: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  repTime: { color: c.textTertiary, fontSize: 11, fontWeight: '600' },
  repRight: { alignItems: 'flex-end', minWidth: 64 },
  repReact: { color: c.accent, fontSize: 14, fontWeight: '900' },
  repFailTime: { color: c.textSecondary, fontSize: 14, fontWeight: '800' },
  repGrade: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.4, marginTop: 1 },
  repGradeHot: { color: c.accent },
  repFrozenLabel: { color: '#9FD8FF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4, marginTop: 1 },
  repFailLabel: { color: c.danger, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginTop: 1 },
  repDivider: { height: 1, backgroundColor: c.borderSubtle, marginHorizontal: spacing.xl },

  moreBtn: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  moreText: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },

  emptyState: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: spacing.xl },
  emptyTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: spacing.sm },
  emptySub: { color: c.textTertiary, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: spacing.lg },
  emptyBtn: { backgroundColor: c.accentMuted, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: c.accentDim },
  emptyBtnText: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
