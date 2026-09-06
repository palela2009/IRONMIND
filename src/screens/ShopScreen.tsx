import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, PALETTES, radius, spacing, cardShadow } from '../theme';
import { usePro } from '../context/ProContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const PRICES = { freeze: 200, theme: 750 };

export const ShopScreen: React.FC<Props> = ({ visible, onClose }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { coins, streakFreezes, isPro, unlockedThemes, themeId, buyItem, setTheme } = usePro();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (item: 'freeze' | 'theme', id?: string) => {
    setBusy(id ?? item);
    const result = await buyItem(item, id);
    setBusy(null);
    if (!result.ok) Alert.alert('Could not buy', result.message ?? 'Try again.');
    else if (item === 'theme' && id) setTheme(id);
  };

  const confirmBuy = (label: string, price: number, item: 'freeze' | 'theme', id?: string) => {
    if (coins < price) {
      Alert.alert('Not enough coins', `${label} costs ${price} coins. You have ${coins}.`);
      return;
    }
    Alert.alert('Confirm purchase', `Buy ${label} for ${price} coins?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => buy(item, id) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>SHOP</Text>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>YOUR COINS</Text>
            <Text style={styles.balance}>◉ {coins}</Text>
            <Text style={styles.balanceSub}>
              {isPro
                ? 'Pro earns double on every win, plus 500 coins a month.'
                : 'Earn 10 per challenge won. Pro earns double.'}
            </Text>
          </View>

          <Text style={styles.section}>CONSUMABLES</Text>
          <TouchableOpacity
            style={styles.itemCard}
            onPress={() => confirmBuy('a streak freeze', PRICES.freeze, 'freeze')}
            activeOpacity={0.85}
            disabled={busy !== null}
          >
            <Text style={styles.itemGlyph}>❄</Text>
            <View style={styles.itemBody}>
              <Text style={styles.itemName}>STREAK FREEZE</Text>
              <Text style={styles.itemDesc}>Absorbs one failed challenge. You have {streakFreezes}.</Text>
            </View>
            {busy === 'freeze' ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : (
              <Text style={styles.itemPrice}>◉ {PRICES.freeze}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.section}>THEMES</Text>
          {PALETTES.filter((p) => p.pro).map((p) => {
            const owned = isPro || unlockedThemes.includes(p.id);
            const active = themeId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.itemCard, { borderColor: active ? p.accent : palette.border }]}
                onPress={() => (owned ? setTheme(p.id) : confirmBuy(`the ${p.name} theme`, PRICES.theme, 'theme', p.id))}
                activeOpacity={0.85}
                disabled={busy !== null}
              >
                <View style={styles.swatches}>
                  <View style={[styles.swatch, { backgroundColor: p.bg }]} />
                  <View style={[styles.swatch, { backgroundColor: p.surfaceRaised }]} />
                  <View style={[styles.swatchWide, { backgroundColor: p.accent }]} />
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>{p.name}</Text>
                  <Text style={styles.itemDesc}>{p.tagline}</Text>
                </View>
                {busy === p.id ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : active ? (
                  <Text style={[styles.itemOwned, { color: p.accent }]}>ACTIVE</Text>
                ) : owned ? (
                  <Text style={styles.itemOwned}>USE</Text>
                ) : (
                  <Text style={styles.itemPrice}>◉ {PRICES.theme}</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <Text style={styles.footnote}>
            Coins are earned by winning challenges and duels. Duels are staked in coins — the
            winner takes the whole pot.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.lg, paddingTop: 56, paddingBottom: 48 },

  close: { position: 'absolute', top: 52, right: spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  title: { color: c.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: spacing.lg },

  balanceCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    ...cardShadow,
  },
  balanceLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  balance: { color: c.accent, fontSize: 40, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  balanceSub: { color: c.textTertiary, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },

  section: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  itemGlyph: { color: c.accent, fontSize: 22, width: 34, textAlign: 'center' },
  itemBody: { flex: 1 },
  itemName: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  itemDesc: { color: c.textTertiary, fontSize: 11, marginTop: 3, lineHeight: 15 },
  itemPrice: { color: c.accent, fontSize: 14, fontWeight: '900' },
  itemOwned: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  swatches: { flexDirection: 'row', gap: 3, width: 34 },
  swatch: { width: 8, height: 22, borderRadius: 3 },
  swatchWide: { width: 12, height: 22, borderRadius: 3 },

  footnote: { color: c.textFaint, fontSize: 10, lineHeight: 15, marginTop: spacing.lg },
});
