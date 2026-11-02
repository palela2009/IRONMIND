import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePro } from '../context/ProContext';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import { PALETTES, Palette, radius, spacing } from '../theme';

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
          <Text style={styles.kicker}>WELCOME TO IRONMIND</Text>
          <Text style={styles.title}>MAKE IT{ '\n' }YOURS.</Text>
          <Text style={styles.description}>Choose a theme to keep forever. Your welcome pack also includes 150 starter coins and one streak freeze.</Text>
          <Text style={styles.section}>YOUR FREE THEME</Text>
          {PALETTES.filter((item) => item.pro).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.theme, selected === item.id && { borderColor: item.accent }]}
              onPress={() => setSelected(item.id)}
              disabled={busy}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected === item.id }}
              accessibilityLabel={item.name}
            >
              <View style={[styles.swatch, { backgroundColor: item.bg, borderColor: item.accent }]}>
                <View style={[styles.swatchAccent, { backgroundColor: item.accent }]} />
              </View>
              <View style={styles.themeBody}>
                <Text style={styles.themeName}>{item.name}</Text>
                <Text style={styles.themeDescription}>{item.tagline}</Text>
              </View>
              <View style={[styles.radio, selected === item.id && { borderColor: item.accent }]}>
                {selected === item.id && <View style={[styles.radioDot, { backgroundColor: item.accent }]} />}
              </View>
            </TouchableOpacity>
          ))}
          {!!message && <Text style={styles.error} accessibilityRole="alert">{message}</Text>}
          <TouchableOpacity style={[styles.claim, busy && styles.disabled]} onPress={claim} disabled={busy} activeOpacity={0.85} accessibilityRole="button">
            {busy ? <ActivityIndicator color={palette.accentContrast} /> : <Text style={styles.claimText}>CLAIM MY WELCOME GIFT</Text>}
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
  content: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },
  kicker: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  title: { color: c.textPrimary, fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: spacing.md },
  description: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.md, marginBottom: spacing.xl },
  section: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md },
  theme: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, padding: spacing.lg, marginBottom: spacing.sm },
  swatch: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  swatchAccent: { width: 20, height: 6, borderRadius: 3 },
  themeBody: { flex: 1, minWidth: 0 },
  themeName: { color: c.textPrimary, fontSize: 13, fontWeight: '900' },
  themeDescription: { color: c.textSecondary, fontSize: 11, marginTop: 4 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  claim: { minHeight: 52, borderRadius: radius.md, backgroundColor: c.accent, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  claimText: { color: c.accentContrast, fontSize: 12, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  disabled: { opacity: 0.6 },
  error: { color: c.danger, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  later: { padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
  laterText: { color: c.textSecondary, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 0.6 },
});
