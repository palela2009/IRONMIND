import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePro } from '../context/ProContext';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { PALETTES, Palette, paletteFor, radius, spacing, cardShadow } from '../theme';

export const WelcomeGiftScreen = () => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { welcomeGiftAvailable, claimWelcomeGift } = usePro();
  const permissions = usePermissions();
  const [selected, setSelected] = useState('ice');
  const [busy, setBusy] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [message, setMessage] = useState('');
  const visible = welcomeGiftAvailable && permissions.checked && permissions.allGranted && !deferred;
  const chosenPalette = paletteFor(selected);

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await claimWelcomeGift(selected);
      if (!result.ok) setMessage(result.message ?? 'Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => setDeferred(true)}>
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🎁 WELCOME PACK UNLOCKED</Text>
          </View>
          <Text style={styles.title}>MAKE IT YOURS.</Text>
          <Text style={styles.description}>
            Pick one Pro theme to keep forever — completely free. Your starter pack is already loaded:
          </Text>

          <View style={styles.packRow}>
            <View style={styles.packPill}>
              <Text style={styles.packVal}>🎨 1</Text>
              <Text style={styles.packLabel}>FREE THEME</Text>
            </View>
            <View style={styles.packPill}>
              <Text style={styles.packVal}>◉ 150</Text>
              <Text style={styles.packLabel}>COINS</Text>
            </View>
            <View style={[styles.packPill, styles.packPillIce]}>
              <Text style={styles.packValIce}>❄ 1</Text>
              <Text style={styles.packLabel}>FREEZE SHIELD</Text>
            </View>
          </View>

          <Text style={styles.section}>PICK YOUR FREE THEME · {PALETTES.filter((p) => p.pro).length} CHOICES</Text>
          <View style={styles.grid}>
            {PALETTES.filter((item) => item.pro).map((item) => {
              const active = selected === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.themeTile,
                    { backgroundColor: item.surface, borderColor: active ? item.accent : item.border },
                    active && styles.themeTileOn,
                  ]}
                  onPress={() => setSelected(item.id)}
                  disabled={busy}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={item.name}
                >
                  <View style={[styles.miniPhone, { backgroundColor: item.bg, borderColor: item.border }]}>
                    <View style={styles.miniTop}>
                      <View style={[styles.miniDot, { backgroundColor: item.accent }]} />
                      <View style={[styles.miniLineShort, { backgroundColor: item.surfaceRaised }]} />
                    </View>
                    <View style={[styles.miniCard, { backgroundColor: item.surfaceRaised }]}>
                      <View style={[styles.miniAccentBar, { backgroundColor: item.accent }]} />
                      <View style={[styles.miniLine, { backgroundColor: item.border }]} />
                    </View>
                  </View>

                  <View style={styles.tileHead}>
                    <Text style={[styles.themeName, { color: item.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                    <View style={[styles.radio, active && { borderColor: item.accent }]}>
                      {active && <View style={[styles.radioDot, { backgroundColor: item.accent }]} />}
                    </View>
                  </View>
                  <Text style={[styles.themeDescription, { color: item.textTertiary }]} numberOfLines={2}>
                    {item.tagline}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!message && <Text style={styles.error} accessibilityRole="alert">{message}</Text>}

          <TouchableOpacity
            style={[styles.claim, { backgroundColor: chosenPalette.accent }, busy && styles.disabled]}
            onPress={claim}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={chosenPalette.accentContrast} />
            ) : (
              <Text style={[styles.claimText, { color: chosenPalette.accentContrast }]}>
                CLAIM {chosenPalette.name} + WELCOME PACK →
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.later} onPress={() => setDeferred(true)} disabled={busy} accessibilityRole="button">
            <Text style={styles.laterText}>CHOOSE LATER IN THE SHOP</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  badgeText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: c.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: -0.9 },
  description: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.lg },

  packRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  packPill: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  packPillIce: { borderColor: 'rgba(56, 189, 248, 0.45)', backgroundColor: 'rgba(56, 189, 248, 0.08)' },
  packVal: { color: c.accent, fontSize: 15, fontWeight: '900' },
  packValIce: { color: '#9FD8FF', fontSize: 15, fontWeight: '900' },
  packLabel: { color: c.textTertiary, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },

  section: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  themeTile: {
    width: '48.5%',
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  themeTileOn: { ...cardShadow },
  miniPhone: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    marginBottom: 10,
    gap: 6,
  },
  miniTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  miniLineShort: { width: 38, height: 5, borderRadius: 3 },
  miniCard: { borderRadius: 6, padding: 7, gap: 5 },
  miniAccentBar: { width: '68%', height: 6, borderRadius: 3 },
  miniLine: { width: '45%', height: 4, borderRadius: 2 },

  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  themeName: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4, flex: 1 },
  themeDescription: { fontSize: 11, lineHeight: 15, marginTop: 4 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },

  claim: { minHeight: 54, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  claimText: { fontSize: 12, fontWeight: '900', textAlign: 'center', letterSpacing: 0.6 },
  disabled: { opacity: 0.6 },
  error: { color: c.danger, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },
  later: { padding: spacing.md, alignItems: 'center', marginTop: spacing.xs },
  laterText: { color: c.textTertiary, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 0.6 },
});
