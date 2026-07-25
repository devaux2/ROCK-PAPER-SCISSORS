import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Avatar } from './Avatar';
import { DisplayText } from './ui';
import { theme } from '../theme';
import { playSound } from '../sound';

interface Fighter {
  username: string;
  avatar: string;
}

/**
 * Match-found slam: both fighters crash in from the sides, VS punches
 * through the middle, then everything whips away (~1.2s total — the
 * server grants the first round exactly this much extra time).
 */
export function VsOverlay({
  me,
  opponent,
  accent,
  onDone,
}: {
  me: Fighter;
  opponent: Fighter;
  accent: string;
  onDone: () => void;
}) {
  const slam = useSharedValue(0);
  const vsPunch = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    playSound('found');
    slam.value = withSpring(1, { damping: 14, stiffness: 240 });
    vsPunch.value = withDelay(220, withSpring(1, { damping: 9, stiffness: 300 }));
    exit.value = withDelay(
      1050,
      withTiming(1, { duration: 180, easing: Easing.in(Easing.quad) }, () => {
        runOnJS(onDone)();
      })
    );
  }, [slam, vsPunch, exit, onDone]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: (1 - exit.value) * 0.94,
  }));
  const mine = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - slam.value) * -220 + exit.value * -220 }],
    opacity: 1 - exit.value,
  }));
  const theirs = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - slam.value) * 220 + exit.value * 220 }],
    opacity: 1 - exit.value,
  }));
  const vs = useAnimatedStyle(() => ({
    opacity: vsPunch.value * (1 - exit.value),
    transform: [{ scale: 2.4 - vsPunch.value * 1.4 }, { rotate: '-8deg' }],
  }));

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.backdrop, backdrop]} />
      <View style={styles.row}>
        <Animated.View style={[styles.fighter, mine]}>
          <Avatar avatar={me.avatar} size={84} />
          <DisplayText size={20} style={{ marginTop: 8 }}>
            {me.username}
          </DisplayText>
        </Animated.View>
        <Animated.View style={vs}>
          <DisplayText size={64} color={accent} style={theme.textGlow(accent, 22)}>
            VS
          </DisplayText>
        </Animated.View>
        <Animated.View style={[styles.fighter, theirs]}>
          <Avatar avatar={opponent.avatar} size={84} />
          <DisplayText size={20} style={{ marginTop: 8 }}>
            {opponent.username}
          </DisplayText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.bg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 12,
  },
  fighter: { alignItems: 'center', width: 120 },
});
