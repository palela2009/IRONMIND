import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing } from 'react-native';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';

export interface DialogButton {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let nextId = 1;
let queue: DialogRequest[] = [];
const listeners = new Set<(q: DialogRequest[]) => void>();

const publish = () => listeners.forEach((l) => l([...queue]));

export const appAlert = (title: string, message?: string, buttons?: DialogButton[]) => {
  queue.push({ id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
  publish();
};

export const AppDialogHost: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState<DialogRequest[]>([]);
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  const current = items[0];

  useEffect(() => {
    if (!current) return;
    fade.setValue(0);
    pop.setValue(0.92);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 200, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
    ]).start();
  }, [current?.id]);

  if (!current) return null;

  const close = (button?: DialogButton) => {
    queue = queue.filter((q) => q.id !== current.id);
    publish();
    button?.onPress?.();
  };

  const cancelButton = current.buttons.find((b) => b.style === 'cancel');
  const ordered = [...current.buttons.filter((b) => b.style !== 'cancel'), ...(cancelButton ? [cancelButton] : [])];

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close(cancelButton)}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: pop }] }]}>
          <Text style={styles.title}>{current.title}</Text>
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}
          <View style={styles.buttons}>
            {ordered.map((b, i) => {
              const primary = i === 0 && b.style !== 'cancel';
              const destructive = b.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${b.text}-${i}`}
                  style={[
                    styles.button,
                    primary && !destructive && styles.buttonPrimary,
                    destructive && styles.buttonDanger,
                    b.style === 'cancel' && styles.buttonGhost,
                  ]}
                  onPress={() => close(b)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      primary && !destructive && styles.buttonTextPrimary,
                      destructive && styles.buttonTextDanger,
                      b.style === 'cancel' && styles.buttonTextGhost,
                    ]}
                  >
                    {(b.text ?? 'OK').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: { color: c.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: -0.2, marginBottom: spacing.sm },
  message: { color: c.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  buttons: { gap: spacing.sm, marginTop: spacing.sm },
  button: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: c.surfaceRaised,
  },
  buttonPrimary: { backgroundColor: c.accent },
  buttonDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.danger },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonText: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  buttonTextPrimary: { color: c.accentContrast },
  buttonTextDanger: { color: c.danger },
  buttonTextGhost: { color: c.textTertiary },
});
