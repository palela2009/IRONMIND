import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, Linking } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, PALETTES } from '../theme';
import { usePro } from '../context/ProContext';
import { PRO_PLANS, PRO_FEATURES, ProPlan, ProPlanId } from '../constants/pro';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { MANAGE_SUBSCRIPTIONS_URL, purchasesAvailable } from '../config/purchases';
import { PRO_WEEK_PRICE } from '../constants/cosmetics';
import { INVITE_RULES } from '../hooks/useInvites';

const REFERRAL_STEPS = '3 friends → 7 days · 10 → 1 month · 25 → 3 months';

interface ProScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const ProScreen: React.FC<ProScreenProps> = ({ visible, onClose }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { isPro, plan, source, expiresAt, streakFreezes, themeId, setTheme, purchase, restore } = usePro();
  const [busy, setBusy] = useState<ProPlanId | 'restore' | null>(null);
  const { priceFor, productFor } = useStoreProducts(PRO_PLANS, visible && !isPro);

  const chooseTheme = (id: string, requiresPro: boolean) => {
    if (requiresPro && !isPro) {
      Alert.alert('Pro theme', 'Unlock this theme with IronMind Pro to use it.');
      return;
    }
    setTheme(id);
  };

  const handleSelect = async (p: ProPlan) => {
    const product = productFor(p);
    if (!product) {
      Alert.alert('Not available yet', 'Purchases are not available right now. Try again later.');
      return;
    }
    setBusy(p.id);
    const outcome = await purchase(product);
    setBusy(null);
    if (outcome === 'purchased') {
      Alert.alert('Welcome to Pro', 'Every Pro feature is now unlocked.');
    } else if (outcome === 'failed') {
      Alert.alert('Purchase did not go through', 'You have not been charged. Try again in a moment.');
    }
  };

  const handleRestore = async () => {
    setBusy('restore');
    const ok = await restore();
    setBusy(null);
    Alert.alert(
      ok ? 'Purchases restored' : 'Nothing to restore',
      ok ? 'Any Pro purchase on this Google account has been applied.' : 'No Pro purchase was found for this Google account.'
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.brand}>IRONMIND</Text>
          <Text style={styles.brandPro}>PRO</Text>

          {isPro ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeTitle}>PRO ACTIVE</Text>
              <Text style={styles.activeSub}>
                {plan === 'lifetime'
                  ? 'Lifetime access — never expires.'
                  : expiresAt
                  ? source === 'store'
                    ? `${plan?.toUpperCase()} · renews ${new Date(expiresAt).toLocaleDateString()}`
                    : `Pro until ${new Date(expiresAt).toLocaleDateString()}`
                  : plan?.toUpperCase()}
              </Text>
              <Text style={styles.activeFreezes}>{streakFreezes} streak freezes remaining</Text>
            </View>
          ) : (
            <Text style={styles.tagline}>
              Protect your streak. Unlock the full picture of your habits.
            </Text>
          )}

          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>THEMES</Text>
          <View style={styles.themeGrid}>
            {PALETTES.map((p) => {
              const locked = p.pro && !isPro;
              const active = themeId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.themeCard,
                    { backgroundColor: p.surface, borderColor: active ? p.accent : p.border },
                    locked && styles.themeCardLocked,
                  ]}
                  onPress={() => chooseTheme(p.id, p.pro)}
                  activeOpacity={0.85}
                >
                  <View style={styles.swatchRow}>
                    <View style={[styles.swatch, { backgroundColor: p.bg }]} />
                    <View style={[styles.swatch, { backgroundColor: p.surfaceRaised }]} />
                    <View style={[styles.swatchAccent, { backgroundColor: p.accent }]} />
                  </View>
                  <Text style={[styles.themeName, { color: p.textPrimary }]}>{p.name}</Text>
                  <Text style={[styles.themeTagline, { color: p.textTertiary }]} numberOfLines={2}>
                    {p.tagline}
                  </Text>
                  {locked ? (
                    <Text style={[styles.themeBadge, { color: p.textTertiary }]}>PRO</Text>
                  ) : active ? (
                    <Text style={[styles.themeBadge, { color: p.accent }]}>ACTIVE</Text>
                  ) : (
                    <Text style={styles.themeBadgeSpacer}> </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {!isPro && !purchasesAvailable() && (
            <>
              <Text style={styles.sectionLabel}>HOW TO GET PRO</Text>
              <View style={styles.planCard}>
                <View style={styles.planLeft}>
                  <Text style={styles.planTitle}>INVITE FRIENDS</Text>
                  <Text style={styles.planCadence}>
                    {REFERRAL_STEPS} · Friends tab
                  </Text>
                </View>
              </View>
              <View style={styles.planCard}>
                <View style={styles.planLeft}>
                  <Text style={styles.planTitle}>SPEND COINS</Text>
                  <Text style={styles.planCadence}>
                    ◉ {PRO_WEEK_PRICE.toLocaleString()} → 7 days, once a month · Shop on Home
                  </Text>
                </View>
              </View>
              <Text style={styles.legal}>{INVITE_RULES} Coins come from winning challenges.</Text>
            </>
          )}

          {!isPro && purchasesAvailable() && (
            <>
              <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
              {PRO_PLANS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.planCard, p.id === 'annual' && styles.planCardFeatured]}
                  onPress={() => handleSelect(p)}
                  activeOpacity={0.85}
                  disabled={busy !== null}
                >
                  <View style={styles.planLeft}>
                    <Text style={styles.planTitle}>{p.title}</Text>
                    <Text style={styles.planCadence}>
                      {p.cadence}
                      {p.perMonth ? ` · ${p.perMonth}` : ''}
                    </Text>
                  </View>
                  <View style={styles.planRight}>
                    {busy === p.id ? (
                      <ActivityIndicator color={palette.accent} size="small" />
                    ) : (
                      <Text style={styles.planPrice}>{priceFor(p)}</Text>
                    )}
                    {p.note && <Text style={styles.planNote}>{p.note}</Text>}
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={styles.legal}>
                Subscriptions renew automatically until cancelled. Manage or cancel any time in
                Google Play. Lifetime is a single payment with no renewal.
              </Text>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleRestore} activeOpacity={0.8} disabled={busy !== null}>
                {busy === 'restore' ? (
                  <ActivityIndicator color={palette.textTertiary} size="small" />
                ) : (
                  <Text style={styles.cancelText}>RESTORE PURCHASES</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {isPro && source === 'store' && plan !== 'lifetime' && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)} activeOpacity={0.8}>
              <Text style={styles.cancelText}>MANAGE SUBSCRIPTION</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20, paddingTop: 56, paddingBottom: 48 },

  close: { position: 'absolute', top: 52, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  brand: { color: c.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  brandPro: { color: c.accent, fontSize: 46, fontWeight: '900', letterSpacing: -2, marginTop: -8, marginBottom: 12 },
  tagline: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 28 },

  activeCard: { backgroundColor: c.accentMuted, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: c.accentDim, marginBottom: 28 },
  activeTitle: { color: c.accent, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  activeSub: { color: c.textSecondary, fontSize: 12, marginTop: 6 },
  activeFreezes: { color: c.textTertiary, fontSize: 11, marginTop: 10, fontWeight: '700' },

  features: { gap: 18, marginBottom: 32 },
  featureRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  featureIcon: { color: c.accent, fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  featureBody: { flex: 1 },
  featureTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 3 },
  featureText: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },

  sectionLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },

  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  themeCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  themeCardLocked: { opacity: 0.55 },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  swatch: { width: 16, height: 16, borderRadius: 5 },
  swatchAccent: { width: 28, height: 16, borderRadius: 5 },
  themeName: { fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  themeTagline: { fontSize: 10, lineHeight: 14, marginTop: 3, minHeight: 28 },
  themeBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  themeBadgeSpacer: { fontSize: 8, marginTop: 4 },

  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  planCardFeatured: { borderColor: c.accent, backgroundColor: c.accentMuted },
  planLeft: { flex: 1 },
  planTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  planCadence: { color: c.textTertiary, fontSize: 11, marginTop: 3 },
  planRight: { alignItems: 'flex-end' },
  planPrice: { color: c.accent, fontSize: 20, fontWeight: '900' },
  planNote: { color: c.accentDim, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },

  legal: { color: c.textFaint, fontSize: 10, lineHeight: 15, marginTop: 14 },

  cancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  cancelText: { color: c.textTertiary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
