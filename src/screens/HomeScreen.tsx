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
import { useScreenTime, formatMinutes, trackedTotal, todayKey } from '../hooks/useScreenTime';
import { AppIcon } from '../components/AppIcon';
import { spacing, radius, type, cardShadow, glowFor, Palette } from '../theme';

interface HomeProps {
  stats: UserStats;
  history: ChallengeItem[];
  dailyChallengeLimit: number;
  onNavigate: (state: TrainingState) => void;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const getTodayCount = (history: ChallengeItem[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return history.filter((i) => i.timestamp >= today.getTime()).length;
};

const getTodaySuccess = (history: ChallengeItem[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return history.filter((i) => i.timestamp >= today.getTime() && i.wasSuccessful).length;
};

const getTodayBarIndex = (): number => {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
};

const timeAgo = (ts: number) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
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

export const HomeScreen: React.FC<HomeProps> = ({ stats, history, dailyChallengeLimit, onNavigate }) => {  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<any>(null);
  useTabScrollReset('HOME', scrollRef);
  const { coins, streakFreezes } = usePro();
  const [showShop, setShowShop] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(RECENT_PAGE);
  const firedToday = useFiredToday(history.length + dailyChallengeLimit);
  const { paused, remaining } = usePause();
  const { screenTime, tracked, week, trackedToday } = useScreenTime();

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

  const todayCount = getTodayCount(history);
  const todaySuccess = getTodaySuccess(history);
  const firedRemaining = Math.max(dailyChallengeLimit - Math.max(firedToday ?? 0, todayCount), 0);
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
    if (i === todayBarIdx) return trackedToday;
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return trackedTotal(week.find((w) => w.date === todayKey(d))?.apps ?? [], tracked);
  });
  const maxWeek = Math.max(...weekMinutes, 1);
  const pastDays = week.filter((w) => w.date < todayKey()).map((w) => trackedTotal(w.apps, tracked));
  const average = pastDays.length ? pastDays.reduce((a, b) => a + b, 0) / pastDays.length : null;
  const compare =
    average === null
      ? { text: 'On the apps you track', better: false, worse: false }
      : trackedToday > average
      ? { text: `Above your daily average of ${formatMinutes(average)}`, better: false, worse: true }
      : { text: `Under your daily average of ${formatMinutes(average)}`, better: true, worse: false };
  const streakStr = String(stats.currentStreak);
  const rxnDisplay = stats.bestReactionTime > 0 ? `${stats.bestReactionTime.toFixed(2)}s` : '—';
  const xpPct = Math.min(((stats.currentXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100, 100);

  const getInitials = () => {
    if (fbUser?.displayName) {
      return fbUser.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'IM';
  };

  return (
    <FlatList
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      data={history.slice(0, visibleCount)}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={() => (
        <>
          <View style={styles.header}>
            <View style={styles.brand}>
              <Image source={require('../../assets/icon.png')} style={styles.logoBox} />
              <Text style={styles.brandName}>IRONMIND</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.freezeChip} onPress={() => setShowShop(true)} activeOpacity={0.8}>
                <Text style={styles.freezeChipText}>❄ {streakFreezes}</Text>
              </TouchableOpacity>
              <Text style={styles.dateText}>{dateStr}</Text>
              <TouchableOpacity style={styles.avatarBtn} onPress={() => onNavigate('PROFILE')} activeOpacity={0.8}>
                {fbUser?.photoURL ? (
                  <Image source={{ uri: fbUser.photoURL }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarBtnText}>{getInitials()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />
            <View style={styles.heroTopRow}>
              <Text style={styles.metaChipText}>SCREEN TIME TODAY</Text>
              <Text style={styles.metaChipText}>WK {weekNum}</Text>
            </View>

            <Text style={styles.stValue}>{formatMinutes(trackedToday)}</Text>
            <Text style={[styles.stCompare, compare.better ? styles.stBetter : compare.worse ? styles.stWorse : null]}>
              {compare.text}
            </Text>

            {trackedRows.length > 0 && (
              <View style={styles.stApps}>
                {trackedRows.map((row) => (
                  <View key={row.app} style={styles.stAppRow}>
                    <AppIcon app={row.app} style={styles.stAppIcon} textStyle={styles.stAppIconText} />
                    <Text style={styles.stAppName} numberOfLines={1}>{row.app}</Text>
                    <View style={styles.stAppBarBg}>
                      <View style={[styles.stAppBarFill, { width: `${Math.max((row.minutes / maxAppMinutes) * 100, 3)}%` }]} />
                    </View>
                    <Text style={styles.stAppMinutes}>{formatMinutes(row.minutes)}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.barChart}>
              {weekMinutes.map((m, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[
                      styles.bar,
                      { height: Math.max((m / maxWeek) * 56, 4) },
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

          <View style={styles.halfRow}>
            <View style={styles.halfCard}>
              <View style={styles.halfHead}>
                <Text style={styles.todayLabel}>STREAK</Text>
                <View style={styles.lvBadge}>
                  <Text style={styles.lvText}>LV {stats.level}</Text>
                </View>
              </View>
              <Text style={styles.halfNum}>{streakStr}</Text>
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
              <Text style={[styles.todayRemain, firedRemaining === 0 && styles.todayCapped]}>
                {firedRemaining > 0 ? `${todaySuccess} won · ${firedRemaining} left` : `${todaySuccess} won · done for today`}
              </Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            <View style={styles.quickCell}>
              <Text style={[styles.quickVal, styles.accentVal]}>{rxnDisplay}</Text>
              <Text style={styles.quickLabel}>BEST RXN</Text>
            </View>
            <View style={styles.quickCell}>
              <Text style={styles.quickVal}>{stats.totalChallenges}</Text>
              <Text style={styles.quickLabel}>TOTAL</Text>
            </View>
            <TouchableOpacity style={styles.shopCell} onPress={() => setShowShop(true)} activeOpacity={0.85}>
              <Text style={styles.coinVal}>◉ {coins}</Text>
              <Text style={styles.shopLabel}>SHOP →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>RECENT CHALLENGES</Text>
          </View>
        </>
      )}
      ListEmptyComponent={() => (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>NO CHALLENGES YET</Text>
          <Text style={styles.emptySub}>Enable app monitoring to start receiving challenges.</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => onNavigate('APPS')} activeOpacity={0.85}>
            <Text style={styles.emptyBtnText}>GO TO APPS →</Text>
          </TouchableOpacity>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.repRow}>
          <View style={[styles.repDot, item.wasSuccessful ? styles.repDotOk : styles.repDotFail]} />
          <Text style={styles.repApp}>{item.targetApp.toUpperCase()}</Text>
          <Text style={styles.repTime}>{timeAgo(item.timestamp)}</Text>
          <View style={styles.repRight}>
            <Text style={item.wasSuccessful ? styles.repReact : styles.repFailTime}>
              {item.elapsedTime > 0 ? `${item.elapsedTime.toFixed(2)}s` : '—'}
            </Text>
            {!item.wasSuccessful && <Text style={styles.repFailLabel}>FAIL</Text>}
          </View>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.repDivider} />}
      ListFooterComponent={() => (
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
          <ShopScreen visible={showShop} onClose={() => setShowShop(false)} />
        </>
      )}
    />
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: 50, paddingBottom: 30 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox: { width: 30, height: 30, borderRadius: radius.sm },
  brandName: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateText: { color: c.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
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
  freezeChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  freezeChipText: { color: '#9FD8FF', fontSize: 12, fontWeight: '900' },
  avatarBtn: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarBtnText: { color: c.accentContrast, fontSize: 11, fontWeight: '900' },

  heroCard: {
    backgroundColor: c.surface,
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
    backgroundColor: c.accent,
    opacity: 0.08,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  metaChipText: { color: c.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  lvBadge: { backgroundColor: c.accentMuted, paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.pill },
  lvText: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },

  stValue: { color: c.textPrimary, fontSize: 56, fontWeight: '900', letterSpacing: -2, lineHeight: 60 },
  stCompare: { color: c.textTertiary, fontSize: 12, fontWeight: '700', marginTop: 2, marginBottom: spacing.lg },
  stBetter: { color: c.accent },
  stWorse: { color: c.danger },
  stApps: { gap: 10, marginBottom: spacing.lg },
  stAppRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stAppIcon: { width: 26, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  stAppIconText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  stAppName: { color: c.textSecondary, fontSize: 12, fontWeight: '700', width: 78 },
  stAppBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.borderSubtle, overflow: 'hidden' },
  stAppBarFill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
  stAppMinutes: { color: c.textPrimary, fontSize: 12, fontWeight: '900', width: 52, textAlign: 'right' },

  halfRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  halfCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  halfHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 28 },
  halfNum: { color: c.textPrimary, fontSize: 40, fontWeight: '900', letterSpacing: -1.5, marginBottom: spacing.sm },

  xpBarBg: { height: 6, backgroundColor: c.borderSubtle, borderRadius: radius.pill, marginBottom: spacing.sm, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: c.accent, borderRadius: radius.pill },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpLabel: { color: c.textTertiary, fontSize: 11, fontWeight: '600' },
  xpNext: { color: c.accent, fontSize: 11, fontWeight: '700' },

  todayCard: {
    backgroundColor: c.surface,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...cardShadow,
  },
  todayLeft: { flex: 1 },
  todayLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.sm },
  todayCount: { color: c.textPrimary, fontSize: 34, fontWeight: '900', letterSpacing: -1, lineHeight: 36 },
  todayOf: { fontSize: 15, color: c.textTertiary, fontWeight: '600' },
  todayRemain: { color: c.textSecondary, fontSize: 11, marginTop: spacing.xs },
  todayDots: { flexDirection: 'row', gap: 7 },
  dotColumn: { gap: 7 },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: c.borderSubtle, borderWidth: 1, borderColor: c.border },
  dotSuccess: { backgroundColor: c.accent, borderColor: c.accent },
  dotFail: { backgroundColor: c.danger, borderColor: c.danger },

  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  quickCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  quickVal: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  quickLabel: { color: c.textTertiary, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: spacing.xs },
  accentVal: { color: c.accent },
  todayCapped: { color: c.danger },

  pausedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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

  shopCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent,
    paddingVertical: spacing.lg,
  },
  coinVal: { color: c.accent, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  shopLabel: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: spacing.xs },

  chartCard: {
    backgroundColor: c.surface,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  chartLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.lg },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 76, justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center', gap: spacing.sm },
  barTrack: { height: 56, justifyContent: 'flex-end' },
  bar: { width: 18, backgroundColor: c.borderSubtle, borderRadius: 9 },
  barToday: { backgroundColor: c.accent },
  dayLabel: { color: c.textFaint, fontSize: 10, fontWeight: '700' },
  dayToday: { color: c.accent },

  recentHeader: { paddingHorizontal: spacing.xl, marginBottom: spacing.xs },
  recentTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  repRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md },
  repDot: { width: 8, height: 8, borderRadius: radius.pill },
  repDotOk: { backgroundColor: c.accent },
  repDotFail: { backgroundColor: c.danger },
  repApp: { flex: 1, color: c.textPrimary, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  repTime: { color: c.textFaint, fontSize: 11, fontWeight: '600' },
  repRight: { alignItems: 'flex-end', minWidth: 52 },
  repReact: { color: c.accent, fontSize: 14, fontWeight: '900' },
  repFailTime: { color: c.textSecondary, fontSize: 14, fontWeight: '800' },
  repFailLabel: { color: c.danger, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginTop: 1 },
  repDivider: { height: 1, backgroundColor: c.borderSubtle, marginHorizontal: spacing.xl },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: spacing.xl },
  emptyTitle: { color: c.textFaint, fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: spacing.sm },
  emptySub: { color: c.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: spacing.xl },
  emptyBtn: { backgroundColor: c.accentMuted, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill },
  emptyBtnText: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
