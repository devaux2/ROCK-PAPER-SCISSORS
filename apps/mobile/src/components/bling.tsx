import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../theme';

/**
 * The shared "money glitter" toolkit: floating coins, shine sweeps and the
 * gold plate CTA. Everything here is ambient decoration — pointerEvents
 * none, deterministic layouts (no Math.random), gentle infinite loops.
 */

/** One lazily bobbing, slowly spinning coin. */
function FloatingCoin({
  x,
  y,
  size,
  duration,
  delay,
  drift,
}: {
  x: number | string;
  y: number | string;
  size: number;
  duration: number;
  delay: number;
  drift: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [t, duration, delay]);
  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: t.value * -drift },
      { rotate: `${(t.value - 0.5) * 24}deg` },
    ],
    opacity: 0.55 + t.value * 0.45,
  }));
  return (
    <Animated.Text
      style={[
        // eslint-disable-next-line react-native/no-inline-styles
        {
          position: 'absolute',
          left: x as never,
          top: y as never,
          fontSize: size,
        },
        theme.textGlow('rgba(255,178,32,0.8)', 10),
        animated,
      ]}
    >
      🪙
    </Animated.Text>
  );
}

/** Deterministic scatter of drifting coins filling the parent. */
export function CoinField({ count = 8, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const coins = Array.from({ length: count }, (_, i) => {
    // Halton-ish scatter: stable, looks random, never overlaps badly.
    const fx = ((i * 47) % 100) / 100;
    const fy = ((i * 31 + 13) % 100) / 100;
    return {
      x: `${4 + fx * 88}%`,
      y: `${2 + fy * 88}%`,
      size: 14 + ((i * 7) % 3) * 5,
      duration: 2200 + (i % 4) * 500,
      delay: (i * 260) % 1400,
      drift: 8 + (i % 3) * 5,
    };
  });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {coins.map((c, i) => (
        <FloatingCoin key={i} {...c} />
      ))}
    </View>
  );
}

/** Diagonal light bar that sweeps across the parent every few seconds. */
export function ShineSweep({ period = 2800, width = 70 }: { period?: number; width?: number }) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: Math.max(0, period - 900) }) // hold off-screen
      ),
      -1
    );
  }, [x, period]);
  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateX: -width * 2 + x.value * 500 },
      { rotate: '18deg' },
    ],
  }));
  return (
    <View pointerEvents="none" style={styles.shineClip}>
      <Animated.View style={[styles.shineBar, { width }, animated]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.38)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/**
 * The gold plate: a heavy gradient slab with a rim highlight, ambient glow
 * pulse and a periodic shine sweep. Every "give me your money" CTA is one
 * of these.
 */
export function GoldPlate({
  children,
  style,
  disabled,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [pulse]);
  const glowAnim = useAnimatedStyle(() => ({
    shadowOpacity: disabled ? 0 : 0.35 + pulse.value * 0.35,
  }));
  return (
    <Animated.View
      style={[
        styles.plateGlow,
        theme.glow('#FFB020', 26),
        glowAnim,
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <LinearGradient
        colors={theme.gradients.cta}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.plate}
      >
        <View style={styles.plateRim} pointerEvents="none" />
        {children}
        {!disabled && <ShineSweep />}
      </LinearGradient>
    </Animated.View>
  );
}

/** Warm radial-ish pool of light — stack behind heroes. */
export function LightPool({
  size,
  color = 'rgba(255,178,32,0.07)',
  style,
}: {
  size: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 1,
          shadowRadius: size / 2,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

/** Tiny gold coin-and-number lockup used everywhere money is shown. */
export function CoinAmount({
  amount,
  size = 18,
  color = theme.accent,
}: {
  amount: number | string;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      style={{
        fontFamily: theme.fonts.numeric,
        fontSize: size,
        color,
        letterSpacing: 1,
      }}
    >
      🪙 {amount}
    </Text>
  );
}

const styles = StyleSheet.create({
  shineClip: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
  },
  shineBar: {
    position: 'absolute',
    top: -40,
    bottom: -40,
  },
  plateGlow: {
    borderRadius: theme.radius.lg,
  },
  plate: {
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plateRim: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
