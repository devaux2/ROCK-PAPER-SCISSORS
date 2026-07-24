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
import { classicMeta } from './meta';

const SHAKE_COUNT = 3;
const SHAKE_MS = 380;

function MoveButton({ move, disabled, selected, onPress }: MoveButtonProps) {
  const m = classicMeta.moves[move];
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
 * Two fists pump in sync ("rock... paper... scissors...") then cross-fade
 * into the chosen throws; the winning hand springs up, the loser sinks.
 */
function RevealScene({ myMove, oppMove, outcome, onDone }: RevealSceneProps) {
  const shake = useSharedValue(0);
  const revealed = useSharedValue(0);
  const done = useSharedValue(0);

  useEffect(() => {
    shake.value = withRepeat(
      withSequence(
        withTiming(-22, { duration: SHAKE_MS / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: SHAKE_MS / 2, easing: Easing.in(Easing.quad) })
      ),
      SHAKE_COUNT,
      false,
      () => {
        revealed.value = withTiming(1, { duration: 250 });
        done.value = withDelay(
          1400,
          withTiming(1, { duration: 1 }, () => {
            runOnJS(onDone)();
          })
        );
      }
    );
  }, [shake, revealed, done, onDone]);

  const oppFist = useAnimatedStyle(() => ({
    transform: [{ translateY: shake.value }],
    opacity: 1 - revealed.value,
  }));
  const myFist = useAnimatedStyle(() => ({
    transform: [{ translateY: -shake.value }],
    opacity: 1 - revealed.value,
  }));
  const oppThrow = useAnimatedStyle(() => ({
    opacity: revealed.value,
    transform: [
      { scale: outcome === 'lose' ? 1 + revealed.value * 0.25 : 1 },
      { translateY: outcome === 'win' ? revealed.value * 14 : 0 },
    ],
  }));
  const myThrow = useAnimatedStyle(() => ({
    opacity: revealed.value,
    transform: [
      { scale: outcome === 'win' ? withSpring(1.25, { damping: 9 }) : 1 },
      { translateY: outcome === 'lose' ? revealed.value * 14 : 0 },
    ],
  }));
  const banner = useAnimatedStyle(() => ({
    opacity: revealed.value,
    transform: [{ scale: 0.7 + revealed.value * 0.3 }],
  }));

  return (
    <View style={styles.revealRoot}>
      <View style={styles.handSlot}>
        <Animated.Text style={[styles.hand, styles.oppHand, oppFist]}>✊</Animated.Text>
        <Animated.Text style={[styles.hand, styles.oppHand, styles.overlayHand, oppThrow]}>
          {classicMeta.moves[oppMove].icon}
        </Animated.Text>
      </View>
      <Animated.View style={[styles.resultBanner, banner]}>
        <Text
          style={[
            styles.resultText,
            outcome === 'win' && { color: '#3FB950' },
            outcome === 'lose' && { color: '#F85149' },
          ]}
        >
          {outcome === 'win' ? 'You take it!' : outcome === 'lose' ? 'They take it!' : 'Draw — again!'}
        </Text>
      </Animated.View>
      <View style={styles.handSlot}>
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
      <Text style={styles.endEmoji}>{won ? '🏆' : '💔'}</Text>
      <Text style={[styles.endTitle, { color: won ? '#3FB950' : '#F85149' }]}>
        {won ? 'VICTORY' : 'DEFEAT'}
      </Text>
      {reason !== 'score' && (
        <Text style={styles.endReason}>
          {reason === 'forfeit' ? 'by forfeit' : 'opponent disconnected'}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  moveButton: {
    alignItems: 'center',
    backgroundColor: classicMeta.theme.panel,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 18,
    paddingHorizontal: 10,
    flex: 1,
    marginHorizontal: 6,
  },
  moveButtonSelected: {
    borderColor: classicMeta.theme.accent,
    backgroundColor: '#2C3B57',
  },
  moveIcon: { fontSize: 44 },
  moveLabel: { color: classicMeta.theme.text, marginTop: 6, fontWeight: '700' },
  revealRoot: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 30 },
  handSlot: { height: 110, justifyContent: 'center', alignItems: 'center' },
  hand: { fontSize: 90 },
  oppHand: { transform: [{ rotate: '180deg' }] },
  overlayHand: { position: 'absolute' },
  resultBanner: { alignItems: 'center' },
  resultText: { fontSize: 26, fontWeight: '900', color: classicMeta.theme.text },
  endRoot: { alignItems: 'center' },
  endEmoji: { fontSize: 72 },
  endTitle: { fontSize: 40, fontWeight: '900', letterSpacing: 4, marginTop: 8 },
  endReason: { color: classicMeta.theme.textDim, marginTop: 6 },
});

export const classicSkin: Skin = {
  ...classicMeta,
  MoveButton,
  RevealScene,
  MatchEndScene,
};
