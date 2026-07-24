import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useMatchStore } from '../src/stores/matchStore';
import { game } from '../src/socket/socket';
import { Button } from '../src/components/ui';
import { theme } from '../src/theme';

export default function Matchmaking() {
  const router = useRouter();
  const queueMode = useMatchStore((s) => s.queueMode);
  const queueWager = useMatchStore((s) => s.queueWager);
  const stopQueueing = useMatchStore((s) => s.stopQueueing);
  const [waited, setWaited] = useState(0);

  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1);
  }, [spin]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

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
      <Animated.Text style={[styles.spinner, spinStyle]}>✊</Animated.Text>
      <Text style={styles.title}>
        {queueMode === 'ranked' ? `Ranked · 🪙 ${queueWager}` : 'Casual match'}
      </Text>
      <Text style={styles.sub}>Searching for an opponent… {waited}s</Text>
      {queueMode === 'ranked' && waited > 6 && (
        <Text style={styles.hint}>Widening the Elo net to find you a match…</Text>
      )}
      <View style={styles.cancel}>
        <Button title="Cancel" variant="secondary" onPress={cancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  spinner: { fontSize: 64 },
  title: { color: theme.text, fontSize: 24, fontWeight: '900', marginTop: 20 },
  sub: { color: theme.textDim, marginTop: 8 },
  hint: { color: theme.blue, marginTop: 12, fontStyle: 'italic' },
  cancel: { position: 'absolute', bottom: 48, left: 24, right: 24 },
});
