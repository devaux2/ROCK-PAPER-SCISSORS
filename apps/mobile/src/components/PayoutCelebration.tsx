import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DisplayText } from './ui';
import { theme } from '../theme';
import { playSound } from '../sound';

/**
 * The money moment. Winner: coins erupt, the pot counts up huge, the
 * balance visibly rolls to its new total. Loser: the stake burns red.
 */
export function PayoutCelebration({
  won,
  wager,
  coinsDelta,
  newBalance,
}: {
  won: boolean;
  wager: number;
  coinsDelta: number;
  newBalance: number;
}) {
  const pot = wager * 2;

  if (won) return <WinnerPayout pot={pot} newBalance={newBalance} />;

  if (coinsDelta === 0) {
    // Voided match (both idle): the escrow came back, nothing changed hands.
    return (
      <Animated.View entering={FadeIn.delay(250)} style={styles.root}>
        <DisplayText size={24} color={theme.textDim}>
          Match void — stake returned
        </DisplayText>
        <Text style={styles.balanceLine}>
          balance <Text style={styles.balanceNum}>🪙 {newBalance}</Text>
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeIn.delay(250)} style={styles.root}>
      <DisplayText size={30} color={theme.danger} style={theme.textGlow(theme.danger, 12)}>
        −🪙 {wager}
      </DisplayText>
      <Text style={styles.balanceLine}>
        balance <Text style={styles.balanceNum}>🪙 {newBalance}</Text>
      </Text>
    </Animated.View>
  );
}

function WinnerPayout({ pot, newBalance }: { pot: number; newBalance: number }) {
  const [shown, setShown] = useState(0);
  const [balanceShown, setBalanceShown] = useState(newBalance - pot);
  const slam = useSharedValue(0);

  useEffect(() => {
    playSound('coins');
    slam.value = withDelay(150, withSpring(1, { damping: 10, stiffness: 220 }));
    // Pot counts up fast with an eased finish...
    const start = Date.now();
    const COUNT_MS = 850;
    const interval = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(pot * eased));
      if (t >= 1) clearInterval(interval);
    }, 30);
    // ...then the balance rolls up to its new total.
    const balStart = Date.now() + 500;
    const balInterval = setInterval(() => {
      const t = Math.min(1, (Date.now() - balStart) / 700);
      if (t <= 0) return;
      const eased = 1 - Math.pow(1 - t, 3);
      setBalanceShown(Math.round(newBalance - pot + pot * eased));
      if (t >= 1) clearInterval(balInterval);
    }, 30);
    return () => {
      clearInterval(interval);
      clearInterval(balInterval);
    };
  }, [pot, newBalance, slam]);

  const potStyle = useAnimatedStyle(() => ({
    opacity: slam.value,
    transform: [{ scale: 0.5 + slam.value * 0.5 }],
  }));

  return (
    <View style={styles.root}>
      <CoinBurst />
      <Animated.View style={[styles.potWrap, potStyle]}>
        <DisplayText size={22} color={theme.accent}>
          You win
        </DisplayText>
        <DisplayText
          size={64}
          color={theme.accent}
          style={theme.textGlow(theme.accent, 24)}
        >
          🪙 {shown}
        </DisplayText>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(600)}>
        <Text style={styles.balanceLine}>
          balance <Text style={styles.balanceNum}>🪙 {balanceShown}</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

/** 12 coins erupt from the center — deterministic per-index arcs. */
function CoinBurst() {
  return (
    <View pointerEvents="none" style={styles.burstLayer}>
      {Array.from({ length: 12 }, (_, i) => (
        <Coin key={i} index={i} />
      ))}
    </View>
  );
}

function Coin({ index }: { index: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      120 + index * 45,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })
    );
  }, [t, index]);
  // Spread angles across a fan; alternate heights for a fountain feel.
  const angle = (index / 11) * Math.PI - Math.PI; // -180°..0° (upward fan)
  const dist = 90 + (index % 3) * 42;
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value * 0.9,
    transform: [
      { translateX: Math.cos(angle) * dist * t.value },
      // Rise, then gravity pulls the tail of the arc back down.
      { translateY: Math.sin(angle) * dist * t.value + 70 * t.value * t.value },
      { rotate: `${t.value * (index % 2 ? 260 : -220)}deg` },
      { scale: 0.7 + (index % 4) * 0.15 },
    ],
  }));
  return (
    <Animated.Text style={[styles.coin, style]}>🪙</Animated.Text>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', marginTop: theme.space(3) },
  potWrap: { alignItems: 'center' },
  balanceLine: { color: theme.textDim, marginTop: theme.space(2), fontWeight: '700' },
  balanceNum: { color: theme.text, fontWeight: '900' },
  burstLayer: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  coin: { position: 'absolute', fontSize: 26 },
});
