import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { Skin, MoveButtonProps, RevealSceneProps, MatchEndSceneProps } from '../types';
import { fighterMeta } from './meta';

function MoveButton({ move, disabled, selected, onPress }: MoveButtonProps) {
  const m = fighterMeta.moves[move];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.moveButton,
        selected && styles.moveButtonSelected,
        (pressed || disabled) && !selected && { opacity: 0.55 },
      ]}
    >
      <Text style={styles.moveIcon}>{m.icon}</Text>
      <Text style={styles.moveLabel}>{m.label.toUpperCase()}</Text>
    </Pressable>
  );
}

/**
 * Side-view arena: "3·2·1·FIGHT!" flash, then both fighters lunge with
 * their attacks; the loser takes a hit-flash and staggers back.
 */
function RevealScene({ myMove, oppMove, outcome, onDone }: RevealSceneProps) {
  const [countdown, setCountdown] = useState<'3' | '2' | '1' | 'FIGHT!' | null>('3');
  const myLunge = useSharedValue(0);
  const oppLunge = useSharedValue(0);
  const hitFlash = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const done = useSharedValue(0);

  useEffect(() => {
    const steps: Array<'3' | '2' | '1' | 'FIGHT!'> = ['3', '2', '1', 'FIGHT!'];
    const timers = steps.map((step, i) =>
      setTimeout(() => setCountdown(step), i * 350)
    );
    const attack = setTimeout(() => {
      setCountdown(null);
      // Both attack; springs carry them into contact.
      myLunge.value = withSpring(1, { damping: 12, stiffness: 220 });
      oppLunge.value = withSpring(1, { damping: 12, stiffness: 220 });
      hitFlash.value = withDelay(
        160,
        withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 220 }))
      );
      shakeX.value = withDelay(
        160,
        withSequence(
          withTiming(8, { duration: 40 }),
          withTiming(-7, { duration: 40 }),
          withTiming(5, { duration: 40 }),
          withTiming(0, { duration: 40 })
        )
      );
      done.value = withDelay(
        1500,
        withTiming(1, { duration: 1 }, () => {
          runOnJS(onDone)();
        })
      );
    }, steps.length * 350 + 250);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(attack);
    };
  }, [myLunge, oppLunge, hitFlash, shakeX, done, onDone]);

  const isBlockMine = myMove === 'C';
  const isBlockOpp = oppMove === 'C';

  const myStyle = useAnimatedStyle(() => ({
    transform: [
      // Blocks hold their ground; attacks lunge across the arena.
      { translateX: myLunge.value * (isBlockMine ? 12 : 62) },
      { rotate: `${myLunge.value * (myMove === 'A' ? -24 : 0)}deg` },
      { translateX: outcome === 'lose' ? hitFlash.value * -26 : 0 },
      { scale: isBlockMine ? 1 + myLunge.value * 0.08 : 1 },
    ],
  }));
  const oppStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -oppLunge.value * (isBlockOpp ? 12 : 62) },
      { rotate: `${oppLunge.value * (oppMove === 'A' ? 24 : 0)}deg` },
      { translateX: outcome === 'win' ? hitFlash.value * 26 : 0 },
      { scale: isBlockOpp ? 1 + oppLunge.value * 0.08 : 1 },
    ],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: hitFlash.value * 0.85 }));
  const arenaShake = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const verdictStyle = useAnimatedStyle(() => ({
    opacity: done.value === 0 ? hitFlash.value === 0 && myLunge.value > 0.9 ? 1 : 0 : 1,
  }));

  return (
    <View style={styles.revealRoot}>
      {countdown !== null && (
        <Text style={[styles.countdown, countdown === 'FIGHT!' && styles.fight]}>{countdown}</Text>
      )}
      <Animated.View style={[styles.arena, arenaShake]}>
        <Animated.View style={[styles.fighterSide, myStyle]}>
          <Text style={styles.fighterEmoji}>🥋</Text>
          <Text style={styles.attackEmoji}>{fighterMeta.moves[myMove].icon}</Text>
        </Animated.View>
        <Animated.View style={[styles.fighterSide, styles.oppSide, oppStyle]}>
          <Text style={styles.attackEmoji}>{fighterMeta.moves[oppMove].icon}</Text>
          <Text style={styles.fighterEmoji}>🥷</Text>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.hitFlash, flashStyle]} />
      </Animated.View>
      {countdown === null && (
        <Animated.Text
          style={[
            styles.verdict,
            verdictStyle,
            outcome === 'win' && { color: '#3FB950' },
            outcome === 'lose' && { color: fighterMeta.theme.accent },
          ]}
        >
          {outcome === 'win'
            ? `${fighterMeta.moves[myMove].label.toUpperCase()} CONNECTS!`
            : outcome === 'lose'
              ? `${fighterMeta.moves[oppMove].label.toUpperCase()} CONNECTS!`
              : 'CLASH! GO AGAIN!'}
        </Animated.Text>
      )}
    </View>
  );
}

function MatchEndScene({ won, reason }: MatchEndSceneProps) {
  const slide = useSharedValue(0);
  useEffect(() => {
    slide.value = withSpring(1, { damping: 10 });
  }, [slide]);
  const style = useAnimatedStyle(() => ({
    opacity: slide.value,
    transform: [{ translateY: (1 - slide.value) * 40 }],
  }));
  return (
    <Animated.View style={[styles.endRoot, style]}>
      <Text style={styles.endEmoji}>{won ? '🥇' : '🩹'}</Text>
      <Text style={[styles.endTitle, { color: won ? fighterMeta.theme.accent : '#B98A8A' }]}>
        {won ? 'K.O. — YOU WIN' : 'K.O. — YOU LOSE'}
      </Text>
      {reason !== 'score' && (
        <Text style={styles.endReason}>
          {reason === 'forfeit' ? 'opponent threw in the towel' : 'opponent fled the arena'}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  moveButton: {
    alignItems: 'center',
    backgroundColor: fighterMeta.theme.panel,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#57272F',
    paddingVertical: 16,
    paddingHorizontal: 8,
    flex: 1,
    marginHorizontal: 6,
  },
  moveButtonSelected: {
    borderColor: fighterMeta.theme.accent,
    backgroundColor: '#4A1F27',
  },
  moveIcon: { fontSize: 40 },
  moveLabel: {
    color: fighterMeta.theme.text,
    marginTop: 6,
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 12,
  },
  revealRoot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  countdown: {
    position: 'absolute',
    top: 20,
    fontSize: 46,
    fontWeight: '900',
    color: fighterMeta.theme.text,
    letterSpacing: 3,
  },
  fight: { color: fighterMeta.theme.accent, fontSize: 52 },
  arena: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
    height: 160,
  },
  fighterSide: { flexDirection: 'row', alignItems: 'center' },
  oppSide: {},
  fighterEmoji: { fontSize: 64 },
  attackEmoji: { fontSize: 44, marginHorizontal: 2 },
  hitFlash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  verdict: {
    marginTop: 28,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
    color: fighterMeta.theme.text,
  },
  endRoot: { alignItems: 'center' },
  endEmoji: { fontSize: 72 },
  endTitle: { fontSize: 30, fontWeight: '900', letterSpacing: 2, marginTop: 8 },
  endReason: { color: fighterMeta.theme.textDim, marginTop: 6 },
});

export const fighterSkin: Skin = {
  ...fighterMeta,
  MoveButton,
  RevealScene,
  MatchEndScene,
};
