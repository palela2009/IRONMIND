import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

interface RepProps {
  onNavigate: (state: any) => void;
  triggerFiredAt: number;
  targetApp: string;
}

const { height } = Dimensions.get('window');

export const RepScreen: React.FC<RepProps> = ({ onNavigate, triggerFiredAt, targetApp }) => {
  const [elapsed, setElapsed] = useState<number>(
    triggerFiredAt > 0 ? (Date.now() - triggerFiredAt) / 1000 : 0
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(triggerFiredAt > 0 ? (Date.now() - triggerFiredAt) / 1000 : 0);
    }, 100);
    return () => clearInterval(interval);
  }, [triggerFiredAt]);

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <View style={styles.bannerLogo}>
            <Text style={styles.bannerLogoText}>IM</Text>
          </View>
          <View>
            <Text style={styles.bannerTitle}>TRIGGER FIRED — CLOSE NOW</Text>
            <Text style={styles.bannerSub}>{targetApp.toUpperCase()} · {elapsed.toFixed(1)}s elapsed</Text>
          </View>
        </View>
        <View style={styles.elapsedBadge}>
          <Text style={styles.elapsedBadgeText}>{elapsed.toFixed(1)}s</Text>
        </View>
      </View>

      <View style={styles.mockApp}>
        <View style={styles.storiesRow}>
          {['A', 'B', 'C', 'D', 'E'].map((l) => (
            <View key={l} style={styles.storyItem}>
              <View style={styles.storyRing}>
                <View style={styles.storyAvatar}>
                  <Text style={styles.storyLetter}>{l}</Text>
                </View>
              </View>
              <Text style={styles.storyName}>user_{l.toLowerCase()}</Text>
            </View>
          ))}
        </View>

        <View style={styles.post}>
          <View style={styles.postHeader}>
            <View style={styles.postAvatar}>
              <Text style={styles.postAvatarText}>SB</Text>
            </View>
            <Text style={styles.postUser}>scroll_baiter</Text>
          </View>
          <View style={styles.postImage}>
            <Text style={styles.postImageSymbol}>∞</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.closeBtn} onPress={() => onNavigate('RSLT')} activeOpacity={0.85}>
        <Text style={styles.closeBtnMain}>CLOSE APP · EARN XP</Text>
        <Text style={styles.closeBtnSub}>tap to complete the rep</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C', justifyContent: 'space-between', paddingBottom: 30 },

  banner: {
    backgroundColor: '#CCFF00',
    marginHorizontal: 12,
    marginTop: 50,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  bannerLogo: { backgroundColor: '#000000', padding: 8, borderRadius: 8 },
  bannerLogoText: { color: '#CCFF00', fontWeight: '900', fontSize: 12 },
  bannerTitle: { color: '#000000', fontWeight: '900', fontSize: 12, letterSpacing: 0.3 },
  bannerSub: { color: '#000000', fontSize: 11, fontWeight: '600', opacity: 0.55, marginTop: 2 },
  elapsedBadge: { backgroundColor: 'rgba(0,0,0,0.14)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  elapsedBadgeText: { color: '#000000', fontWeight: '900', fontSize: 13 },

  mockApp: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  storiesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  storyItem: { alignItems: 'center', width: '18%' },
  storyRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderColor: '#C07820',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  storyAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E1005',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyLetter: { color: '#C07820', fontWeight: '900', fontSize: 16 },
  storyName: { color: '#444444', fontSize: 9, fontWeight: '600' },

  post: {},
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#5018CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 11 },
  postUser: { color: '#AAAAAA', fontWeight: '700', fontSize: 13 },
  postImage: {
    width: '100%',
    height: height * 0.35,
    backgroundColor: '#12081E',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postImageSymbol: { color: '#2E0F5A', fontSize: 90, fontWeight: '900' },

  closeBtn: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    paddingVertical: 22,
    borderRadius: 20,
    alignItems: 'center',
  },
  closeBtnMain: { color: '#000000', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  closeBtnSub: { color: '#000000', fontSize: 11, opacity: 0.35, marginTop: 4, fontWeight: '600' },
});
