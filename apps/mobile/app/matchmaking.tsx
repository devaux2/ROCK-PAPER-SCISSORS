import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useMatchStore } from '../src/stores/matchStore';
import { game } from '../src/socket/socket';
import { Button, DisplayText, StatNumber } from '../src/components/ui';
import { theme } from '../src/theme';

const RING_SIZE = 180;

/** Radar-style expanding ring behind the fist. */
function RadarRing({ delay }: { delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      t.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.55 + t.value * 0.9 }],
    opacity: 0.55 * (1 - t.value),
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

/** The searching fist — steady pulse, like a heartbeat before the fight. */
function PulsingFist() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));
  return <Animated.Text style={[styles.fist, style]}>✊</Animated.Text>;
}

/** Thin accent bar with a gold segment sweeping side to side. */
function SweepBar() {
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [sweep]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (sweep.value - 0.5) * 140 }],
  }));
  return (
    <View style={styles.sweepTrack}>
      <Animated.View style={[styles.sweepSegment, theme.glow(theme.accent, 10), style]} />
    </View>
  );
}

export default function Matchmaking() {
  const router = useRouter();
  const queueMode = useMatchStore((s) => s.queueMode);
  const queueWager = useMatchStore((s) => s.queueWager);
  const stopQueueing = useMatchStore((s) => s.stopQueueing);
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Navigation to the match screen is owned by the (main) layout — the
  // one place that reacts to match:start no matter where the user is.

  function cancel() {
    game.leaveQueue();
    stopQueueing();
    router.back();
  }

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.radar}>
        <RadarRing delay={0} />
        <RadarRing delay={900} />
        <PulsingFist />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.center}>
        <DisplayText size={34} color={theme.accent} style={styles.title}>
          {queueMode === 'ranked' ? `Ranked · 🪙 ${queueWager}` : 'Casual match'}
        </DisplayText>
        {queueMode === 'ranked' && (
          <DisplayText
            size={24}
            color={theme.green}
            style={[{ textAlign: 'center', marginTop: 4 }, theme.textGlow(theme.green, 10)]}
          >
            Winner takes 🪙 {queueWager * 2}
          </DisplayText>
        )}
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.center}>
        <Text style={styles.sub}>Searching for an opponent…</Text>
        <StatNumber value={waited} suffix="s" size={40} color={theme.text} />
        <SweepBar />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.cancel}>
        <Button title="Cancel" variant="secondary" onPress={cancel} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  radar: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  fist: { fontSize: 64 },
  center: { alignItems: 'center' },
  title: {
    marginTop: theme.space(4),
    textAlign: 'center',
    textShadowColor: theme.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  sub: { color: theme.textDim, marginTop: theme.space(2), fontWeight: '600' },
  sweepTrack: {
    width: 180,
    height: 4,
    marginTop: theme.space(3),
    borderRadius: theme.radius.pill,
    backgroundColor: theme.bgRaised,
    overflow: 'visible',
    alignItems: 'center',
  },
  sweepSegment: {
    width: 44,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
  hint: { color: theme.blue, marginTop: 12, fontStyle: 'italic' },
  cancel: { position: 'absolute', bottom: 48, left: 24, right: 24 },
});
