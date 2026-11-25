import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { usePro } from '../context/ProContext';
import { appAlert } from './AppDialog';
import { Palette, radius, spacing, cardShadow } from '../theme';

interface Props {
  visible: boolean;
  streak: number;
  onClose: () => void;
  onOpenPro: () => void;
}

const FREEZE_PRICE = 100;

export const StreakFreezeModal: React.FC<Props> = ({ visible, streak, onClose, onOpenPro }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { streakFreezes, coins, isPro, buyItem } = usePro();
  const [buying, setBuying] = useState(false);

  const handleBuy = async () => {
    if (buying) return;
    if (coins < FREEZE_PRICE) {
      appAlert('Not enough coins', `A Streak Freeze costs ◉ ${FREEZE_PRICE}. You have ◉ ${coins}. Win scroll challenges or duels to earn coins!`);
      return;
    }
    setBuying(true);
    const res = await buyItem('freeze');
    setBuying(false);
    if (!res.ok) {
      appAlert('Could not buy freeze', res.message ?? 'Try again.');
      return;
    }
    appAlert('Freeze armed ❄', 'Your streak is now shielded against your next missed challenge.');
  };

  const shielded = streakFreezes > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.topRow}>
            <View style={[styles.statusPill, shielded ? styles.pillArmed : styles.pillEmpty]}>
              <Text style={[styles.statusText, shielded ? styles.textArmed : styles.textEmpty]}>
                {shielded ? 'SHIELD ARMED' : 'UNPROTECTED'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.shieldCircle, shielded && styles.shieldCircleArmed]}>
            <Text style={styles.shieldGlyph}>❄</Text>
          </View>

          <Text style={styles.count}>
            {streakFreezes} <Text style={styles.countWord}>{streakFreezes === 1 ? 'FREEZE' : 'FREEZES'}</Text>
          </Text>
          <Text style={styles.sub}>
            {shielded
              ? `Your ${streak > 0 ? `${streak}-win` : 'current'} streak is protected. If you ever miss a scroll challenge, one freeze triggers automatically so your streak survives.`
              : `If you miss a scroll challenge right now, your ${streak > 0 ? `${streak}-win ` : ''}streak resets to 0. Arm a freeze to stay protected automatically.`}
          </Text>

          <View style={styles.howBox}>
            <View style={styles.howRow}>
              <Text style={styles.howIcon}>⚡</Text>
              <Text style={styles.howText}>Activates automatically — zero buttons to press</Text>
            </View>
            <View style={styles.howRow}>
              <Text style={styles.howIcon}>🛡</Text>
              <Text style={styles.howText}>Absorbs 1 missed challenge without breaking your run</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.buyBtn, buying && styles.disabled]}
            onPress={handleBuy}
            disabled={buying}
            activeOpacity={0.85}
          >
            {buying ? (
              <ActivityIndicator color="#001019" />
            ) : (
              <Text style={styles.buyBtnText}>BUY 1 FREEZE · ◉ {FREEZE_PRICE}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.balanceLine}>Your balance: ◉ {coins.toLocaleString()}</Text>

          {!isPro && (
            <TouchableOpacity
              style={styles.proRow}
              onPress={() => {
                onClose();
                onOpenPro();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.proRowText}>★ IRONMIND PRO includes 20 freezes every month</Text>
              <Text style={styles.proRowCta}>VIEW →</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    padding: spacing.xl,
    alignItems: 'center',
    ...cardShadow,
  },
  topRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillArmed: { backgroundColor: 'rgba(56, 189, 248, 0.16)' },
  pillEmpty: { backgroundColor: c.dangerMuted },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  textArmed: { color: '#7DD3FC' },
  textEmpty: { color: c.danger },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: c.textSecondary, fontSize: 13, fontWeight: '900' },

  shieldCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shieldCircleArmed: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  shieldGlyph: { color: '#9FD8FF', fontSize: 34, fontWeight: '900' },

  count: { color: c.textPrimary, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  countWord: { color: '#7DD3FC', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },

  howBox: {
    alignSelf: 'stretch',
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 8,
    marginBottom: spacing.lg,
  },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  howIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  howText: { flex: 1, color: c.textSecondary, fontSize: 12, fontWeight: '600' },

  buyBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#38BDF8',
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  buyBtnText: { color: '#001019', fontSize: 13, fontWeight: '900', letterSpacing: 0.7 },
  balanceLine: { color: c.textTertiary, fontSize: 11, fontWeight: '700', marginTop: spacing.sm },

  proRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: c.borderSubtle,
  },
  proRowText: { flex: 1, color: c.accent, fontSize: 11, fontWeight: '800' },
  proRowCta: { color: c.accent, fontSize: 11, fontWeight: '900' },
});
