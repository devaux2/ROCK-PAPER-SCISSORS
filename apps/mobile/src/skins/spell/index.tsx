import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import type { Skin, MoveButtonProps, RevealSceneProps, MatchEndSceneProps } from '../types';
import { spellMeta } from './meta';

function MoveButton({ move, disabled, selected, onPress }: MoveButtonProps) {
  const m = spellMeta.moves[move];
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
      <Text style={styles.moveLabel}>{m.label}</Text>
    </Pressable>
  );
}

/**
 * Two wizards channel; spell orbs orbit each caster, then both spells fly
 * to the center and collide in a burst; the winning element flares.
 */
function RevealScene({ myMove, oppMove, outcome, onDone }: RevealSceneProps) {
  const channel = useSharedValue(0);
  const cast = useSharedValue(0);
  const burst = useSharedValue(0);
  const done = useSharedValue(0);

  useEffect(() => {
    channel.value = withRepeat(
      withTiming(1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
      3,
      true,
      () => {
        cast.value = withTiming(1, { duration: 320, easing: Easing.in(Easing.quad) }, () => {
          burst.value = withSequence(
            withTiming(1, { duration: 120 }),
            withTiming(0.85, { duration: 700 })
          );
        });
        // Total scene ≈ 0.5*3 channel + 0.32 cast + ~1.7s hold.
        done.value = withDelay(
          2000,
          withTiming(1, { duration: 1 }, () => {
            runOnJS(onDone)();
          })
        );
      }
    );
  }, [channel, cast, burst, done, onDone]);

  const myOrb = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 - channel.value * 10 },
      { translateX: cast.value * 96 },
      { scale: 1 + channel.value * 0.15 + cast.value * 0.2 },
    ],
    opacity: burst.value > 0 ? 0 : 1,
  }));
  const oppOrb = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 - channel.value * 10 },
      { translateX: -cast.value * 96 },
      { scale: 1 + channel.value * 0.15 + cast.value * 0.2 },
    ],
    opacity: burst.value > 0 ? 0 : 1,
  }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.3 + burst.value * 1.1 }],
  }));

  const winningIcon =
    outcome === 'draw'
      ? '✨'
      : outcome === 'win'
        ? spellMeta.moves[myMove].icon
        : spellMeta.moves[oppMove].icon;

  return (
    <View style={styles.revealRoot}>
      <View style={styles.duelRow}>
        <View style={styles.casterCol}>
          <Animated.Text style={[styles.orb, myOrb]}>{spellMeta.moves[myMove].icon}</Animated.Text>
          <Text style={styles.caster}>🧙</Text>
        </View>
        <Animated.View style={[styles.burst, burstStyle]}>
          <Text style={styles.burstIcon}>{winningIcon}</Text>
        </Animated.View>
        <View style={styles.casterCol}>
          <Animated.Text style={[styles.orb, oppOrb]}>{spellMeta.moves[oppMove].icon}</Animated.Text>
          <Text style={styles.caster}>🧙‍♀️</Text>
        </View>
      </View>
      <Animated.Text
        style={[
          styles.verdict,
          burstStyle,
          outcome === 'win' && { color: '#3FB950' },
          outcome === 'lose' && { color: '#F85149' },
        ]}
      >
        {outcome === 'win'
          ? `${spellMeta.moves[myMove].label} prevails!`
          : outcome === 'lose'
            ? `${spellMeta.moves[oppMove].label} prevails!`
            : 'The spells cancel out!'}
      </Animated.Text>
    </View>
  );
}

function MatchEndScene({ won, reason }: MatchEndSceneProps) {
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withSpring(1, { damping: 11 });
  }, [rise]);
  const style = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * 30 }, { scale: 0.7 + rise.value * 0.3 }],
  }));
  return (
    <Animated.View style={[styles.endRoot, style]}>
      <Text style={styles.endEmoji}>{won ? '🔮' : '🕯️'}</Text>
      <Text style={[styles.endTitle, { color: won ? spellMeta.theme.accent : spellMeta.theme.textDim }]}>
        {won ? 'ARCANE VICTORY' : 'SPELL BROKEN'}
      </Text>
      {reason !== 'score' && (
        <Text style={styles.endReason}>
          {reason === 'forfeit' ? 'your rival yielded' : 'your rival vanished'}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  moveButton: {
    alignItems: 'center',
    backgroundColor: spellMeta.theme.panel,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#3A2A63',
    paddingVertical: 17,
    paddingHorizontal: 8,
    flex: 1,
    marginHorizontal: 6,
  },
  moveButtonSelected: {
    borderColor: spellMeta.theme.accent,
    backgroundColor: '#33215E',
  },
  moveIcon: { fontSize: 42 },
  moveLabel: { color: spellMeta.theme.text, marginTop: 6, fontWeight: '700', fontStyle: 'italic' },
  revealRoot: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  duelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 30,
    height: 150,
  },
  casterCol: { alignItems: 'center' },
  caster: { fontSize: 58 },
  orb: { fontSize: 36, marginBottom: 4 },
  burst: { position: 'absolute', left: 0, right: 0, alignItems: 'center', bottom: 60 },
  burstIcon: { fontSize: 64 },
  verdict: {
    marginTop: 30,
    fontSize: 20,
    fontWeight: '800',
    fontStyle: 'italic',
    color: spellMeta.theme.text,
  },
  endRoot: { alignItems: 'center' },
  endEmoji: { fontSize: 72 },
  endTitle: { fontSize: 28, fontWeight: '900', letterSpacing: 2, marginTop: 8 },
  endReason: { color: spellMeta.theme.textDim, marginTop: 6 },
});

export const spellSkin: Skin = {
  ...spellMeta,
  MoveButton,
  RevealScene,
  MatchEndScene,
};
