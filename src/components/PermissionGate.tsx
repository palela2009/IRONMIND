import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, spacing } from '../theme';
import { usePermissions } from '../hooks/usePermissions';
import { PermissionSteps } from './PermissionSteps';

export const PermissionGate: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const perms = usePermissions();
  const visible = perms.checked && !perms.allGranted;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>IRONMIND IS NOT RUNNING</Text>
          <Text style={styles.title}>TURN THESE{'\n'}BACK ON.</Text>
          <Text style={styles.sub}>
            Without all three, IRONMIND cannot see when you open an app and no challenge will fire. This
            screen closes by itself once everything is green.
          </Text>
          <PermissionSteps perms={perms} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.xl, paddingTop: 64, paddingBottom: 48 },
  kicker: { color: c.danger, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: spacing.md },
  title: { color: c.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.md, marginBottom: spacing.xl },
});
