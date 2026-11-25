import React, { useState, useMemo, useRef } from 'react';
import { useTabScrollReset } from '../hooks/useTabScrollReset';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Share, Image, Modal, RefreshControl } from 'react-native';
import { appAlert } from '../components/AppDialog';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';
import { useFriends } from '../hooks/useFriends';
import { useDuels, Duel, formatTimeLeft, formatAgo, DUEL_REACTIONS, reactionText, appsOf } from '../hooks/useDuels';
import { useScreenTime, formatMinutes, todayKey } from '../hooks/useScreenTime';
import { totalUsageMinutes } from '../utils/screenTime';
import { AppIcon } from '../components/AppIcon';
import { SwordsClash } from '../components/SwordsClash';
import { useInvites, daysLabel, inviteMessage } from '../hooks/useInvites';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { TrainingState, UserStats } from '../types/training';
import { rankForLevel, PODIUM } from '../constants/ranks';
import { Badge, topBadgeFor } from '../constants/badges';
import { frameById, nameEffectById, glowStyle, FREE_MAX_DUEL_STAKE, DUEL_STAKES } from '../constants/cosmetics';
import { usePro } from '../context/ProContext';

const DUEL_STAKE = 50;
const FREE_STAKE = 0;

type SubTab = 'BOARD' | 'DUELS' | 'INVITE';
type SortLane = 'TODAY' | 'STREAK' | 'SPEED';

const recentlyReacted = (iso: string | null): boolean =>
  !!iso && Date.now() - new Date(iso).getTime() < 60_000;

interface FriendsProps {
  stats: UserStats;
  isActive?: boolean;
  onNavigate: (state: TrainingState) => void;
  onOpenPro?: () => void;
}

interface Entry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  currentStreak: number;
  longestStreak: number;
  bestReactionTime: number;
  totalChallenges: number;
  level: number;
  currentXP: number;
  isMe: boolean;
  badge: Badge | null;
  frame: string | null;
  nameEffect: string | null;
  todayMinutes: number;
  hasTodayData: boolean;
  weekAvgMinutes: number;
  trackedApps: string[];
}

const EntryName: React.FC<{ entry: Entry; style: any }> = ({ entry, style }) => {
  const fx = nameEffectById(entry.nameEffect);
  return (
    <Text style={[style, fx ? [{ color: fx.color }, glowStyle(fx.glow)] : null]} numberOfLines={1}>
      {entry.isMe ? 'YOU' : entry.displayName}
    </Text>
  );
};

const abbrFor = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const PALETTE = ['#4C6EF5', '#12B886', '#F59F00', '#E64980', '#7048E8', '#15AABF', '#FA5252', '#833AB4'];
const colorFor = (uid: string): string => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
};

const Avatar: React.FC<{ entry: { uid: string; displayName: string; photoURL: string | null; frame?: string | null }; size: number; ring?: string }> = ({
  entry,
  size,
  ring,
}) => {
  const styles = useThemedStyles(makeStyles);
  const [failed, setFailed] = useState(false);
  const frame = frameById(entry.frame);
  const boxStyle = {
    width: size,
    height: size,
    borderRadius: size / 3.2,
    ...(frame
      ? {
          borderWidth: 3,
          borderColor: frame.ring,
          ...(frame.glow ? { shadowColor: frame.glow, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6 } : {}),
        }
      : ring
      ? { borderWidth: 2, borderColor: ring }
      : {}),
  };

  if (entry.photoURL && !failed) {
    return (
      <Image
        source={{ uri: entry.photoURL }}
        style={[styles.avatar, boxStyle]}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[styles.avatar, boxStyle, { backgroundColor: colorFor(entry.uid) }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{abbrFor(entry.displayName)}</Text>
    </View>
  );
};

const RankBadge: React.FC<{ level: number }> = ({ level }) => {
  const styles = useThemedStyles(makeStyles);
  const rank = rankForLevel(level);
  return (
    <View style={[styles.rankBadge, { borderColor: rank.color }]}>
      <Text style={[styles.rankBadgeText, { color: rank.color }]}>{rank.short}</Text>
    </View>
  );
};

export const FriendsScreen: React.FC<FriendsProps> = ({ stats, isActive = true, onNavigate, onOpenPro }) => {
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<any>(null);
  useTabScrollReset('FRIENDS', scrollRef);
  const palette = useTheme();

  const { fbUser } = useAuth();
  const { isPro, isOwner, coins, equippedFrame, equippedNameEffect, pinnedBadge } = usePro();
  const { code, friends, requests, loading, error, addByCode, acceptRequest, rejectRequest, removeFriend, refresh: refreshFriends } = useFriends(isActive);
  const { duels, challenge, respond, cancel: cancelDuel, react, refresh: refreshDuels } = useDuels(isActive);
  const [subTab, setSubTab] = useState<SubTab>('BOARD');
  const [sortLane, setSortLane] = useState<SortLane>('TODAY');
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { progress: invites, refresh: refreshInvites } = useInvites();
  const [refreshing, setRefreshing] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<'idle' | 'accepted' | 'pending' | 'err'>('idle');

  const { tracked: monitoredApps, totalToday, week } = useScreenTime();
  const myWeekAvg = useMemo(() => {
    const past = week.filter((w) => w.date < todayKey()).slice(-7).map((w) => totalUsageMinutes(w.apps));
    return past.length ? past.reduce((a, b) => a + b, 0) / past.length : totalToday;
  }, [week, totalToday]);

  const [profile, setProfile] = useState<Entry | null>(null);
  const [duelTarget, setDuelTarget] = useState<Entry | null>(null);
  const [duelStake, setDuelStake] = useState<number>(DUEL_STAKE);
  const [duelApps, setDuelApps] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [clashKey, setClashKey] = useState(0);

  const leaderboard = useMemo<Entry[]>(() => {
    const me: Entry = {
      uid: fbUser?.uid ?? 'me',
      displayName: fbUser?.displayName || 'You',
      photoURL: fbUser?.photoURL ?? null,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      bestReactionTime: stats.bestReactionTime,
      totalChallenges: stats.totalChallenges,
      level: stats.level,
      currentXP: stats.currentXP,
      isMe: true,
      badge: topBadgeFor(stats, isPro, isOwner, pinnedBadge),
      frame: equippedFrame,
      nameEffect: equippedNameEffect,
      todayMinutes: totalToday,
      hasTodayData: true,
      weekAvgMinutes: myWeekAvg,
      trackedApps: monitoredApps,
    };

    const others: Entry[] = friends.map((f) => ({
      uid: f.uid,
      displayName: f.displayName,
      photoURL: f.photoURL,
      currentStreak: f.currentStreak,
      longestStreak: f.longestStreak,
      bestReactionTime: f.bestReactionTime ?? 0,
      totalChallenges: f.totalChallenges,
      level: f.level,
      currentXP: f.currentXP,
      todayMinutes: f.todayMinutes ?? 0,
      hasTodayData: f.hasTodayData !== false,
      weekAvgMinutes: f.weekAvgMinutes ?? 0,
      trackedApps: f.trackedApps ?? [],
      isMe: false,
      badge: topBadgeFor(
        {
          currentStreak: f.currentStreak,
          longestStreak: f.longestStreak,
          bestReactionTime: f.bestReactionTime,
          totalChallenges: f.totalChallenges,
          successCount: f.successCount,
          currentXP: f.currentXP,
          level: f.level,
        },
        f.isPro,
        f.isOwner,
        f.pinnedBadge
      ),
      frame: f.frame,
      nameEffect: f.nameEffect,
    }));

    const all = [me, ...others];
    if (sortLane === 'STREAK') {
      return all.sort((a, b) => b.currentStreak - a.currentStreak || b.longestStreak - a.longestStreak || b.level - a.level);
    }
    if (sortLane === 'SPEED') {
      return all.sort((a, b) => {
        const aHas = a.bestReactionTime > 0 ? 0 : 1;
        const bHas = b.bestReactionTime > 0 ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;
        return a.bestReactionTime - b.bestReactionTime || b.currentStreak - a.currentStreak;
      });
    }
    return all.sort((a, b) => {
      if (a.hasTodayData !== b.hasTodayData) return a.hasTodayData ? -1 : 1;
      return a.todayMinutes - b.todayMinutes || b.currentStreak - a.currentStreak || b.level - a.level;
    });
  }, [fbUser?.uid, fbUser?.displayName, fbUser?.photoURL, stats, friends, isPro, isOwner, equippedFrame, equippedNameEffect, pinnedBadge, totalToday, myWeekAvg, monitoredApps, sortLane]);

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({ message: inviteMessage(code) });
    } catch {}
  };

  const handleAdd = async () => {
    if (!inputCode.trim()) return;
    setAdding(true);
    const outcome = await addByCode(inputCode.trim());
    setAdding(false);
    setAddResult(outcome === 'error' ? 'err' : outcome);
    if (outcome !== 'error') setInputCode('');
    setTimeout(() => setAddResult('idle'), 3000);
  };

  const handleAccept = async (id: string) => {
    const err = await acceptRequest(id);
    if (err) appAlert('Could not accept request', err);
  };

  const handleReject = async (id: string) => {
    const err = await rejectRequest(id);
    if (err) appAlert('Could not reject request', err);
  };

  const handleRemove = (uid: string, name: string) => {
    appAlert('Remove friend', `Remove ${name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeFriend(uid) },
    ]);
  };

  const openProfile = (entry: Entry) => setProfile(entry);

  const openDuel = (entry: Entry, presetApps?: string[], presetStake?: number) => {
    if (entry.isMe) return;
    if (monitoredApps.length === 0) {
      appAlert('No apps tracked', 'Pick at least one app in the APPS tab before starting a duel.');
      return;
    }
    setProfile(null);
    const cappedPreset = presetStake !== undefined && !isPro && presetStake > FREE_MAX_DUEL_STAKE ? DUEL_STAKE : presetStake;
    const nextStake = cappedPreset !== undefined
      ? (coins >= cappedPreset ? cappedPreset : FREE_STAKE)
      : (coins >= DUEL_STAKE ? DUEL_STAKE : FREE_STAKE);
    const validPreset = (presetApps ?? []).filter((a) => monitoredApps.includes(a));
    setDuelStake(nextStake);
    setDuelApps(validPreset.length > 0 ? validPreset : [monitoredApps[0]]);
    setDuelTarget(entry);
  };

  const openRematch = (d: Duel) => {
    const friendEntry = leaderboard.find((e) => e.uid === d.opponentUid);
    if (!friendEntry) {
      appAlert('Friend unavailable', 'You can only rematch people currently on your friends list.');
      return;
    }
    openDuel(friendEntry, appsOf(d), d.stake);
  };

  const toggleDuelApp = (app: string) =>
    setDuelApps((prev) => (prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]));

  const sendChallenge = async () => {
    if (!duelTarget || duelApps.length === 0) return;
    setSending(true);
    const err = await challenge(duelTarget.uid, duelApps, duelStake);
    setSending(false);
    setDuelTarget(null);
    if (err) {
      appAlert('Could not start duel', err);
      return;
    }
    setSubTab('DUELS');
    setClashKey((k) => k + 1);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshFriends(), refreshDuels(), refreshInvites()]);
    setRefreshing(false);
  };

  const handleCancelDuel = (d: Duel) => {
    const isActiveDuel = d.status === 'active';
    const pot = d.stake * 2;
    const title = isActiveDuel ? 'Forfeit this duel?' : 'Withdraw challenge?';
    const message = isActiveDuel
      ? pot > 0
        ? `Quitting an active duel counts as a forfeit. ${d.opponentName} wins immediately and takes the full ◉ ${pot} pot.`
        : `Quitting an active duel counts as a forfeit and awards the win to ${d.opponentName}.`
      : `Withdraw your pending duel challenge to ${d.opponentName}? No coins are charged.`;

    appAlert(title, message, [
      { text: isActiveDuel ? 'Stay in duel' : 'Keep pending', style: 'cancel' },
      {
        text: isActiveDuel ? 'Forfeit duel' : 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          const err = await cancelDuel(d.id);
          if (err) appAlert('Could not update duel', err);
        },
      },
    ]);
  };

  const handleReact = async (duelId: string, reaction: string) => {
    setReactingId(duelId);
    const err = await react(duelId, reaction);
    setReactingId(null);
    if (err) appAlert('Not sent', err);
  };

  const handleDuelResponse = async (id: string, action: 'accept' | 'decline') => {
    const err = await respond(id, action);
    if (err) appAlert(`Could not ${action} duel`, err);
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centerFill]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  const hasFriends = friends.length > 0;
  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);
  const podiumOrder = [1, 0, 2].filter((i) => i < podium.length);

  const incomingDuels = duels.filter((d) => d.status === 'pending' && d.incoming);
  const outgoingDuels = duels.filter((d) => d.status === 'pending' && !d.incoming);
  const activeDuels = duels.filter((d) => d.status === 'active');
  const settledDuels = duels
    .filter((d) => d.status === 'completed' || d.status === 'void' || d.status === 'cancelled')
    .slice(0, 6);
  const duelBadgeCount = incomingDuels.length + activeDuels.length;

  const laneValue = (entry: Entry) => {
    if (sortLane === 'STREAK') return `🔥 ${entry.currentStreak}`;
    if (sortLane === 'SPEED') return entry.bestReactionTime > 0 ? `${entry.bestReactionTime.toFixed(2)}s` : '—';
    return entry.hasTodayData ? formatMinutes(entry.todayMinutes) : '—';
  };

  const laneCaption = (entry: Entry) => {
    if (sortLane === 'STREAK') return 'STREAK';
    if (sortLane === 'SPEED') return 'BEST EXIT';
    return entry.hasTodayData ? 'TODAY' : 'NOT SYNCED';
  };

  const laneSubtitle =
    sortLane === 'STREAK'
      ? 'LONGEST ACTIVE STREAK WINS'
      : sortLane === 'SPEED'
      ? 'FASTEST CHALLENGE EXIT WINS'
      : 'LEAST TOTAL SCREEN TIME TODAY WINS';

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} colors={[palette.accent]} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FRIENDS</Text>
        <View style={styles.tabSwitch}>
          {([
            { id: 'BOARD' as SubTab, label: 'BOARD', count: requests.length },
            { id: 'DUELS' as SubTab, label: 'DUELS', count: duelBadgeCount },
            { id: 'INVITE' as SubTab, label: 'INVITE', count: 0 },
          ]).map((t) => {
            const on = subTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabPill, on && styles.tabPillOn]}
                onPress={() => setSubTab(t.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabPillText, on && styles.tabPillTextOn]}>{t.label}</Text>
                {t.count > 0 && (
                  <View style={[styles.tabBadge, on && styles.tabBadgeOn]}>
                    <Text style={[styles.tabBadgeText, on && styles.tabBadgeTextOn]}>{t.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {subTab === 'BOARD' && (
        <>
          {requests.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>FRIEND REQUESTS · {requests.length}</Text>
              {requests.map((r) => (
                <View key={r.id} style={styles.requestRow}>
                  <Avatar entry={{ uid: r.fromUid, displayName: r.displayName, photoURL: r.photoURL }} size={40} />
                  <Text style={styles.requestName} numberOfLines={1}>{r.displayName}</Text>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(r.id)} activeOpacity={0.8}>
                    <Text style={styles.rejectBtnText}>✕</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(r.id)} activeOpacity={0.8}>
                    <Text style={styles.acceptBtnText}>ACCEPT</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {!hasFriends ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>SQUAD EMPTY</Text>
              <Text style={styles.emptySub}>Add a friend by code to compare screen time and challenge them to 24h duels.</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={() => setSubTab('INVITE')} activeOpacity={0.85}>
                <Text style={styles.emptyCtaText}>INVITE OR ADD FRIEND →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.laneRow}>
                {(['TODAY', 'STREAK', 'SPEED'] as SortLane[]).map((lane) => {
                  const on = sortLane === lane;
                  return (
                    <TouchableOpacity
                      key={lane}
                      style={[styles.laneChip, on && styles.laneChipOn]}
                      onPress={() => setSortLane(lane)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.laneChipText, on && styles.laneChipTextOn]}>{lane}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.sectionLabel}>{laneSubtitle}</Text>

              <View style={styles.podium}>
                {podiumOrder.map((i) => {
                  const entry = podium[i];
                  const metal = PODIUM[i];
                  const first = i === 0;
                  return (
                    <TouchableOpacity
                      key={entry.uid}
                      style={[styles.podiumSlot, first && styles.podiumSlotFirst]}
                      onPress={() => openProfile(entry)}
                      activeOpacity={0.85}
                    >
                      {first && <Text style={styles.crown}>♛</Text>}
                      <Avatar entry={entry} size={first ? 64 : 50} ring={metal.color} />
                      <View style={styles.nameRow}>
                        {entry.badge && (
                          <Text style={[styles.eliteGlyph, { color: entry.badge.color }]}>{entry.badge.glyph}</Text>
                        )}
                        <EntryName entry={entry} style={[styles.podiumName, entry.isMe && styles.podiumNameMe]} />
                      </View>
                      <Text style={styles.podiumStreakSmall}>
                        {sortLane === 'TODAY' && !entry.hasTodayData ? 'Not synced' : `🔥 ${entry.currentStreak}`}
                      </Text>
                      <View style={[styles.podiumBlock, { backgroundColor: metal.color, height: first ? 66 : 46 }]}>
                        <Text style={styles.podiumPlace}>{metal.label}</Text>
                        <Text style={styles.podiumStreak}>{laneValue(entry)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {leaderboard.map((entry, idx) => (
                <TouchableOpacity
                  key={entry.uid}
                  style={[styles.friendCard, entry.isMe && styles.friendCardMe]}
                  onPress={() => openProfile(entry)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.rank}>{idx + 1}</Text>
                  <Avatar entry={entry} size={40} />
                  <View style={styles.friendBody}>
                    <View style={styles.nameRow}>
                      {entry.badge && (
                        <Text style={[styles.eliteGlyph, { color: entry.badge.color }]}>{entry.badge.glyph}</Text>
                      )}
                      <EntryName entry={entry} style={styles.friendName} />
                    </View>
                    <View style={styles.friendMeta}>
                      <RankBadge level={entry.level} />
                      <Text style={styles.friendSub}>🔥 {entry.currentStreak} streak</Text>
                    </View>
                  </View>
                  <View style={styles.friendRight}>
                    <Text style={[styles.friendStreak, sortLane === 'TODAY' && !entry.hasTodayData && styles.notSyncedVal]}>
                      {laneValue(entry)}
                    </Text>
                    <Text style={styles.friendStreakLabel}>{laneCaption(entry)}</Text>
                  </View>
                  {!entry.isMe && (
                    <TouchableOpacity style={styles.quickDuelBtn} onPress={() => openDuel(entry)} activeOpacity={0.8}>
                      <Text style={styles.quickDuelIcon}>⚔</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}
        </>
      )}

      {subTab === 'DUELS' && (
        <>
          <View style={styles.autoSyncPill}>
            <View style={styles.autoSyncDot} />
            <Text style={styles.autoSyncText}>
              Auto-sync active — once a friend accepts, scores update and settle in the background without reopening IRONMIND.
            </Text>
          </View>

          {incomingDuels.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>INCOMING CHALLENGES · {incomingDuels.length}</Text>
              {incomingDuels.map((d) => {
                const duelAppNames = appsOf(d);
                const missing = duelAppNames.filter((a) => !monitoredApps.includes(a));
                return (
                  <View key={d.id} style={[styles.duelCard, styles.duelCardIncoming]}>
                    <View style={styles.duelHead}>
                      <Text style={styles.duelTitle} numberOfLines={1}>{d.opponentName}</Text>
                      <Text style={styles.duelStake}>{d.stake > 0 ? `◉ ${d.stake}` : 'FREE DUEL'}</Text>
                    </View>
                    <Text style={styles.duelSub}>
                      Fewest minutes on {duelAppNames.join(', ')} over 24 hours wins.
                    </Text>
                    {missing.length > 0 && (
                      <View style={styles.missingBox}>
                        <Text style={styles.missingText}>
                          You don't track {missing.join(' or ')}. Add {missing.length > 1 ? 'them' : 'it'} in Apps to accept.
                        </Text>
                        <TouchableOpacity onPress={() => onNavigate('APPS')} activeOpacity={0.8}>
                          <Text style={styles.missingLink}>OPEN APPS →</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={styles.duelActions}>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleDuelResponse(d.id, 'decline')} activeOpacity={0.8}>
                        <Text style={styles.rejectBtnText}>✕</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.acceptBtn, missing.length > 0 && styles.acceptBtnOff]}
                        onPress={() => missing.length === 0 && handleDuelResponse(d.id, 'accept')}
                        activeOpacity={missing.length > 0 ? 1 : 0.8}
                      >
                        <Text style={styles.acceptBtnText}>ACCEPT DUEL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {(activeDuels.length > 0 || outgoingDuels.length > 0) && (
            <>
              <Text style={styles.sectionLabel}>LIVE & PENDING · {activeDuels.length + outgoingDuels.length}</Text>

              {activeDuels.map((d) => {
                const mine = d.myMinutes === null ? null : Math.round(d.myMinutes);
                const theirs = d.theirMinutes === null ? null : Math.round(d.theirMinutes);
                const leader = mine === null || theirs === null || mine === theirs ? null : mine < theirs ? 'me' : 'them';
                const appLabel = appsOf(d).join(', ');
                const potText = d.stake > 0 ? `pot ◉ ${d.stake * 2}` : 'FREE DUEL';
                return (
                  <View key={d.id} style={styles.duelCard}>
                    <View style={styles.duelHead}>
                      <Text style={styles.duelTitle} numberOfLines={1}>vs {d.opponentName}</Text>
                      <Text style={styles.duelTimer}>{formatTimeLeft(d.endAt)}</Text>
                    </View>
                    <Text style={styles.duelSub}>{appLabel} · fewest minutes wins · {potText}</Text>
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreSide}>
                        <Text style={[styles.scoreVal, leader === 'me' && styles.scoreWinning]}>
                          {mine === null ? '·' : mine}
                          {mine !== null && <Text style={styles.scoreUnit}>m</Text>}
                        </Text>
                        <Text style={styles.scoreLabel}>YOU</Text>
                      </View>
                      <Text style={styles.scoreVs}>VS</Text>
                      <View style={styles.scoreSide}>
                        <Text style={[styles.scoreVal, leader === 'them' && styles.scoreWinning]}>
                          {theirs === null ? '·' : theirs}
                          {theirs !== null && <Text style={styles.scoreUnit}>m</Text>}
                        </Text>
                        <Text style={styles.scoreLabel}>THEM</Text>
                        {theirs !== null && (
                          <Text style={styles.syncLabel}>{formatAgo(d.theirReportedAt)}</Text>
                        )}
                      </View>
                    </View>
                    {mine !== null && theirs !== null && (
                      <Text style={[styles.duelState, leader === 'me' && styles.duelStateWin, leader === 'them' && styles.duelStateLose]}>
                        {leader === null
                          ? 'DEAD EVEN'
                          : leader === 'me'
                          ? `YOU LEAD BY ${theirs - mine}m`
                          : `BEHIND BY ${mine - theirs}m`}
                      </Text>
                    )}
                    {theirs === null && (
                      <Text style={styles.duelWarn}>
                        Waiting for their first automatic background sync. If one player never syncs within 4h after the duel ends, the synced player wins by forfeit.
                      </Text>
                    )}
                    {reactionText(d.theirReaction) && (
                      <Text style={styles.reactLast}>
                        {d.opponentName}: {reactionText(d.theirReaction)}
                        <Text style={styles.reactAgo}>  {formatAgo(d.theirReactedAt)}</Text>
                      </Text>
                    )}
                    {recentlyReacted(d.myReactedAt) ? (
                      <Text style={styles.reactSent}>SENT ✓ — NEXT ONE IN A MINUTE</Text>
                    ) : (
                      <View style={styles.reactRow}>
                        {DUEL_REACTIONS.map((r) => (
                          <TouchableOpacity
                            key={r.id}
                            style={styles.reactChip}
                            onPress={() => handleReact(d.id, r.id)}
                            activeOpacity={0.8}
                            disabled={reactingId === d.id}
                          >
                            <Text style={styles.reactChipText}>{r.text}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.cancelDuelBtn}
                      onPress={() => handleCancelDuel(d)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.forfeitText}>FORFEIT DUEL</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {outgoingDuels.map((d) => (
                <View key={d.id} style={[styles.duelCard, styles.duelCardMuted]}>
                  <View style={styles.duelHead}>
                    <Text style={styles.duelTitle} numberOfLines={1}>vs {d.opponentName}</Text>
                    <Text style={styles.duelPending}>WAITING</Text>
                  </View>
                  <Text style={styles.duelSub}>
                    {appsOf(d).join(', ')} · {d.stake > 0 ? `ante ◉ ${d.stake}` : 'FREE DUEL'} · awaiting accept
                  </Text>
                  <TouchableOpacity
                    style={styles.cancelDuelBtn}
                    onPress={() => handleCancelDuel(d)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelDuelText}>WITHDRAW CHALLENGE</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {incomingDuels.length === 0 && activeDuels.length === 0 && outgoingDuels.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>NO ACTIVE DUELS</Text>
              <Text style={styles.emptySub}>
                Challenge any friend to a 24-hour screen-time showdown. Fewest minutes takes the pot.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => setSubTab(hasFriends ? 'BOARD' : 'INVITE')}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyCtaText}>{hasFriends ? 'PICK AN OPPONENT →' : 'ADD A FRIEND FIRST →'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {settledDuels.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>RECENT RESULTS</Text>
              {settledDuels.map((d) => {
                const statusTag =
                  d.status === 'cancelled'
                    ? 'CANCELLED'
                    : d.status === 'void'
                    ? 'REFUNDED'
                    : d.iWon
                    ? 'VICTORY'
                    : 'DEFEAT';
                return (
                  <View key={d.id} style={styles.resultCard}>
                    <TouchableOpacity
                      style={styles.resultMain}
                      onPress={() => appAlert('Duel result', d.resolutionReason ?? 'Duel settled automatically.')}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.resultTag,
                          d.status === 'completed'
                            ? d.iWon
                              ? styles.resultWin
                              : styles.resultLoss
                            : styles.resultVoid,
                        ]}
                      >
                        {statusTag}
                      </Text>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName} numberOfLines={1}>vs {d.opponentName}</Text>
                        <Text style={styles.resultDetail} numberOfLines={1}>
                          {appsOf(d).join(', ')} ·{' '}
                          {d.status === 'void' || d.status === 'cancelled'
                            ? d.startAt ? 'coins returned' : 'no charge'
                            : d.myMinutes !== null && d.theirMinutes !== null
                            ? `${Math.round(d.myMinutes)}m – ${Math.round(d.theirMinutes)}m`
                            : d.resolutionReason ?? 'settled'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rematchBtn} onPress={() => openRematch(d)} activeOpacity={0.85}>
                      <Text style={styles.rematchText}>REMATCH</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}
        </>
      )}

      {subTab === 'INVITE' && (
        <>
          <Text style={styles.sectionLabel}>YOUR INVITE CODE</Text>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>SHARE WITH FRIENDS</Text>
            <Text style={styles.codeValue}>{code || '——————'}</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.85} disabled={!code}>
                <Text style={styles.copyBtnText}>{copied ? 'COPIED ✓' : 'COPY'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85} disabled={!code}>
                <Text style={styles.shareBtnText}>SHARE CODE →</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.addCard}>
            <Text style={styles.addLabel}>ADD A FRIEND BY CODE</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                placeholder="Enter 6-letter code"
                placeholderTextColor={palette.textFaint}
                autoCapitalize="characters"
                autoCorrect={false}
                value={inputCode}
                onChangeText={setInputCode}
                maxLength={6}
              />
              <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85} disabled={adding}>
                {adding ? <ActivityIndicator color={palette.accentContrast} size="small" /> : <Text style={styles.addBtnText}>ADD</Text>}
              </TouchableOpacity>
            </View>
            {addResult === 'accepted' && <Text style={styles.addOk}>Friend added ✓</Text>}
            {addResult === 'pending' && (
              <Text style={styles.addOk}>Request sent — waiting for them to accept</Text>
            )}
            {addResult === 'err' && <Text style={styles.addErr}>{error || 'Could not add friend'}</Text>}
          </View>

          {invites && (
            <View style={styles.inviteCard}>
              <Text style={styles.addLabel}>INVITE FRIENDS · EARN FREE PRO</Text>
              {invites.next ? (
                <>
                  <View style={styles.inviteHead}>
                    <Text style={styles.inviteCount}>
                      {Math.min(invites.active, invites.next.at)}
                      <Text style={styles.inviteOf}> / {invites.next.at} friends</Text>
                    </Text>
                    <Text style={styles.inviteReward}>{daysLabel(invites.next.days)} PRO</Text>
                  </View>
                  <View style={styles.inviteBarBg}>
                    <View style={[styles.inviteBarFill, { width: `${Math.min(invites.active / invites.next.at, 1) * 100}%` }]} />
                  </View>
                </>
              ) : (
                <Text style={styles.inviteCount}>All rewards earned ★</Text>
              )}
              <View style={styles.inviteSteps}>
                {invites.milestones.map((m) => (
                  <View key={m.at} style={[styles.inviteStep, invites.rewarded.includes(m.at) && styles.inviteStepDone]}>
                    <Text style={[styles.inviteStepText, invites.rewarded.includes(m.at) && styles.inviteStepTextDone]}>
                      {invites.rewarded.includes(m.at) ? '✓ ' : ''}{m.at} → {daysLabel(m.days)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      <Modal
        visible={duelTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDuelTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              <Text style={styles.modalTitle}>CHALLENGE {duelTarget?.displayName.toUpperCase()}</Text>
              <Text style={styles.modalSub}>
                Fewest minutes on the chosen apps over the next 24 hours wins. Quitting early forfeits the pot.
              </Text>

              <Text style={styles.modalLabel}>STAKE</Text>
              <View style={styles.stakeGrid}>
                {DUEL_STAKES.map((amount) => {
                  const proLocked = amount > FREE_MAX_DUEL_STAKE && !isPro;
                  const shortCoins = amount > 0 && coins < amount;
                  const selected = duelStake === amount;
                  const onTapStake = () => {
                    if (proLocked) {
                      appAlert(
                        'High-Stakes Duels (Pro)',
                        `◉ ${amount} stakes (win ◉ ${amount * 2}) require IronMind Pro. Unlock Pro free via a 7-win streak, invites, or 500 coins.`,
                        onOpenPro
                          ? [
                              { text: 'Not now', style: 'cancel' },
                              { text: 'View Pro', onPress: () => { setDuelTarget(null); onOpenPro(); } },
                            ]
                          : undefined
                      );
                      return;
                    }
                    if (!shortCoins) setDuelStake(amount);
                  };
                  return (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.stakeChip,
                        selected && styles.stakeChipOn,
                        (proLocked || shortCoins) && styles.stakeChipDisabled,
                      ]}
                      onPress={onTapStake}
                      activeOpacity={0.85}
                    >
                      <View style={styles.stakeTopRow}>
                        <Text style={[styles.stakeText, selected && styles.stakeTextOn]}>
                          {amount === 0 ? 'FREE' : `◉ ${amount}`}
                        </Text>
                        {amount > FREE_MAX_DUEL_STAKE && (
                          <View style={styles.stakeProTag}>
                            <Text style={styles.stakeProTagText}>{proLocked ? '🔒 PRO' : 'PRO'}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.stakeSub, selected && styles.stakeSubOn]}>
                        {amount === 0
                          ? 'bragging rights'
                          : proLocked
                          ? `win ◉ ${amount * 2}`
                          : shortCoins
                          ? `you have ${coins}`
                          : `win ◉ ${amount * 2}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalLabel}>PICK THE APPS · {duelApps.length} SELECTED</Text>
              {monitoredApps.map((app) => {
                const on = duelApps.includes(app);
                return (
                  <TouchableOpacity
                    key={app}
                    style={[styles.appOption, on && styles.appOptionOn]}
                    onPress={() => toggleDuelApp(app)}
                    activeOpacity={0.85}
                    disabled={sending}
                  >
                    <AppIcon app={app} style={styles.appOptionIcon} textStyle={styles.appOptionIconText} />
                    <Text style={styles.appOptionText}>{app}</Text>
                    <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                      {on && <Text style={styles.checkMark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.sendDuelBtn, (duelApps.length === 0 || sending) && styles.acceptBtnOff]}
              onPress={sendChallenge}
              activeOpacity={0.85}
              disabled={duelApps.length === 0 || sending}
            >
              {sending ? (
                <ActivityIndicator color={palette.accentContrast} />
              ) : (
                <Text style={styles.sendDuelText}>⚔ SEND DUEL</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setDuelTarget(null)} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={profile !== null} transparent animationType="fade" onRequestClose={() => setProfile(null)}>
        <View style={styles.modalBackdrop}>
          {profile && (
            <View style={styles.modalCard}>
              <View style={styles.profileHead}>
                <Avatar entry={profile} size={72} />
                <View style={styles.profileHeadBody}>
                  <View style={styles.nameRow}>
                    {profile.badge && (
                      <Text style={[styles.eliteGlyph, { color: profile.badge.color }]}>{profile.badge.glyph}</Text>
                    )}
                    <EntryName entry={profile} style={styles.profileName} />
                  </View>
                  <View style={styles.friendMeta}>
                    <RankBadge level={profile.level} />
                    <Text style={styles.friendSub}>LV {profile.level} · {profile.currentXP} XP</Text>
                  </View>
                </View>
              </View>

              <View style={styles.profileGrid}>
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatVal}>
                    {profile.hasTodayData ? formatMinutes(profile.todayMinutes) : '—'}
                  </Text>
                  <Text style={styles.profileStatLabel}>TODAY</Text>
                </View>
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatVal}>{formatMinutes(profile.weekAvgMinutes)}</Text>
                  <Text style={styles.profileStatLabel}>7-DAY AVG</Text>
                </View>
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatVal}>🔥 {profile.currentStreak}</Text>
                  <Text style={styles.profileStatLabel}>STREAK</Text>
                </View>
                <View style={styles.profileStat}>
                  <Text style={styles.profileStatVal}>
                    {profile.bestReactionTime > 0 ? `${profile.bestReactionTime.toFixed(2)}s` : '—'}
                  </Text>
                  <Text style={styles.profileStatLabel}>BEST EXIT</Text>
                </View>
              </View>

              {profile.trackedApps.length > 0 && (
                <View style={styles.profileApps}>
                  {profile.trackedApps.map((app) => (
                    <AppIcon key={app} app={app} style={styles.appOptionIcon} textStyle={styles.appOptionIconText} />
                  ))}
                </View>
              )}

              {!profile.isMe && (
                <TouchableOpacity style={styles.sendDuelBtn} onPress={() => openDuel(profile)} activeOpacity={0.85}>
                  <Text style={styles.sendDuelText}>⚔ CHALLENGE TO DUEL</Text>
                </TouchableOpacity>
              )}

              {!profile.isMe && (
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => {
                    const target = profile;
                    setProfile(null);
                    handleRemove(target.uid, target.displayName);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.removeText}>REMOVE FRIEND</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.modalCancel} onPress={() => setProfile(null)} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <SwordsClash playKey={clashKey} />
    </ScrollView>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingTop: spacing.lg, paddingBottom: 48 },
  centerFill: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 16, marginBottom: 16, gap: 12 },
  headerTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5, paddingHorizontal: 4 },

  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  tabPillOn: { backgroundColor: c.accent },
  tabPillText: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  tabPillTextOn: { color: c.accentContrast },
  tabBadge: { backgroundColor: c.danger, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeOn: { backgroundColor: c.accentContrast },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  tabBadgeTextOn: { color: c.accent },

  laneRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  laneChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  laneChipOn: { backgroundColor: c.accentMuted, borderColor: c.accent },
  laneChipText: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  laneChipTextOn: { color: c.accent },

  autoSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  autoSyncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  autoSyncText: { flex: 1, color: c.textSecondary, fontSize: 11, lineHeight: 16, fontWeight: '600' },

  codeCard: {
    backgroundColor: c.accentMuted,
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: c.accentDim,
    alignItems: 'center',
  },
  codeLabel: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 8 },
  codeValue: { color: c.accent, fontSize: 34, fontWeight: '900', letterSpacing: 6, marginBottom: 16 },
  codeActions: { flexDirection: 'row', gap: 10 },
  copyBtn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, borderWidth: 1, borderColor: c.accentDim },
  copyBtnText: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  shareBtn: { backgroundColor: c.accent, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  shareBtnText: { color: c.accentContrast, fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },

  inviteCard: { backgroundColor: c.surface, borderRadius: 14, marginHorizontal: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: c.border },
  inviteHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  inviteCount: { color: c.textPrimary, fontSize: 26, fontWeight: '900' },
  inviteOf: { color: c.textTertiary, fontSize: 13, fontWeight: '700' },
  inviteReward: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.5, marginBottom: 4 },
  inviteBarBg: { height: 8, borderRadius: 4, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  inviteBarFill: { height: 8, borderRadius: 4, backgroundColor: c.accent },
  inviteSteps: { flexDirection: 'row', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  inviteStep: { borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingVertical: 5, paddingHorizontal: 8 },
  inviteStepDone: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  inviteStepText: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  inviteStepTextDone: { color: c.accent },

  addCard: { backgroundColor: c.surface, borderRadius: 14, marginHorizontal: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: c.border },
  addLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  addRow: { flexDirection: 'row', gap: 10 },
  addInput: {
    flex: 1,
    backgroundColor: c.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: c.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: c.border,
  },
  addBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: c.accentContrast, fontSize: 12, fontWeight: '900' },
  addOk: { color: c.accent, fontSize: 12, fontWeight: '700', marginTop: 10 },
  addErr: { color: c.danger, fontSize: 12, fontWeight: '700', marginTop: 10 },

  sectionLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 10 },

  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: c.accentDim,
  },
  requestName: { flex: 1, color: c.textPrimary, fontSize: 13, fontWeight: '800' },
  rejectBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  rejectBtnText: { color: c.textSecondary, fontSize: 13, fontWeight: '900' },
  acceptBtn: { backgroundColor: c.accent, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  acceptBtnText: { color: c.accentContrast, fontSize: 11, fontWeight: '900' },

  avatar: { justifyContent: 'center', alignItems: 'center', backgroundColor: c.surfaceRaised },
  avatarText: { color: c.textPrimary, fontWeight: '900' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  eliteGlyph: { fontSize: 12, fontWeight: '900' },

  rankBadge: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start' },
  rankBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 18,
  },
  podiumSlot: { flex: 1, alignItems: 'center', gap: 5 },
  podiumSlotFirst: { marginBottom: 0 },
  crown: { color: '#FFD700', fontSize: 18, marginBottom: -2 },
  podiumName: { color: c.textPrimary, fontSize: 11, fontWeight: '800', maxWidth: '100%' },
  podiumNameMe: { color: c.accent },
  podiumStreakSmall: { color: c.textTertiary, fontSize: 10, fontWeight: '800', marginBottom: 2 },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  podiumPlace: { color: 'rgba(0,0,0,0.6)', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  podiumStreak: { color: c.accentContrast, fontSize: 17, fontWeight: '900' },

  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: c.border,
  },
  friendCardMe: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  rank: { color: c.textTertiary, fontSize: 12, fontWeight: '900', width: 18, textAlign: 'center' },
  friendBody: { flex: 1, gap: 4 },
  friendName: { color: c.textPrimary, fontSize: 14, fontWeight: '800' },
  friendMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendSub: { color: c.textTertiary, fontSize: 11 },
  friendRight: { alignItems: 'flex-end' },
  friendStreak: { color: c.accent, fontSize: 18, fontWeight: '900' },
  notSyncedVal: { color: c.textTertiary },
  friendStreakLabel: { color: c.textTertiary, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  quickDuelBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1,
    borderColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  quickDuelIcon: { color: c.accent, fontSize: 15, fontWeight: '900' },

  duelCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  duelCardIncoming: { borderColor: c.accent },
  duelCardMuted: { backgroundColor: c.surface, borderColor: c.border },
  duelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  duelTitle: { flex: 1, color: c.textPrimary, fontSize: 15, fontWeight: '900' },
  duelStake: { color: c.accent, fontSize: 12, fontWeight: '900' },
  duelTimer: { color: c.danger, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  duelPending: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  duelSub: { color: c.textSecondary, fontSize: 12, marginBottom: 12 },
  duelActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  duelWarn: { color: '#D4A138', fontSize: 11, marginTop: 8, lineHeight: 16, textAlign: 'center' },
  reactLast: { color: c.textPrimary, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  reactAgo: { color: c.textTertiary, fontSize: 10, fontWeight: '700' },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 12 },
  reactChip: {
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  reactChipText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  reactSent: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textAlign: 'center', marginTop: 12 },
  cancelDuelBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16, marginTop: 6 },
  cancelDuelText: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  forfeitText: { color: c.danger, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingVertical: 6 },
  scoreSide: { alignItems: 'center', minWidth: 68 },
  scoreVal: { color: c.textPrimary, fontSize: 28, fontWeight: '900' },
  scoreUnit: { fontSize: 13, fontWeight: '800' },
  scoreWinning: { color: c.accent },
  duelState: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.6, textAlign: 'center', marginTop: 6 },
  duelStateWin: { color: c.accent },
  duelStateLose: { color: c.danger },
  scoreLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  syncLabel: { color: c.textFaint, fontSize: 10, fontWeight: '700', marginTop: 2 },
  scoreVs: { color: c.textFaint, fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  resultMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultTag: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, minWidth: 66 },
  resultWin: { color: c.accent },
  resultLoss: { color: c.danger },
  resultVoid: { color: c.textTertiary },
  resultInfo: { flex: 1 },
  resultName: { color: c.textPrimary, fontSize: 13, fontWeight: '800' },
  resultDetail: { color: c.textTertiary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  rematchBtn: {
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rematchText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: c.border, maxHeight: '84%' },
  modalScroll: { flexGrow: 0 },
  modalTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.3, marginBottom: 6 },
  modalSub: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  stakeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  stakeChip: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceRaised,
    borderWidth: 1.5,
    borderColor: c.border,
  },
  stakeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stakeProTag: {
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  stakeProTagText: { color: c.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  stakeChipOn: { borderColor: c.accent, backgroundColor: c.accentMuted },
  stakeChipDisabled: { opacity: 0.55 },
  stakeText: { color: c.textPrimary, fontSize: 14, fontWeight: '900' },
  stakeTextOn: { color: c.accent },
  stakeSub: { color: c.textTertiary, fontSize: 10, fontWeight: '700', marginTop: 2 },
  stakeSubOn: { color: c.accentDim },

  modalLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  appOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  appOptionOn: { borderColor: c.accent, backgroundColor: c.accentMuted },
  appOptionIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  appOptionIconText: { fontSize: 10, fontWeight: '900' },
  appOptionText: { flex: 1, color: c.textPrimary, fontSize: 13, fontWeight: '800' },
  checkBox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.border, justifyContent: 'center', alignItems: 'center' },
  checkBoxOn: { backgroundColor: c.accent, borderColor: c.accent },
  checkMark: { color: c.accentContrast, fontSize: 12, fontWeight: '900' },
  sendDuelBtn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  sendDuelText: { color: c.accentContrast, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  acceptBtnOff: { opacity: 0.4 },
  missingBox: { backgroundColor: c.surfaceRaised, borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: c.danger },
  missingText: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  missingLink: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginTop: 8 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  profileHeadBody: { flex: 1, gap: 6 },
  profileName: { color: c.textPrimary, fontSize: 18, fontWeight: '900' },
  profileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  profileStat: { width: '48%', flexGrow: 1, backgroundColor: c.surfaceRaised, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  profileStatVal: { color: c.textPrimary, fontSize: 20, fontWeight: '900' },
  profileStatLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  profileApps: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 8 },
  removeText: { color: c.danger, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  modalCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  modalCancelText: { color: c.textTertiary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  emptyCard: { backgroundColor: c.surface, borderRadius: 16, marginHorizontal: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  emptyTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  emptySub: { color: c.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  emptyCta: { backgroundColor: c.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
  emptyCtaText: { color: c.accentContrast, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
});
