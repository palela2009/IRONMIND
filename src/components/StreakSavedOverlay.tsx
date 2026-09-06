import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';

interface Props {
  streak: number;
  source: 'freeze' | 'ad' | null;
  onDone: () => void;
}

const HOLD_MS = 1500;

export const StreakSavedOverlay: React.FC<Props> = ({ streak, source, onDone }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();

  const visible = source !== null && streak > 0;

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.6)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (!visible) return;

    fade.setValue(0);
    pop.setValue(0.6);
    ring.setValue(0);
    lift.setValue(14);

    const enter = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(ring, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 320,
        delay: 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const exit = Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true });

    enter.start();
    const timer = setTimeout(() => exit.start(({ finished }) => finished && onDone()), HOLD_MS);

    return () => {
      clearTimeout(timer);
      enter.stop();
      exit.stop();
    };
  }, [visible, streak, source]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDone}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <View style={styles.center}>
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) }],
                },
              ]}
            />
            <Animated.View style={[styles.badge, { transform: [{ scale: pop }] }]}>
              <Text style={styles.glyph}>{source === 'ad' ? '▶' : '❄'}</Text>
            </Animated.View>
          </View>

          <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }] }}>
            <Text style={styles.title}>STREAK SAVED</Text>
            <Text style={styles.streak}>{streak}</Text>
            <Text style={styles.sub}>
              {source === 'ad'
                ? 'Reclaimed by watching an ad. Your run continues.'
                : 'A streak freeze absorbed that failure. Your run continues.'}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  center: { alignItems: 'center' },

  badgeWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  ring: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: c.accent,
  },
  badge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: c.accentMuted,
    borderWidth: 2,
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { color: c.accent, fontSize: 38, fontWeight: '900' },

  title: {
    color: c.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  streak: {
    color: c.textPrimary,
    fontSize: 68,
    fontWeight: '900',
    letterSpacing: -3,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sub: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
