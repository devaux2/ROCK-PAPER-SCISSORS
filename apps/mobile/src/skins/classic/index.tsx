import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import type { Skin, MoveButtonProps, RevealSceneProps, MatchEndSceneProps } from '../types';
import { classicMeta } from './meta';
import { theme } from '../../theme';
import { PressableScale, DisplayText } from '../../components/ui';
import { playSound } from '../../sound';

function MoveButton({ move, disabled, selected, onPress }: MoveButtonProps) {
  const m = classicMeta.moves[move];
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = selected
      ? withSpring(1, theme.springs.pop)
      : withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
  }, [selected, pop]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.07 }],
    shadowOpacity: pop.value * 0.6,
  }));
  return (
    <PressableScale onPress={onPress} disabled={disabled} style={styles.moveButtonWrap}>
      <Animated.View
        style={[
          styles.moveButton,
          theme.glow(classicMeta.theme.accent, 16),
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
 * The IRL reveal, staged like a real game of rock-paper-scissors:
 *   1. both fists pump three times in sync (tick, tick, tick)
 *   2. both throws snap out SIMULTANEOUSLY
 *   3. a held beat — hands frozen, everyone reads the table
 *   4. the winning hand lunges and SMASHES the loser: screen shake,
 *      white flash, the loser tumbles away crushed
 *   5. the verdict banner slams in
 * Draws bump knuckles and bounce apart instead.
 * Total ≈2.75s — inside the server's 3s reveal window.
 */
function RevealScene({ myMove, oppMove, outcome, onDone }: RevealSceneProps) {
  const shake = useSharedValue(0); // fist pump offset
  const revealed = useSharedValue(0); // 0 = fists, 1 = throws out
  const pop = useSharedValue(0); // snap-pop scale on reveal
  const strike = useSharedValue(0); // winner's lunge toward the loser
  const crushed = useSharedValue(0); // loser's knock-away reaction
  const bump = useSharedValue(0); // draw: knuckle bump and bounce
  const flash = useSharedValue(0); // white hit flash
  const jolt = useSharedValue(0); // screen shake
  const bannerIn = useSharedValue(0);

  useEffect(() => {
    const pump = (depth: number) =>
      withSequence(
        withTiming(-depth, { duration: 170, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) })
      );
    // 0–1020ms: three pumps, rising.
    shake.value = withSequence(pump(16), pump(24), pump(34));
    // 1020ms: simultaneous snap reveal…
    revealed.value = withDelay(1020, withTiming(1, { duration: 130 }));
    pop.value = withDelay(1020, withSpring(1, { damping: 12, stiffness: 380 }));
    // …then 1150–1850ms: the held IRL beat. Nothing moves.
    if (outcome === 'draw') {
      bump.value = withDelay(
        1850,
        withSequence(
          withTiming(1, { duration: 160, easing: Easing.in(Easing.cubic) }),
          withSpring(0, { damping: 9, stiffness: 200 })
        )
      );
    } else {
      // 1850ms: the smash.
      strike.value = withDelay(
        1850,
        withSequence(
          withTiming(1, { duration: 170, easing: Easing.in(Easing.cubic) }),
          withSpring(0.55, { damping: 14, stiffness: 240 })
        )
      );
      crushed.value = withDelay(2010, withSpring(1, { damping: 11, stiffness: 300 }));
      flash.value = withDelay(
        2010,
        withSequence(withTiming(0.6, { duration: 70 }), withTiming(0, { duration: 260 }))
      );
      jolt.value = withDelay(
        2010,
        withSequence(
          withTiming(1, { duration: 50 }),
          withTiming(-0.7, { duration: 50 }),
          withTiming(0.4, { duration: 50 }),
          withTiming(0, { duration: 60 })
        )
      );
    }
    bannerIn.value = withDelay(
      outcome === 'draw' ? 2150 : 2280,
      withSpring(1, { damping: 13, stiffness: 260 })
    );

    // Sounds ride plain JS timers, in lockstep with the timeline above.
    const timers = [
      setTimeout(() => playSound('tick'), 60),
      setTimeout(() => playSound('tick'), 400),
      setTimeout(() => playSound('tick'), 740),
      setTimeout(() => playSound('reveal'), 1020),
      setTimeout(() => playSound(outcome === 'draw' ? 'tick' : 'smash'), outcome === 'draw' ? 1900 : 2010),
      setTimeout(onDone, 2750),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iWin = outcome === 'win';
  const iLose = outcome === 'lose';

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: jolt.value * 12 }],
  }));
  const oppFist = useAnimatedStyle(() => ({
    transform: [{ translateY: shake.value }],
    opacity: 1 - revealed.value,
  }));
  const myFist = useAnimatedStyle(() => ({
    transform: [{ translateY: -shake.value }],
    opacity: 1 - revealed.value,
  }));
  // Opp hand sits on top: toward center = +Y, knocked away = −Y.
  const oppThrow = useAnimatedStyle(() => {
    const winner = iLose;
    const scale = (0.72 + pop.value * 0.28) * (winner ? 1 + strike.value * 0.35 : 1 - crushed.value * 0.18);
    const toCenter = winner ? strike.value * 95 : bump.value * 46;
    const knock = winner ? 0 : crushed.value;
    return {
      opacity: revealed.value * (1 - knock * 0.62),
      transform: [
        { translateY: toCenter - knock * 78 },
        { rotate: `${180 + knock * -38}deg` },
        { scale },
      ],
    };
  });
  const myThrow = useAnimatedStyle(() => {
    const winner = iWin;
    const scale = (0.72 + pop.value * 0.28) * (winner ? 1 + strike.value * 0.35 : 1 - crushed.value * 0.18);
    const toCenter = winner ? strike.value * 95 : bump.value * 46;
    const knock = winner ? 0 : crushed.value;
    return {
      opacity: revealed.value * (1 - knock * 0.62),
      transform: [
        { translateY: -toCenter + knock * 78 },
        { rotate: `${knock * 38}deg` },
        { scale },
      ],
    };
  });
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const banner = useAnimatedStyle(() => ({
    opacity: bannerIn.value,
    transform: [
      { translateY: (1 - bannerIn.value) * 26 },
      { scale: 0.7 + bannerIn.value * 0.3 },
    ],
  }));

  return (
    <Animated.View style={[styles.revealRoot, rootStyle]}>
      <View style={styles.handSlot}>
        <Animated.Text style={[styles.hand, styles.oppHand, oppFist]}>✊</Animated.Text>
        <Animated.Text style={[styles.hand, styles.overlayHand, oppThrow]}>
          {classicMeta.moves[oppMove].icon}
        </Animated.Text>
      </View>
      <Animated.View style={[styles.resultBanner, banner]}>
        <DisplayText
          size={34}
          color={
            outcome === 'win' ? theme.green : outcome === 'lose' ? theme.danger : classicMeta.theme.text
          }
          style={theme.textGlow(
            outcome === 'win' ? theme.green : outcome === 'lose' ? theme.danger : theme.accent,
            14
          )}
        >
          {outcome === 'win' ? 'You take it!' : outcome === 'lose' ? 'They take it!' : 'Draw — again!'}
        </DisplayText>
      </Animated.View>
      <View style={styles.handSlot}>
        <Animated.Text style={[styles.hand, myFist]}>✊</Animated.Text>
        <Animated.Text style={[styles.hand, styles.overlayHand, myThrow]}>
          {classicMeta.moves[myMove].icon}
        </Animated.Text>
      </View>
      <Animated.View pointerEvents="none" style={[styles.hitFlash, flashStyle]} />
    </Animated.View>
  );
}

/**
 * The verdict lands like a stamp: VICTORY slams down from 2.4× with a
 * flash and a jolt; DEFEAT drops in heavy and tilted, like it hurts.
 */
function MatchEndScene({ won, reason }: MatchEndSceneProps) {
  const slam = useSharedValue(0);
  const flash = useSharedValue(0);
  const jolt = useSharedValue(0);
  useEffect(() => {
    slam.value = withSpring(1, { damping: won ? 11 : 13, stiffness: won ? 320 : 190 });
    if (won) {
      flash.value = withDelay(
        90,
        withSequence(withTiming(0.5, { duration: 60 }), withTiming(0, { duration: 300 }))
      );
      jolt.value = withDelay(
        90,
        withSequence(
          withTiming(1, { duration: 45 }),
          withTiming(-0.6, { duration: 45 }),
          withTiming(0, { duration: 60 })
        )
      );
    }
  }, [slam, flash, jolt, won]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: won ? 2.4 - slam.value * 1.4 : 0.6 + slam.value * 0.4 },
      { translateY: won ? 0 : (1 - slam.value) * -60 },
      { rotate: won ? '0deg' : `${(1 - slam.value) * -10 - 4}deg` },
      { translateX: jolt.value * 10 },
    ],
    opacity: 0.2 + slam.value * 0.8,
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  return (
    <View style={styles.endRoot}>
      <Animated.View style={[{ alignItems: 'center' }, style]}>
        <Animated.Text entering={FadeIn.delay(120)} style={styles.endEmoji}>
          {won ? '🏆' : '💔'}
        </Animated.Text>
        <DisplayText
          size={52}
          color={won ? theme.green : theme.danger}
          style={[styles.endTitle, theme.textGlow(won ? theme.green : theme.danger, 22)]}
        >
          {won ? 'VICTORY' : 'DEFEAT'}
        </DisplayText>
        {reason !== 'score' && (
          <Text style={styles.endReason}>
            {reason === 'forfeit' ? 'by forfeit' : 'opponent disconnected'}
          </Text>
        )}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.hitFlash, flashStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  moveButtonWrap: { flex: 1, marginHorizontal: 6 },
  moveButton: {
    alignItems: 'center',
    backgroundColor: classicMeta.theme.panel,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  moveButtonSelected: {
    borderColor: classicMeta.theme.accent,
    backgroundColor: '#2C3B57',
  },
  moveIcon: { fontSize: 52 },
  moveLabel: { color: classicMeta.theme.text, marginTop: 6, fontWeight: '700' },
  revealRoot: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 30,
  },
  handSlot: { height: 110, justifyContent: 'center', alignItems: 'center' },
  hand: { fontSize: 96 },
  oppHand: { transform: [{ rotate: '180deg' }] },
  overlayHand: { position: 'absolute' },
  hitFlash: {
    position: 'absolute',
    top: -200,
    bottom: -200,
    left: -60,
    right: -60,
    backgroundColor: '#FFFFFF',
  },
  resultBanner: { alignItems: 'center' },
  endRoot: { alignItems: 'center' },
  endEmoji: { fontSize: 76 },
  endTitle: { marginTop: 8 },
  endReason: { color: classicMeta.theme.textDim, marginTop: 6, fontWeight: '600' },
});

export const classicSkin: Skin = {
  ...classicMeta,
  MoveButton,
  RevealScene,
  MatchEndScene,
};
