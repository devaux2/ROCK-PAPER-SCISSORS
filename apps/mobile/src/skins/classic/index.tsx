import React, { useEffect } from 'react';
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
} from 'react-native-reanimated';
import type { Skin, MoveButtonProps, RevealSceneProps, MatchEndSceneProps } from '../types';
import { classicMeta } from './meta';
import { theme } from '../../theme';
import { PressableScale, DisplayText } from '../../components/ui';

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
 * Two fists pump with a rising anticipation shake ("rock... paper...
 * SCISSORS!"), then cross-fade into the throws; the winner spring-pops with
 * a white flash ring, the loser sinks and dims.
 */
function RevealScene({ myMove, oppMove, outcome, onDone }: RevealSceneProps) {
  const shake = useSharedValue(0);
  const revealed = useSharedValue(0);
  const winnerPop = useSharedValue(0);
  const ring = useSharedValue(0);
  const bannerIn = useSharedValue(0);
  const done = useSharedValue(0);

  useEffect(() => {
    // Anticipation ramp: each pump digs deeper than the last.
    shake.value = withSequence(
      withTiming(-14, { duration: 170, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }),
      withTiming(-20, { duration: 180, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }),
      withTiming(-30, { duration: 190, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }, () => {
        revealed.value = withTiming(1, { duration: 220 });
        winnerPop.value = withDelay(120, withSpring(1, { damping: 9, stiffness: 240 }));
        ring.value = withDelay(140, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
        bannerIn.value = withDelay(80, withSpring(1, { damping: 13, stiffness: 240 }));
        done.value = withDelay(
          1400,
          withTiming(1, { duration: 1 }, () => {
            runOnJS(onDone)();
          })
        );
      })
    );
  }, [shake, revealed, winnerPop, ring, bannerIn, done, onDone]);

  const oppFist = useAnimatedStyle(() => ({
    transform: [{ translateY: shake.value }],
    opacity: 1 - revealed.value,
  }));
  const myFist = useAnimatedStyle(() => ({
    transform: [{ translateY: -shake.value }],
    opacity: 1 - revealed.value,
  }));
  const oppThrow = useAnimatedStyle(() => ({
    // Loser desaturates via opacity drop; winner spring-pops.
    opacity: revealed.value * (outcome === 'win' ? 0.45 : 1),
    transform: [
      { scale: outcome === 'lose' ? 1 + winnerPop.value * 0.3 : 1 },
      { translateY: outcome === 'win' ? revealed.value * 16 : 0 },
    ],
  }));
  const myThrow = useAnimatedStyle(() => ({
    opacity: revealed.value * (outcome === 'lose' ? 0.45 : 1),
    transform: [
      { scale: outcome === 'win' ? 1 + winnerPop.value * 0.3 : 1 },
      { translateY: outcome === 'lose' ? revealed.value * 16 : 0 },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : (1 - ring.value) * 0.9,
    transform: [{ scale: 0.6 + ring.value * 1.1 }],
  }));
  const banner = useAnimatedStyle(() => ({
    opacity: revealed.value,
    transform: [
      { translateY: (1 - bannerIn.value) * 28 },
      { scale: 0.8 + bannerIn.value * 0.2 },
    ],
  }));

  const flashRing = (
    <Animated.View pointerEvents="none" style={[styles.flashRing, ringStyle]} />
  );

  return (
    <View style={styles.revealRoot}>
      <View style={styles.handSlot}>
        {outcome === 'lose' && flashRing}
        <Animated.Text style={[styles.hand, styles.oppHand, oppFist]}>✊</Animated.Text>
        <Animated.Text style={[styles.hand, styles.oppHand, styles.overlayHand, oppThrow]}>
          {classicMeta.moves[oppMove].icon}
        </Animated.Text>
      </View>
      <Animated.View style={[styles.resultBanner, banner]}>
        <DisplayText
          size={30}
          color={
            outcome === 'win' ? theme.green : outcome === 'lose' ? theme.danger : classicMeta.theme.text
          }
        >
          {outcome === 'win' ? 'You take it!' : outcome === 'lose' ? 'They take it!' : 'Draw — again!'}
        </DisplayText>
      </Animated.View>
      <View style={styles.handSlot}>
        {outcome === 'win' && flashRing}
        <Animated.Text style={[styles.hand, myFist]}>✊</Animated.Text>
        <Animated.Text style={[styles.hand, styles.overlayHand, myThrow]}>
          {classicMeta.moves[myMove].icon}
        </Animated.Text>
      </View>
    </View>
  );
}

function MatchEndScene({ won, reason }: MatchEndSceneProps) {
  const scale = useSharedValue(0.4);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8 });
  }, [scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.endRoot, style]}>
      <Animated.Text entering={FadeIn.delay(120)} style={styles.endEmoji}>
        {won ? '🏆' : '💔'}
      </Animated.Text>
      <DisplayText
        size={46}
        color={won ? theme.green : theme.danger}
        style={[styles.endTitle, theme.glow(won ? theme.green : theme.danger, 20)]}
      >
        {won ? 'VICTORY' : 'DEFEAT'}
      </DisplayText>
      {reason !== 'score' && (
        <Text style={styles.endReason}>
          {reason === 'forfeit' ? 'by forfeit' : 'opponent disconnected'}
        </Text>
      )}
    </Animated.View>
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
  revealRoot: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 30 },
  handSlot: { height: 110, justifyContent: 'center', alignItems: 'center' },
  hand: { fontSize: 96 },
  oppHand: { transform: [{ rotate: '180deg' }] },
  overlayHand: { position: 'absolute' },
  flashRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFFFFF',
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
