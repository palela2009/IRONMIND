import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  playKey: number;
}

export const SwordsClash: React.FC<Props> = ({ playKey }) => {
  const palette = useTheme();
  const [visible, setVisible] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const label = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (playKey === 0) return;
    setVisible(true);
    [fade, left, right, flash, shake, label].forEach((v) => v.setValue(0));

    const charge = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(left, { toValue: 1, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(right, { toValue: 1, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]);
    const impact = Animated.parallel([
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
      Animated.sequence(
        [1, -1, 0.6, -0.6, 0].map((v) =>
          Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true })
        )
      ),
      Animated.timing(label, { toValue: 1, duration: 300, delay: 120, useNativeDriver: true }),
    ]);
    const exit = Animated.timing(fade, { toValue: 0, duration: 300, delay: 700, useNativeDriver: true });

    Animated.sequence([charge, impact, exit]).start(() => setVisible(false));
  }, [playKey]);

  if (!visible) return null;

  const leftStyle = {
    transform: [
      { translateX: left.interpolate({ inputRange: [0, 1], outputRange: [-220, -18] }) },
      { rotate: left.interpolate({ inputRange: [0, 1], outputRange: ['-80deg', '-35deg'] }) },
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
    ],
  };
  const rightStyle = {
    transform: [
      { translateX: right.interpolate({ inputRange: [0, 1], outputRange: [220, 18] }) },
      { rotate: right.interpolate({ inputRange: [0, 1], outputRange: ['80deg', '35deg'] }) },
      { scaleX: -1 },
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
    ],
  };

  return (
    <Modal visible transparent animationType="none">
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <View style={styles.stage}>
          <Animated.Text style={[styles.sword, leftStyle]}>🗡</Animated.Text>
          <Animated.Text style={[styles.sword, rightStyle]}>🗡</Animated.Text>
          <Animated.View
            style={[
              styles.flash,
              {
                backgroundColor: palette.accent,
                opacity: flash,
                transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) }],
              },
            ]}
          />
          <Animated.Text style={[styles.spark, { color: palette.accent, opacity: flash }]}>✦</Animated.Text>
        </View>
        <Animated.Text
          style={[
            styles.label,
            {
              color: palette.accent,
              opacity: label,
              transform: [{ translateY: label.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          DUEL SENT
        </Animated.Text>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center' },
  stage: { width: 300, height: 200, justifyContent: 'center', alignItems: 'center' },
  sword: { position: 'absolute', fontSize: 96 },
  flash: { position: 'absolute', width: 90, height: 90, borderRadius: 45 },
  spark: { position: 'absolute', fontSize: 64, fontWeight: '900' },
  label: { fontSize: 18, fontWeight: '900', letterSpacing: 4, marginTop: 8 },
});
