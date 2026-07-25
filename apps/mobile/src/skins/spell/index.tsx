import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  FadeIn,
} from 'react-native-reanimated';
import type { Skin, MoveButtonProps, RevealSceneProps, MatchEndSceneProps } from '../types';
import { spellMeta } from './meta';
import { theme } from '../../theme';
import { PressableScale, DisplayText } from '../../components/ui';

function MoveButton({ move, disabled, selected, onPress }: MoveButtonProps) {
  const m = spellMeta.moves[move];
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
          theme.glow(spellMeta.theme.accent, 16),
          { shadowOpacity: 0 },
          selected && styles.moveButtonSelected,
          disabled && !selected && { opacity: 0.55 },
          animated,
        ]}
      >
        <Text style={styles.moveIcon}>{m.icon}</Text>
        <Text style={styles.moveLabel}>{m.label}</Text>
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Two wizards channel; glowing spell orbs orbit each caster, then both
 * spells fly to the center and collide — an expanding ring bursts outward
 * and the winning element spring-flares.
 */
function RevealScene({ myMove, oppMove, outcome, onDone }: RevealSceneProps) {
  const channel = useSharedValue(0);
  const cast = useSharedValue(0);
  const burst = useSharedValue(0);
  const ring = useSharedValue(0);
  const winnerPop = useSharedValue(0);
  const done = useSharedValue(0);

  useEffect(() => {
    channel.value = withRepeat(
      withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }),
      3,
      true,
      () => {
        cast.value = withTiming(1, { duration: 280, easing: Easing.in(Easing.quad) }, () => {
          burst.value = withSequence(
            withTiming(1, { duration: 110 }),
            withTiming(0.85, { duration: 600 })
          );
          ring.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
          winnerPop.value = withDelay(90, withSpring(1, { damping: 9, stiffness: 240 }));
        });
        // Total scene ≈ 0.42*3 channel + 0.28 cast + ~1.2s hold ≈ 2.75s.
        done.value = withDelay(
          1480,
          withTiming(1, { duration: 1 }, () => {
            runOnJS(onDone)();
          })
        );
      }
    );
  }, [channel, cast, burst, ring, winnerPop, done, onDone]);

  const myOrb = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 - channel.value * 12 },
      { translateX: cast.value * 96 },
      { scale: 1 + channel.value * 0.18 + cast.value * 0.25 },
    ],
    opacity: burst.value > 0 ? 0 : 1,
  }));
  const oppOrb = useAnimatedStyle(() => ({
    transform: [
      { translateY: -8 - channel.value * 12 },
      { translateX: -cast.value * 96 },
      { scale: 1 + channel.value * 0.18 + cast.value * 0.25 },
    ],
    opacity: burst.value > 0 ? 0 : 1,
  }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: (0.3 + burst.value * 0.9) * (1 + winnerPop.value * 0.35) }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : (1 - ring.value) * 0.9,
    transform: [{ scale: 0.3 + ring.value * 2.2 }],
  }));
  const verdictStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ translateY: (1 - winnerPop.value) * 12 }],
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
        <View pointerEvents="none" style={styles.burstZone}>
          <Animated.View style={[styles.burstRing, ringStyle]} />
          <Animated.View style={[styles.burst, burstStyle]}>
            <Text style={styles.burstIcon}>{winningIcon}</Text>
          </Animated.View>
        </View>
        <View style={styles.casterCol}>
          <Animated.Text style={[styles.orb, oppOrb]}>{spellMeta.moves[oppMove].icon}</Animated.Text>
          <Text style={styles.caster}>🧙‍♀️</Text>
        </View>
      </View>
      <Animated.Text
        style={[
          styles.verdict,
          verdictStyle,
          outcome === 'win' && { color: theme.green },
          outcome === 'lose' && { color: theme.danger },
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

/** Ambient emoji mote drifting upward; offsets derive from index math only. */
function Particle({ index, emoji }: { index: number; emoji: string }) {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withDelay(
      index * 240,
      withRepeat(
        withTiming(1, { duration: 2100 + (index % 3) * 260, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
  }, [float, index]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - float.value) * 0.85,
    transform: [
      { translateY: -float.value * 110 },
      { translateX: Math.sin(float.value * Math.PI * 2 + index * 1.7) * (8 + (index % 3) * 5) },
      { scale: 0.7 + (index % 3) * 0.2 },
    ],
  }));
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        styles.particle,
        { left: `${12 + ((index * 31) % 72)}%` as `${number}%`, fontSize: 18 + (index % 3) * 6 },
        style,
      ]}
    >
      {emoji}
    </Animated.Text>
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
  const particles = won ? ['✨', '🔮', '⭐', '💫', '✨'] : ['🌫️', '🕯️', '💨', '🌫️', '💨'];
  return (
    <View style={styles.endWrap}>
      {particles.map((emoji, i) => (
        <Particle key={i} index={i} emoji={emoji} />
      ))}
      <Animated.View style={[styles.endRoot, style]}>
        <Animated.Text entering={FadeIn.delay(140)} style={styles.endEmoji}>
          {won ? '🔮' : '🕯️'}
        </Animated.Text>
        <DisplayText
          size={36}
          color={won ? spellMeta.theme.accent : spellMeta.theme.textDim}
          style={[styles.endTitle, won ? theme.glow(spellMeta.theme.accent, 18) : null]}
        >
          {won ? 'ARCANE VICTORY' : 'SPELL BROKEN'}
        </DisplayText>
        {reason !== 'score' && (
          <Text style={styles.endReason}>
            {reason === 'forfeit' ? 'your rival yielded' : 'your rival vanished'}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  moveButtonWrap: { flex: 1, marginHorizontal: 6 },
  moveButton: {
    alignItems: 'center',
    backgroundColor: spellMeta.theme.panel,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#3A2A63',
    paddingVertical: 17,
    paddingHorizontal: 8,
  },
  moveButtonSelected: {
    borderColor: spellMeta.theme.accent,
    backgroundColor: '#33215E',
  },
  moveIcon: { fontSize: 50 },
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
  orb: {
    fontSize: 38,
    marginBottom: 4,
    textShadowColor: spellMeta.theme.accent,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  burstZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: spellMeta.theme.accent,
  },
  burst: { alignItems: 'center' },
  burstIcon: {
    fontSize: 64,
    textShadowColor: spellMeta.theme.accent,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  verdict: {
    marginTop: 30,
    fontSize: 20,
    fontWeight: '800',
    fontStyle: 'italic',
    color: spellMeta.theme.text,
  },
  endWrap: { alignItems: 'center', justifyContent: 'center' },
  endRoot: { alignItems: 'center' },
  endEmoji: { fontSize: 76 },
  endTitle: { marginTop: 8 },
  endReason: { color: spellMeta.theme.textDim, marginTop: 6, fontWeight: '600' },
  particle: { position: 'absolute', bottom: 0 },
});

export const spellSkin: Skin = {
  ...spellMeta,
  MoveButton,
  RevealScene,
  MatchEndScene,
};
