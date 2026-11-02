import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { appAlert } from '../components/AppDialog';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, PALETTES, radius, spacing, cardShadow } from '../theme';
import { usePro } from '../context/ProContext';
import { FRAMES, NAME_EFFECTS, PRO_WEEK_PRICE, glowStyle } from '../constants/cosmetics';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const PRICES = { freeze: 100, reclaim: 200, theme: 200 };

export const ShopScreen: React.FC<Props> = ({ visible, onClose }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { coins, streakFreezes, isPro, unlockedThemes, themeId, buyItem, setTheme,
    ownedFrames, ownedNameEffects, equippedFrame, equippedNameEffect, equipCosmetic,
    welcomeGiftAvailable, claimWelcomeGift, source } = usePro();
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (item: 'freeze' | 'theme' | 'frame' | 'nameEffect' | 'proWeek', id?: string) => {
    setBusy(id ?? item);
    const result = await buyItem(item, item === 'theme' ? { themeId: id } : { cosmeticId: id });
    setBusy(null);
    if (!result.ok) appAlert('Could not buy', result.message ?? 'Try again.');
    else if (item === 'theme' && id) setTheme(id);
  };

  const confirmBuy = (label: string, price: number, item: 'freeze' | 'theme' | 'frame' | 'nameEffect' | 'proWeek', id?: string) => {
    if (coins < price) {
      appAlert('Not enough coins', `${label} costs ${price} coins. You have ${coins}.`);
      return;
    }
    appAlert('Confirm purchase', `Buy ${label} for ${price} coins?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => buy(item, id) },
    ]);
  };

  const claimTheme = async (id: string) => {
    if (busy !== null) return;
    setBusy(id);
    try {
      const result = await claimWelcomeGift(id);
      if (!result.ok) appAlert('Could not claim gift', result.message ?? 'Try again.');
    } finally { setBusy(null); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
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
                ? source === 'store' ? 'Double challenge rewards. Paid Pro also gets 500 bonus coins each month.' : 'Pro doubles challenge rewards. Monthly bonus coins are a paid Pro benefit.'
                : 'Earn 10 per win, plus 50 for a perfect day. Pro doubles both rewards.'}
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

          {welcomeGiftAvailable && (
            <View style={styles.giftCard}>
              <Text style={styles.giftTitle}>YOUR WELCOME GIFT</Text>
              <Text style={styles.giftDescription}>Choose one theme below to keep forever, plus one free streak freeze. Your coins stay yours.</Text>
            </View>
          )}
          <Text style={styles.section}>{welcomeGiftAvailable ? 'CHOOSE YOUR FREE THEME' : 'THEMES'}</Text>
          {PALETTES.filter((p) => p.pro).map((p) => {
            const owned = isPro || unlockedThemes.includes(p.id);
            const active = themeId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.itemCard, { borderColor: active ? p.accent : palette.border }]}
                onPress={() => welcomeGiftAvailable ? void claimTheme(p.id) : owned ? void setTheme(p.id) : confirmBuy(`the ${p.name} theme`, PRICES.theme, 'theme', p.id)}
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
                ) : welcomeGiftAvailable ? (
                  <Text style={styles.itemOwned}>FREE GIFT</Text>
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

          <Text style={styles.section}>PROFILE FRAMES</Text>
          <Text style={styles.sectionSub}>A ring around your avatar, visible to friends.</Text>
          {FRAMES.map((f) => {
            const owned = ownedFrames.includes(f.id);
            const active = equippedFrame === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.itemCard, active && { borderColor: f.ring }]}
                onPress={() =>
                  owned ? equipCosmetic('frame', active ? null : f.id) : confirmBuy(`the ${f.name} frame`, f.price, 'frame', f.id)
                }
                activeOpacity={0.85}
                disabled={busy !== null}
              >
                <View style={[styles.framePreview, { borderColor: f.ring }, f.glow ? { shadowColor: f.glow, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6 } : null]} />
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>{f.name}</Text>
                  <Text style={styles.itemDesc}>{f.desc}</Text>
                </View>
                {busy === f.id ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : active ? (
                  <Text style={[styles.itemOwned, { color: f.ring }]}>WORN</Text>
                ) : owned ? (
                  <Text style={styles.itemOwned}>WEAR</Text>
                ) : (
                  <Text style={styles.itemPrice}>◉ {f.price}</Text>
                )}
              </TouchableOpacity>
            );
          })}

          <Text style={styles.section}>NAME EFFECTS</Text>
          <Text style={styles.sectionSub}>Colours your name wherever it appears.</Text>
          {NAME_EFFECTS.map((n) => {
            const owned = ownedNameEffects.includes(n.id);
            const active = equippedNameEffect === n.id;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.itemCard, active && { borderColor: n.color }]}
                onPress={() =>
                  owned ? equipCosmetic('nameEffect', active ? null : n.id) : confirmBuy(`the ${n.name} name`, n.price, 'nameEffect', n.id)
                }
                activeOpacity={0.85}
                disabled={busy !== null}
              >
                <Text style={[styles.namePreview, { color: n.color }, glowStyle(n.glow)]}>Aa</Text>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>{n.name}</Text>
                  <Text style={styles.itemDesc}>{n.desc}</Text>
                </View>
                {busy === n.id ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : active ? (
                  <Text style={[styles.itemOwned, { color: n.color }]}>WORN</Text>
                ) : owned ? (
                  <Text style={styles.itemOwned}>WEAR</Text>
                ) : (
                  <Text style={styles.itemPrice}>◉ {n.price}</Text>
                )}
              </TouchableOpacity>
            );
          })}

          {!isPro && (
            <>
              <Text style={styles.section}>MEMBERSHIP</Text>
              <TouchableOpacity
                style={styles.itemCard}
                onPress={() => confirmBuy('7 days of IronMind Pro', PRO_WEEK_PRICE, 'proWeek')}
                activeOpacity={0.85}
                disabled={busy !== null}
              >
                <Text style={styles.itemGlyph}>★</Text>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>PRO — 7 DAYS</Text>
                  <Text style={styles.itemDesc}>Every Pro feature for a week. Once a month.</Text>
                </View>
                {busy === 'proWeek' ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : (
                  <Text style={styles.itemPrice}>◉ {PRO_WEEK_PRICE}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.footnote}>
            Coins are earned by winning challenges and duels. Duels are staked in coins — the
            winner takes the whole pot.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  close: { position: 'absolute', top: spacing.lg, right: spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  title: { color: c.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: spacing.lg, paddingRight: 48 },
  giftCard: { backgroundColor: c.accentMuted, borderRadius: radius.md, borderWidth: 1, borderColor: c.accent, padding: spacing.lg, marginBottom: spacing.lg },
  giftTitle: { color: c.accent, fontSize: 12, fontWeight: '900' },
  giftDescription: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },

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
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  itemDesc: { color: c.textTertiary, fontSize: 11, marginTop: 3, lineHeight: 15 },
  itemPrice: { color: c.accent, fontSize: 14, fontWeight: '900' },
  itemOwned: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  sectionSub: { color: c.textFaint, fontSize: 11, marginTop: -8, marginBottom: 12, lineHeight: 15 },
  framePreview: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  namePreview: { width: 34, fontSize: 18, fontWeight: '900', textAlign: 'center' },

  swatches: { flexDirection: 'row', gap: 3, width: 34 },
  swatch: { width: 8, height: 22, borderRadius: 3 },
  swatchWide: { width: 12, height: 22, borderRadius: 3 },

  footnote: { color: c.textFaint, fontSize: 10, lineHeight: 15, marginTop: spacing.lg },
});
