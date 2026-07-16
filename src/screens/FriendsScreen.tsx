import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Share, Alert } from 'react-native';
import { useFriends } from '../hooks/useFriends';
import { TrainingState } from '../types/training';

interface FriendsProps {
  onNavigate: (state: TrainingState) => void;
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

export const FriendsScreen: React.FC<FriendsProps> = () => {
  const { code, friends, requests, loading, error, addByCode, acceptRequest, rejectRequest, removeFriend } = useFriends();
  const [inputCode, setInputCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<'idle' | 'ok' | 'err'>('idle');

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({ message: `Add me on IRONMIND — my code is ${code}` });
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

  if (loading) {
    return (
      <View style={[styles.root, styles.centerFill]}>
        <ActivityIndicator color="#CCFF00" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
              <View style={[styles.avatar, { backgroundColor: colorFor(r.fromUid) }]}>
                <Text style={styles.avatarText}>{abbrFor(r.displayName)}</Text>
              </View>
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

      <Text style={styles.sectionLabel}>
        {friends.length > 0 ? `LEADERBOARD · ${friends.length}` : 'NO FRIENDS YET'}
      </Text>

      {friends.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>NOBODY HERE YET</Text>
          <Text style={styles.emptySub}>Share your code or enter a friend's to start comparing streaks.</Text>
        </View>
      ) : (
        friends.map((f, i) => (
          <TouchableOpacity
            key={f.uid}
            style={styles.friendCard}
            onLongPress={() => handleRemove(f.uid, f.displayName)}
            activeOpacity={0.85}
          >
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={[styles.avatar, { backgroundColor: colorFor(f.uid) }]}>
              <Text style={styles.avatarText}>{abbrFor(f.displayName)}</Text>
            </View>
            <View style={styles.friendBody}>
              <Text style={styles.friendName} numberOfLines={1}>{f.displayName}</Text>
              <Text style={styles.friendSub}>{f.totalChallenges} challenges total</Text>
            </View>
            <View style={styles.friendRight}>
              <Text style={styles.friendStreak}>{f.currentStreak}</Text>
              <Text style={styles.friendStreakLabel}>STREAK</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
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

  avatar: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

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
  rank: { color: '#444444', fontSize: 12, fontWeight: '900', width: 16, textAlign: 'center' },
  friendBody: { flex: 1 },
  friendName: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  friendSub: { color: '#555555', fontSize: 11, marginTop: 2 },
  friendRight: { alignItems: 'flex-end' },
  friendStreak: { color: '#CCFF00', fontSize: 20, fontWeight: '900' },
  friendStreakLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  emptyCard: { backgroundColor: '#111111', borderRadius: 14, marginHorizontal: 16, padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#333333', fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  emptySub: { color: '#2A2A2A', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
