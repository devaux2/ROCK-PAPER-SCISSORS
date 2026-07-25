import React, { useEffect, useState } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';
import { playSound } from '../sound';

/**
 * Counts down to an absolute epoch-ms deadline (server-authoritative).
 * Final 3 seconds: flips hot and pulses on every tick.
 */
export function Countdown({ deadline }: { deadline: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));
  const pulse = useSharedValue(1);
  const seconds = Math.ceil(remaining / 1000);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, deadline - Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [deadline]);

  useEffect(() => {
    if (seconds <= 3 && seconds > 0) {
      playSound('tick');
      pulse.value = withSequence(
        withSpring(1.22, theme.springs.pop),
        withTiming(1, { duration: 220 })
      );
    }
  }, [seconds, pulse]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const urgent = seconds <= 3;

  return (
    <Animated.Text
      style={[
        {
          fontFamily: theme.fonts.display,
          fontSize: 44,
          letterSpacing: 2,
          textAlign: 'center',
          color: urgent ? theme.danger : theme.text,
        },
        animated,
      ]}
    >
      {seconds}
    </Animated.Text>
  );
}
