import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { UserStats, ChallengeItem, TrainingState } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { XP_PER_LEVEL } from '../constants/leveling';

interface HomeProps {
  stats: UserStats;
  history: ChallengeItem[];
  onNavigate: (state: TrainingState) => void;
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MAX_DAILY = 5;

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

const getWeeklyBars = (history: ChallengeItem[]): number[] => {
  const bars = [0, 0, 0, 0, 0, 0, 0];
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysSinceMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysSinceMon);
  monday.setHours(0, 0, 0, 0);
  const mondayMs = monday.getTime();

  history.forEach((item) => {
    if (item.timestamp < mondayMs) return;
    const d = new Date(item.timestamp);
    let idx = d.getDay() - 1;
    if (idx < 0) idx = 6;
    bars[idx]++;
  });
  return bars;
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

export const HomeScreen: React.FC<HomeProps> = ({ stats, history, onNavigate }) => {
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
  const weekBars = getWeeklyBars(history);
  const maxBar = Math.max(...weekBars, 1);
  const todayBarIdx = getTodayBarIndex();
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
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      data={history}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={() => (
        <>
          <View style={styles.header}>
            <View style={styles.brand}>
              <Image source={require('../../assets/icon.png')} style={styles.logoBox} />
              <Text style={styles.brandName}>IRONMIND</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.dateText}>{dateStr}</Text>
              <TouchableOpacity style={styles.avatarBtn} onPress={() => onNavigate('PROFILE')}>
                {fbUser?.photoURL ? (
                  <Image source={{ uri: fbUser.photoURL }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarBtnText}>{getInitials()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.metaLine}>WK {weekNum} · {streakStr} STREAK</Text>

          <View style={styles.heroRow}>
            <Text style={styles.heroNum}>{streakStr}</Text>
            <View style={styles.heroRight}>
              <View style={styles.lvBadge}>
                <Text style={styles.lvText}>LV.{stats.level}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.streakLabel}>STREAK</Text>

          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpPct}%` }]} />
          </View>
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpLabel}>XP {stats.currentXP % XP_PER_LEVEL} / {XP_PER_LEVEL}</Text>
            <Text style={styles.xpNext}>NEXT LV.{stats.level + 1}</Text>
          </View>

          <View style={styles.todayCard}>
            <View style={styles.todayLeft}>
              <Text style={styles.todayLabel}>TODAY'S CHALLENGES</Text>
              <Text style={styles.todayCount}>
                {todaySuccess}<Text style={styles.todayOf}>/{todayCount} done</Text>
              </Text>
              <Text style={styles.todayRemain}>
                {MAX_DAILY - todayCount > 0
                  ? `${MAX_DAILY - todayCount} more may fire today`
                  : 'All challenges complete for today'}
              </Text>
            </View>
            <View style={styles.todayDots}>
              {Array.from({ length: MAX_DAILY }).map((_, i) => (
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
          </View>

          <View style={styles.quickRow}>
            <View style={styles.quickCell}>
              <Text style={styles.quickVal}>{stats.currentStreak}</Text>
              <Text style={styles.quickLabel}>STREAK</Text>
            </View>
            <View style={styles.quickDivider} />
            <View style={styles.quickCell}>
              <Text style={[styles.quickVal, styles.accentVal]}>{rxnDisplay}</Text>
              <Text style={styles.quickLabel}>BEST RXN</Text>
            </View>
            <View style={styles.quickDivider} />
            <View style={styles.quickCell}>
              <Text style={styles.quickVal}>{stats.totalChallenges}</Text>
              <Text style={styles.quickLabel}>TOTAL</Text>
            </View>
          </View>

          <View style={styles.chartSection}>
            <Text style={styles.chartLabel}>THIS WEEK · CHALLENGES</Text>
            <View style={styles.barChart}>
              {weekBars.map((h, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={[
                    styles.bar,
                    { height: Math.max((h / maxBar) * 72, 4) },
                    i === todayBarIdx && styles.barToday,
                  ]} />
                  <Text style={[styles.dayLabel, i === todayBarIdx && styles.dayToday]}>
                    {DAYS[i]}
                  </Text>
                </View>
              ))}
            </View>
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
          <TouchableOpacity style={styles.emptyBtn} onPress={() => onNavigate('APPS')}>
            <Text style={styles.emptyBtnText}>GO TO APPS →</Text>
          </TouchableOpacity>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.repRow}>
          <View style={[styles.repDot, item.wasSuccessful ? styles.repDotOk : styles.repDotFail]} />
          <Text style={styles.repApp}>{item.targetApp.toUpperCase()}</Text>
          <Text style={styles.repTime}>{timeAgo(item.timestamp)}</Text>
          {item.wasSuccessful ? (
            <Text style={styles.repReact}>{item.elapsedTime.toFixed(2)}s</Text>
          ) : (
            <Text style={styles.repFail}>FAIL</Text>
          )}
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.repDivider} />}
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { paddingTop: 50, paddingBottom: 30 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { width: 28, height: 28, borderRadius: 8 },
  brandName: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { color: '#555555', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  avatarBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCFF00', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarBtnText: { color: '#000000', fontSize: 10, fontWeight: '900' },

  metaLine: { color: '#555555', fontSize: 10, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 4 },

  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20 },
  heroNum: { color: '#FFFFFF', fontSize: 118, fontWeight: '900', letterSpacing: -6, lineHeight: 118 },
  heroRight: { paddingTop: 20 },
  lvBadge: { borderWidth: 1, borderColor: '#CCFF00', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  lvText: { color: '#CCFF00', fontSize: 12, fontWeight: '900' },

  streakLabel: { color: '#666666', fontSize: 11, fontWeight: '700', paddingHorizontal: 20, marginBottom: 14, letterSpacing: 0.3 },

  xpBarBg: { height: 3, backgroundColor: '#1A1A1A', marginHorizontal: 20, marginBottom: 4, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: '#CCFF00' },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  xpLabel: { color: '#444444', fontSize: 10, fontWeight: '600' },
  xpNext: { color: '#CCFF00', fontSize: 10, fontWeight: '700' },

  todayCard: {
    backgroundColor: '#111111',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1C1C1C',
  },
  todayLeft: { flex: 1 },
  todayLabel: { color: '#555555', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  todayCount: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 38 },
  todayOf: { fontSize: 16, color: '#555555', fontWeight: '600' },
  todayRemain: { color: '#444444', fontSize: 11, marginTop: 6 },
  todayDots: { gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2A2A2A' },
  dotSuccess: { backgroundColor: '#CCFF00', borderColor: '#CCFF00' },
  dotFail: { backgroundColor: '#FF1133', borderColor: '#FF1133' },

  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#141414',
  },
  quickCell: { flex: 1, alignItems: 'center' },
  quickDivider: { width: 1, backgroundColor: '#1A1A1A', marginVertical: 4 },
  quickVal: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  quickLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 3 },
  accentVal: { color: '#CCFF00' },

  stSection: { paddingHorizontal: 16, marginBottom: 20 },
  stTitle: { color: '#555555', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
  stEmpty: { color: '#333333', fontSize: 12, lineHeight: 18 },
  stRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  stLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 120 },
  stRank: { color: '#333333', fontSize: 10, fontWeight: '900', width: 18 },
  stApp: { color: '#AAAAAA', fontSize: 11, fontWeight: '800', letterSpacing: 0.2, flexShrink: 1 },
  stBarWrap: { flex: 1, height: 4, backgroundColor: '#1A1A1A', borderRadius: 2, overflow: 'hidden' },
  stBar: { height: '100%', backgroundColor: '#CCFF00', borderRadius: 2 },
  stTime: { color: '#CCFF00', fontSize: 12, fontWeight: '900', width: 44, textAlign: 'right' },

  chartSection: { paddingHorizontal: 20, marginBottom: 16 },
  chartLabel: { color: '#555555', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 84, justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center', gap: 7 },
  bar: { width: 26, backgroundColor: '#1C1C1C', borderRadius: 3 },
  barToday: { backgroundColor: '#CCFF00' },
  dayLabel: { color: '#3A3A3A', fontSize: 10, fontWeight: '700' },
  dayToday: { color: '#CCFF00' },

  recentHeader: { paddingHorizontal: 20, marginBottom: 4 },
  recentTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  repRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  repDot: { width: 8, height: 8, borderRadius: 4 },
  repDotOk: { backgroundColor: '#CCFF00' },
  repDotFail: { backgroundColor: '#FF1133' },
  repApp: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  repTime: { color: '#444444', fontSize: 11, fontWeight: '600' },
  repReact: { color: '#CCFF00', fontSize: 14, fontWeight: '900', width: 46, textAlign: 'right' },
  repFail: { color: '#FF1133', fontSize: 12, fontWeight: '900', width: 46, textAlign: 'right' },
  repDivider: { height: 1, backgroundColor: '#111111', marginHorizontal: 20 },

  emptyState: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { color: '#333333', fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  emptySub: { color: '#2A2A2A', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  emptyBtn: { borderWidth: 1, borderColor: '#CCFF00', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  emptyBtnText: { color: '#CCFF00', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
