import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import type { Skin, MoveButtonProps, RevealSceneProps, MatchEndSceneProps } from '../types';
import { fighterMeta } from './meta';
import { theme } from '../../theme';
import { PressableScale, DisplayText } from '../../components/ui';

function MoveButton({ move, disabled, selected, onPress }: MoveButtonProps) {
  const m = fighterMeta.moves[move];
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = selected
      ? withSpring(1, theme.springs.pop)
      : withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
  }, [selected, pop]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.07 }],
    shadowOpacity: pop.value * 0.65,
  }));
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={styles.moveButtonWrap}>
      <Animated.View
        style={[
          styles.moveButton,
          theme.glow(fighterMeta.theme.accent, 16),
          { shadowOpacity: 0 },
          selected && styles.moveButtonSelected,
          disabled && !selected && { opacity: 0.55 },
          animated,
        ]}
      >
        <Text style={styles.moveIcon}>{m.icon}</Text>
        <Text style={styles.moveLabel}>{m.label.toUpperCase()}</Text>
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Side-view arena: "3·2·1·FIGHT!" snaps in hard, then both fighters lunge
 * in an arc; hit-flash + screen shake on contact, a beat of hit-stop, then
 * both settle back as the verdict lands.
 */
function RevealScene({ myMove, oppMove, outcome, onDone }: RevealSceneProps) {
  const [countdown, setCountdown] = useState<'3' | '2' | '1' | 'FIGHT!' | null>('3');
  const myLunge = useSharedValue(0);
  const oppLunge = useSharedValue(0);
  const hitFlash = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const recoil = useSharedValue(0);
  const cdSnap = useSharedValue(1);
  const done = useSharedValue(0);

  useEffect(() => {
    if (countdown === null) return;
    // Punchy flash: slam from oversized + transparent to rest in one snap.
    cdSnap.value = 0;
    cdSnap.value = withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) });
  }, [countdown, cdSnap]);

  useEffect(() => {
    const steps: Array<'3' | '2' | '1' | 'FIGHT!'> = ['3', '2', '1', 'FIGHT!'];
    const timers = steps.map((step, i) => setTimeout(() => setCountdown(step), i * 300));
    const attack = setTimeout(() => {
      setCountdown(null);
      // Both attack; springs carry them into contact along a rising arc.
      myLunge.value = withSpring(1, { damping: 11, stiffness: 260 });
      oppLunge.value = withSpring(1, { damping: 11, stiffness: 260 });
      hitFlash.value = withDelay(
        150,
        withSequence(withTiming(1, { duration: 50 }), withTiming(0, { duration: 200 }))
      );
      shakeX.value = withDelay(
        150,
        withSequence(
          withTiming(10, { duration: 35 }),
          withTiming(-9, { duration: 35 }),
          withTiming(6, { duration: 35 }),
          withTiming(-3, { duration: 35 }),
          withTiming(0, { duration: 35 })
        )
      );
      // Hit-stop: hold the impact pose for a beat, then settle back.
      recoil.value = withDelay(460, withSpring(1, { damping: 14, stiffness: 190 }));
      done.value = withDelay(
        1350,
        withTiming(1, { duration: 1 }, () => {
          runOnJS(onDone)();
        })
      );
    }, steps.length * 300 + 220);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(attack);
    };
  }, [myLunge, oppLunge, hitFlash, shakeX, recoil, done, onDone]);

  const isBlockMine = myMove === 'C';
  const isBlockOpp = oppMove === 'C';

  const myStyle = useAnimatedStyle(() => ({
    transform: [
      // Blocks hold their ground; attacks lunge across the arena in an arc.
      { translateX: myLunge.value * (isBlockMine ? 14 : 78) - recoil.value * (isBlockMine ? 6 : 22) },
      { translateY: isBlockMine ? 0 : -Math.sin(myLunge.value * Math.PI) * 20 },
      { rotate: `${myLunge.value * (myMove === 'A' ? -26 : 0)}deg` },
      { translateX: outcome === 'lose' ? hitFlash.value * -28 : 0 },
      { scale: isBlockMine ? 1 + myLunge.value * 0.1 : 1 },
    ],
  }));
  const oppStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -oppLunge.value * (isBlockOpp ? 14 : 78) + recoil.value * (isBlockOpp ? 6 : 22) },
      { translateY: isBlockOpp ? 0 : -Math.sin(oppLunge.value * Math.PI) * 20 },
      { rotate: `${oppLunge.value * (oppMove === 'A' ? 26 : 0)}deg` },
      { translateX: outcome === 'win' ? hitFlash.value * 28 : 0 },
      { scale: isBlockOpp ? 1 + oppLunge.value * 0.1 : 1 },
    ],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: hitFlash.value * 0.85 }));
  const arenaShake = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const cdStyle = useAnimatedStyle(() => ({
    opacity: cdSnap.value,
    transform: [{ scale: 2 - cdSnap.value }],
  }));
  const verdictStyle = useAnimatedStyle(() => ({
    opacity: done.value === 0 ? (hitFlash.value === 0 && myLunge.value > 0.9 ? 1 : 0) : 1,
    transform: [{ translateY: (1 - recoil.value) * 10 }],
  }));

  return (
    <View style={styles.revealRoot}>
      {countdown !== null && (
        <Animated.View style={[styles.countdownWrap, cdStyle]}>
          <DisplayText
            size={countdown === 'FIGHT!' ? 58 : 52}
            color={countdown === 'FIGHT!' ? fighterMeta.theme.accent : fighterMeta.theme.text}
            style={countdown === 'FIGHT!' ? theme.textGlow(fighterMeta.theme.accent, 20) : undefined}
          >
            {countdown}
          </DisplayText>
        </Animated.View>
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
        <Animated.View style={[styles.verdictWrap, verdictStyle]}>
          <DisplayText
            size={24}
            color={
              outcome === 'win'
                ? theme.green
                : outcome === 'lose'
                  ? fighterMeta.theme.accent
                  : fighterMeta.theme.text
            }
          >
            {outcome === 'win'
              ? `${fighterMeta.moves[myMove].label.toUpperCase()} CONNECTS!`
              : outcome === 'lose'
                ? `${fighterMeta.moves[oppMove].label.toUpperCase()} CONNECTS!`
                : 'CLASH! GO AGAIN!'}
          </DisplayText>
        </Animated.View>
      )}
    </View>
  );
}

function MatchEndScene({ won, reason }: MatchEndSceneProps) {
  const title = won ? 'K.O. — YOU WIN' : 'K.O. — YOU LOSE';
  const letters = title.split('');
  return (
    <View style={styles.endRoot}>
      <Animated.Text entering={FadeIn.delay(letters.length * 45 + 200)} style={styles.endEmoji}>
        {won ? '🥇' : '🩹'}
      </Animated.Text>
      <View
        style={styles.koRow}
        accessible
        accessibilityRole="text"
        accessibilityLabel={title}
      >
        {letters.map((ch, i) => (
          <Animated.View
            key={`${ch}-${i}`}
            entering={FadeInDown.delay(i * 45).springify().damping(11).stiffness(320)}
          >
            <DisplayText
              size={40}
              color={won ? fighterMeta.theme.accent : theme.danger}
              style={theme.textGlow(won ? fighterMeta.theme.accent : theme.danger, 16)}
            >
              {ch === ' ' ? ' ' : ch}
            </DisplayText>
          </Animated.View>
        ))}
      </View>
      {reason !== 'score' && (
        <Animated.Text entering={FadeIn.delay(letters.length * 45 + 320)} style={styles.endReason}>
          {reason === 'forfeit' ? 'opponent threw in the towel' : 'opponent fled the arena'}
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  moveButtonWrap: { flex: 1, marginHorizontal: 6 },
  moveButton: {
    alignItems: 'center',
    backgroundColor: fighterMeta.theme.panel,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#57272F',
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  moveButtonSelected: {
    borderColor: fighterMeta.theme.accent,
    backgroundColor: '#4A1F27',
  },
  moveIcon: { fontSize: 48 },
  moveLabel: {
    color: fighterMeta.theme.text,
    marginTop: 6,
    fontWeight: '900',
    letterSpacing: 2,
    fontSize: 12,
  },
  revealRoot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  countdownWrap: { position: 'absolute', top: 16, alignItems: 'center' },
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
  verdictWrap: { marginTop: 28, alignItems: 'center' },
  endRoot: { alignItems: 'center' },
  endEmoji: { fontSize: 76 },
  koRow: { flexDirection: 'row', marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  endReason: { color: fighterMeta.theme.textDim, marginTop: 6, fontWeight: '600' },
});

export const fighterSkin: Skin = {
  ...fighterMeta,
  MoveButton,
  RevealScene,
  MatchEndScene,
};
