import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Share, Alert, Image, Modal, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFriends } from '../hooks/useFriends';
import { useDuels, formatTimeLeft } from '../hooks/useDuels';
import { useAuth } from '../context/AuthContext';
import { TrainingState, UserStats } from '../types/training';
import { rankForLevel, PODIUM } from '../constants/ranks';

const DUEL_STAKE = 100;

const hoursSince = (iso: string | null): number =>
  iso ? (Date.now() - new Date(iso).getTime()) / 3_600_000 : 0;

interface FriendsProps {
  stats: UserStats;
  onNavigate: (state: TrainingState) => void;
}

interface Entry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  currentStreak: number;
  totalChallenges: number;
  level: number;
  isMe: boolean;
}

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

const Avatar: React.FC<{ entry: { uid: string; displayName: string; photoURL: string | null }; size: number; ring?: string }> = ({
  entry,
  size,
  ring,
}) => {
  const [failed, setFailed] = useState(false);
  const boxStyle = {
    width: size,
    height: size,
    borderRadius: size / 3.2,
    ...(ring ? { borderWidth: 2, borderColor: ring } : {}),
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
  const rank = rankForLevel(level);
  return (
    <View style={[styles.rankBadge, { borderColor: rank.color }]}>
      <Text style={[styles.rankBadgeText, { color: rank.color }]}>{rank.short}</Text>
    </View>
  );
};

export const FriendsScreen: React.FC<FriendsProps> = ({ stats }) => {
  const { fbUser } = useAuth();
  const { code, friends, requests, loading, error, addByCode, acceptRequest, rejectRequest, removeFriend, refresh: refreshFriends } = useFriends();
  const { duels, challenge, respond, error: duelError, refresh: refreshDuels } = useDuels();
  const [refreshing, setRefreshing] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<'idle' | 'ok' | 'err'>('idle');

  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [duelTarget, setDuelTarget] = useState<Entry | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@ironmind_onboarding')
      .then((raw) => {
        if (!raw) return;
        const data = JSON.parse(raw);
        if (Array.isArray(data?.targetApps)) setMonitoredApps(data.targetApps);
      })
      .catch(() => {});
  }, []);

  const leaderboard = useMemo<Entry[]>(() => {
    const me: Entry = {
      uid: fbUser?.uid ?? 'me',
      displayName: fbUser?.displayName || fbUser?.email || 'You',
      photoURL: fbUser?.photoURL ?? null,
      currentStreak: stats.currentStreak,
      totalChallenges: stats.totalChallenges,
      level: stats.level,
      isMe: true,
    };

    const others: Entry[] = friends.map((f) => ({
      uid: f.uid,
      displayName: f.displayName,
      photoURL: f.photoURL,
      currentStreak: f.currentStreak,
      totalChallenges: f.totalChallenges,
      level: f.level,
      isMe: false,
    }));

    return [me, ...others].sort(
      (a, b) =>
        b.currentStreak - a.currentStreak ||
        b.level - a.level ||
        b.totalChallenges - a.totalChallenges
    );
  }, [fbUser?.uid, fbUser?.displayName, fbUser?.email, fbUser?.photoURL, stats, friends]);

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Compete with me on IRONMIND to break phone addiction! Use my code: ${code}`,
      });
    } catch {}
  };

  const handleAdd = async () => {
    if (!inputCode.trim()) return;
    setAdding(true);
    const ok = await addByCode(inputCode.trim());
    setAdding(false);
    setAddResult(ok ? 'ok' : 'err');
    if (ok) setInputCode('');
    setTimeout(() => setAddResult('idle'), 3000);
  };

  const handleAccept = async (id: string) => {
    const ok = await acceptRequest(id);
    if (!ok) Alert.alert('Could not accept request', error || 'Try again.');
  };

  const handleReject = async (id: string) => {
    const ok = await rejectRequest(id);
    if (!ok) Alert.alert('Could not reject request', error || 'Try again.');
  };

  const handleRemove = (uid: string, name: string) => {
    Alert.alert('Remove friend', `Remove ${name} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFriend(uid) },
    ]);
  };

  const openDuel = (entry: Entry) => {
    if (entry.isMe) return;
    if (monitoredApps.length === 0) {
      Alert.alert('No apps tracked', 'Pick at least one app to track in the APPS tab before starting a duel.');
      return;
    }
    setDuelTarget(entry);
  };

  const sendChallenge = async (app: string) => {
    if (!duelTarget) return;
    setSending(true);
    const ok = await challenge(duelTarget.uid, app, DUEL_STAKE);
    setSending(false);
    setDuelTarget(null);
    if (!ok) Alert.alert('Could not start duel', duelError || 'Try again.');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshFriends(), refreshDuels()]);
    setRefreshing(false);
  };

  const handleDuelResponse = async (id: string, action: 'accept' | 'decline') => {
    const ok = await respond(id, action);
    if (!ok) Alert.alert(`Could not ${action} duel`, duelError || 'Try again.');
  };

  if (loading) {
    return (
      <View style={[styles.root, styles.centerFill]}>
        <ActivityIndicator color="#CCFF00" />
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
  const settledDuels = duels.filter((d) => d.status === 'completed' || d.status === 'void').slice(0, 5);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#CCFF00" colors={['#CCFF00']} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FRIENDS</Text>
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>YOUR INVITE CODE</Text>
        <Text style={styles.codeValue}>{code || '——————'}</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85} disabled={!code}>
          <Text style={styles.shareBtnText}>SHARE CODE →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.addCard}>
        <Text style={styles.addLabel}>ADD A FRIEND</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Enter their code"
            placeholderTextColor="#444444"
            autoCapitalize="characters"
            autoCorrect={false}
            value={inputCode}
            onChangeText={setInputCode}
            maxLength={6}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.85} disabled={adding}>
            {adding ? <ActivityIndicator color="#000000" size="small" /> : <Text style={styles.addBtnText}>ADD</Text>}
          </TouchableOpacity>
        </View>
        {addResult === 'ok' && <Text style={styles.addOk}>Friend added ✓</Text>}
        {addResult === 'err' && <Text style={styles.addErr}>{error || 'Could not add friend'}</Text>}
      </View>

      {requests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>REQUESTS · {requests.length}</Text>
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

      {incomingDuels.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>DUEL CHALLENGES · {incomingDuels.length}</Text>
          {incomingDuels.map((d) => (
            <View key={d.id} style={styles.duelCard}>
              <View style={styles.duelHead}>
                <Text style={styles.duelTitle} numberOfLines={1}>{d.opponentName}</Text>
                <Text style={styles.duelStake}>{d.stake} XP</Text>
              </View>
              <Text style={styles.duelSub}>
                Fewest minutes on {d.app} over 24 hours wins.
              </Text>
              <View style={styles.duelActions}>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleDuelResponse(d.id, 'decline')} activeOpacity={0.8}>
                  <Text style={styles.rejectBtnText}>✕</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleDuelResponse(d.id, 'accept')} activeOpacity={0.8}>
                  <Text style={styles.acceptBtnText}>ACCEPT DUEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {(activeDuels.length > 0 || outgoingDuels.length > 0) && (
        <>
          <Text style={styles.sectionLabel}>ACTIVE DUELS · {activeDuels.length + outgoingDuels.length}</Text>

          {activeDuels.map((d) => {
            const mine = d.myMinutes ?? 0;
            const theirs = d.theirMinutes;
            const winning = theirs === null ? null : mine < theirs;
            return (
              <View key={d.id} style={styles.duelCard}>
                <View style={styles.duelHead}>
                  <Text style={styles.duelTitle} numberOfLines={1}>vs {d.opponentName}</Text>
                  <Text style={styles.duelTimer}>{formatTimeLeft(d.endAt)}</Text>
                </View>
                <Text style={styles.duelSub}>{d.app} · fewest minutes wins · {d.stake} XP</Text>
                <View style={styles.scoreRow}>
                  <View style={styles.scoreSide}>
                    <Text style={[styles.scoreVal, winning === true && styles.scoreWinning]}>
                      {mine.toFixed(0)}
                    </Text>
                    <Text style={styles.scoreLabel}>YOU</Text>
                  </View>
                  <Text style={styles.scoreVs}>—</Text>
                  <View style={styles.scoreSide}>
                    <Text style={[styles.scoreVal, winning === false && styles.scoreWinning]}>
                      {theirs === null ? '·' : theirs.toFixed(0)}
                    </Text>
                    <Text style={styles.scoreLabel}>THEM</Text>
                  </View>
                </View>
                {theirs === null && (
                  <Text style={styles.duelWarn}>
                    {hoursSince(d.startAt) >= 1
                      ? "They haven't synced yet — a duel with no data from one side is voided."
                      : 'Waiting for their first sync. Scores update when each of you opens IRONMIND.'}
                  </Text>
                )}
              </View>
            );
          })}

          {outgoingDuels.map((d) => (
            <View key={d.id} style={[styles.duelCard, styles.duelCardMuted]}>
              <View style={styles.duelHead}>
                <Text style={styles.duelTitle} numberOfLines={1}>vs {d.opponentName}</Text>
                <Text style={styles.duelPending}>WAITING</Text>
              </View>
              <Text style={styles.duelSub}>{d.app} · {d.stake} XP · not accepted yet</Text>
            </View>
          ))}
        </>
      )}

      {settledDuels.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>DUEL HISTORY</Text>
          {settledDuels.map((d) => (
            <View key={d.id} style={styles.resultRow}>
              <Text
                style={[
                  styles.resultTag,
                  d.status === 'void' ? styles.resultVoid : d.iWon ? styles.resultWin : styles.resultLoss,
                ]}
              >
                {d.status === 'void' ? 'VOID' : d.iWon ? 'WON' : 'LOST'}
              </Text>
              <Text style={styles.resultName} numberOfLines={1}>{d.opponentName}</Text>
              <Text style={styles.resultDetail}>
                {d.status === 'void'
                  ? 'no data'
                  : `${(d.myMinutes ?? 0).toFixed(0)}–${(d.theirMinutes ?? 0).toFixed(0)}m`}
              </Text>
            </View>
          ))}
        </>
      )}

      {!hasFriends ? (
        <>
          <Text style={styles.sectionLabel}>NO FRIENDS YET</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>NOBODY HERE YET</Text>
            <Text style={styles.emptySub}>Share your code or enter a friend's to start comparing streaks.</Text>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>LEADERBOARD · {leaderboard.length}</Text>
          <Text style={styles.duelHint}>Tap a friend to challenge them to a 24-hour duel.</Text>

          <View style={styles.podium}>
            {podiumOrder.map((i) => {
              const entry = podium[i];
              const metal = PODIUM[i];
              const first = i === 0;
              return (
                <TouchableOpacity
                  key={entry.uid}
                  style={[styles.podiumSlot, first && styles.podiumSlotFirst]}
                  onPress={() => openDuel(entry)}
                  activeOpacity={entry.isMe ? 1 : 0.85}
                >
                  {first && <Text style={styles.crown}>♛</Text>}
                  <Avatar entry={entry} size={first ? 64 : 50} ring={metal.color} />
                  <Text style={[styles.podiumName, entry.isMe && styles.podiumNameMe]} numberOfLines={1}>
                    {entry.isMe ? 'YOU' : entry.displayName}
                  </Text>
                  <RankBadge level={entry.level} />
                  <View style={[styles.podiumBlock, { backgroundColor: metal.color, height: first ? 64 : 44 }]}>
                    <Text style={styles.podiumPlace}>{metal.label}</Text>
                    <Text style={styles.podiumStreak}>{entry.currentStreak}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {rest.map((entry, i) => (
            <TouchableOpacity
              key={entry.uid}
              style={[styles.friendCard, entry.isMe && styles.friendCardMe]}
              onPress={() => openDuel(entry)}
              onLongPress={() => !entry.isMe && handleRemove(entry.uid, entry.displayName)}
              activeOpacity={entry.isMe ? 1 : 0.85}
            >
              <Text style={styles.rank}>{i + 4}</Text>
              <Avatar entry={entry} size={40} />
              <View style={styles.friendBody}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {entry.isMe ? 'YOU' : entry.displayName}
                </Text>
                <View style={styles.friendMeta}>
                  <RankBadge level={entry.level} />
                  <Text style={styles.friendSub}>{entry.totalChallenges} challenges</Text>
                </View>
              </View>
              <View style={styles.friendRight}>
                <Text style={styles.friendStreak}>{entry.currentStreak}</Text>
                <Text style={styles.friendStreakLabel}>STREAK</Text>
              </View>
            </TouchableOpacity>
          ))}
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
            <Text style={styles.modalTitle}>CHALLENGE {duelTarget?.displayName.toUpperCase()}</Text>
            <Text style={styles.modalSub}>
              Whoever spends fewer minutes on the chosen app over the next 24 hours wins.
              The loser gives up {DUEL_STAKE} XP.
            </Text>

            <Text style={styles.modalLabel}>PICK THE APP</Text>
            {monitoredApps.map((app) => (
              <TouchableOpacity
                key={app}
                style={styles.appOption}
                onPress={() => sendChallenge(app)}
                activeOpacity={0.85}
                disabled={sending}
              >
                <Text style={styles.appOptionText}>{app}</Text>
                <Text style={styles.appOptionArrow}>→</Text>
              </TouchableOpacity>
            ))}

            {sending && <ActivityIndicator color="#CCFF00" style={styles.modalSpinner} />}

            <TouchableOpacity style={styles.modalCancel} onPress={() => setDuelTarget(null)} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { paddingTop: 52, paddingBottom: 48 },
  centerFill: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, marginBottom: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },

  codeCard: {
    backgroundColor: '#0A1400',
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E3300',
    alignItems: 'center',
  },
  codeLabel: { color: '#556644', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  codeValue: { color: '#CCFF00', fontSize: 32, fontWeight: '900', letterSpacing: 6, marginBottom: 16 },
  shareBtn: { backgroundColor: '#CCFF00', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  shareBtnText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  addCard: { backgroundColor: '#111111', borderRadius: 14, marginHorizontal: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#1C1C1C' },
  addLabel: { color: '#555555', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  addRow: { flexDirection: 'row', gap: 10 },
  addInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  addBtn: { backgroundColor: '#CCFF00', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { color: '#000000', fontSize: 12, fontWeight: '900' },
  addOk: { color: '#CCFF00', fontSize: 12, fontWeight: '700', marginTop: 10 },
  addErr: { color: '#FF4444', fontSize: 12, fontWeight: '700', marginTop: 10 },

  sectionLabel: { color: '#444444', fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 10 },
  duelHint: { color: '#3A3A3A', fontSize: 11, paddingHorizontal: 20, marginTop: -4, marginBottom: 14 },

  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111111',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1C1C1C',
  },
  requestName: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  rejectBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  rejectBtnText: { color: '#666666', fontSize: 13, fontWeight: '900' },
  acceptBtn: { backgroundColor: '#CCFF00', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  acceptBtnText: { color: '#000000', fontSize: 11, fontWeight: '900' },

  avatar: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' },
  avatarText: { color: '#FFFFFF', fontWeight: '900' },

  rankBadge: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, alignSelf: 'flex-start' },
  rankBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  podiumSlot: { flex: 1, alignItems: 'center', gap: 6 },
  podiumSlotFirst: { marginBottom: 0 },
  crown: { color: '#FFD700', fontSize: 16, marginBottom: -2 },
  podiumName: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', maxWidth: '100%' },
  podiumNameMe: { color: '#CCFF00' },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  podiumPlace: { color: 'rgba(0,0,0,0.55)', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  podiumStreak: { color: '#000000', fontSize: 18, fontWeight: '900' },

  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111111',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1C1C1C',
  },
  friendCardMe: { borderColor: '#2E3D00', backgroundColor: '#0D1200' },
  rank: { color: '#444444', fontSize: 12, fontWeight: '900', width: 16, textAlign: 'center' },
  friendBody: { flex: 1, gap: 4 },
  friendName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  friendMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  friendSub: { color: '#555555', fontSize: 11 },
  friendRight: { alignItems: 'flex-end' },
  friendStreak: { color: '#CCFF00', fontSize: 20, fontWeight: '900' },
  friendStreakLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  duelCard: {
    backgroundColor: '#12080F',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#3A1226',
  },
  duelCardMuted: { backgroundColor: '#111111', borderColor: '#1C1C1C' },
  duelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  duelTitle: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  duelStake: { color: '#FF4D8D', fontSize: 12, fontWeight: '900' },
  duelTimer: { color: '#FF4D8D', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  duelPending: { color: '#555555', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  duelSub: { color: '#7A6070', fontSize: 11, marginBottom: 10 },
  duelActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  duelWarn: { color: '#8A6A20', fontSize: 10, marginTop: 8, lineHeight: 14 },

  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 4 },
  scoreSide: { alignItems: 'center', minWidth: 60 },
  scoreVal: { color: '#666666', fontSize: 26, fontWeight: '900' },
  scoreWinning: { color: '#CCFF00' },
  scoreLabel: { color: '#4A3A44', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  scoreVs: { color: '#3A2530', fontSize: 16, fontWeight: '900' },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0E0E0E',
    borderRadius: 10,
  },
  resultTag: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5, width: 34 },
  resultWin: { color: '#CCFF00' },
  resultLoss: { color: '#FF4D8D' },
  resultVoid: { color: '#555555' },
  resultName: { flex: 1, color: '#AAAAAA', fontSize: 12, fontWeight: '700' },
  resultDetail: { color: '#555555', fontSize: 11, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#121212', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#242424' },
  modalTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.3, marginBottom: 8 },
  modalSub: { color: '#777777', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  modalLabel: { color: '#555555', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  appOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  appOptionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  appOptionArrow: { color: '#CCFF00', fontSize: 14, fontWeight: '900' },
  modalSpinner: { marginVertical: 8 },
  modalCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  modalCancelText: { color: '#555555', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  emptyCard: { backgroundColor: '#111111', borderRadius: 14, marginHorizontal: 16, padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#333333', fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  emptySub: { color: '#2A2A2A', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
