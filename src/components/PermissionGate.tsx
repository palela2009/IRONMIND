import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionSteps } from './PermissionSteps';

export const PermissionGate: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const perms = usePermissions();
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const visible = perms.checked && !perms.coreGranted;

  const checkAgain = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try { await perms.refresh(); }
    finally { checkingRef.current = false; setChecking(false); }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.kickerPill}>
            <Text style={styles.kicker}>ACTION REQUIRED</Text>
          </View>
          <Text style={styles.title}>RECONNECT{'\n'}IRONMIND.</Text>
          <Text style={styles.sub}>
            Switch the item marked NEEDED back on so challenges and automatic duel tracking keep working.
          </Text>
          <PermissionSteps perms={perms} showOptionalTips={false} />
          <TouchableOpacity
            onPress={checkAgain}
            style={[styles.checkButton, checking && styles.checkButtonBusy]}
            activeOpacity={0.75}
            disabled={checking}
            accessibilityRole="button"
            accessibilityLabel="Check permissions again"
            accessibilityState={{ busy: checking, disabled: checking }}
          >
            {checking ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : (
              <Text style={styles.checkIcon} accessibilityElementsHidden importantForAccessibility="no">↻</Text>
            )}
            <Text style={styles.checkLabel}>{checking ? 'CHECKING...' : 'CHECK AGAIN'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.xl, paddingTop: spacing.xl, paddingBottom: 48 },
  kickerPill: {
    alignSelf: 'flex-start',
    backgroundColor: c.dangerMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  kicker: { color: c.danger, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: c.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.md, marginBottom: spacing.xl },
  checkButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  checkButtonBusy: { opacity: 0.7 },
  checkIcon: { color: c.accent, fontSize: 20, lineHeight: 24, fontWeight: '700' },
  checkLabel: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
});
