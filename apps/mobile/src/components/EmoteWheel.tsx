import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { EMOTES, type EmoteId } from '@rps/shared';
import { theme } from '../theme';
import { PressableScale } from './ui';

const ITEM = 44;
/**
 * Two interleaved arcs (a rose): the outer ring's angles fall midway
 * between the inner ring's, so all 8 targets keep clear air.
 */
const RINGS = [
  // 3-in / 5-out keeps every 44px target ≥6px of clear air on both rings.
  { radius: 84, count: 3, offset: 0.5 },
  { radius: 148, count: 5, offset: 0 },
];
const SWEEP_START = Math.PI * 1.02; // just past straight-left
const SWEEP_END = Math.PI * 0.48; // just past straight-up

/**
 * Radial emote wheel: tap the corner face button to fan 8 emotes in two
 * arcs across the upper-left quadrant; tapping one sends it and collapses.
 */
export function EmoteWheel({
  onEmote,
  anchorBottom = 232,
}: {
  onEmote: (id: EmoteId) => void;
  anchorBottom?: number;
}) {
  const [open, setOpen] = useState(false);

  let index = 0;
  const items = RINGS.flatMap((ring) => {
    const ringEmotes = EMOTES.slice(index, index + ring.count);
    const startIdx = index;
    index += ring.count;
    return ringEmotes.map((emote, i) => ({
      emote,
      key: EMOTES[startIdx + i]!.id,
      staggerIndex: startIdx + i,
      radius: ring.radius,
      angle:
        SWEEP_START +
        ((SWEEP_END - SWEEP_START) * (i + ring.offset)) / ring.count +
        (SWEEP_END - SWEEP_START) / (ring.count * 2),
    }));
  });

  return (
    <>
      {open && (
        <Animated.View
          entering={FadeIn.duration(140)}
          style={styles.scrim}
          onTouchEnd={() => setOpen(false)}
          onPointerDown={() => setOpen(false)}
        />
      )}
      <View pointerEvents="box-none" style={[styles.root, { bottom: anchorBottom }]}>
      {items.map(({ emote, key, staggerIndex, radius, angle }) => (
        <WheelItem
          key={key}
          emoji={emote.emoji}
          label={emote.label}
          angle={angle}
          radius={radius}
          open={open}
          staggerIndex={staggerIndex}
          onPress={() => {
            onEmote(emote.id);
            setOpen(false);
          }}
        />
      ))}
      <PressableScale
        accessibilityLabel="Emote wheel"
        style={[styles.trigger, theme.glow(theme.accent, 12)]}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={styles.triggerText}>{open ? '✕' : '😏'}</Text>
      </PressableScale>
      </View>
    </>
  );
}

function WheelItem({
  emoji,
  label,
  angle,
  radius,
  open,
  staggerIndex,
  onPress,
}: {
  emoji: string;
  label: string;
  angle: number;
  radius: number;
  open: boolean;
  staggerIndex: number;
  onPress: () => void;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = open
      ? withDelay(staggerIndex * 20, withSpring(1, { damping: 14, stiffness: 160 }))
      : withTiming(0, { duration: 140 });
  }, [open, staggerIndex, progress]);

  const style = useAnimatedStyle(() => {
    const r = progress.value * radius;
    return {
      opacity: progress.value,
      transform: [
        { translateX: Math.cos(angle) * r },
        { translateY: -Math.sin(angle) * r },
        { scale: 0.5 + progress.value * 0.5 },
      ],
    };
  });
  return (
    <Animated.View
      style={[styles.item, style]}
      pointerEvents={open ? 'auto' : 'none'}
    >
      <PressableScale
        accessibilityLabel={`Emote: ${label}`}
        onPress={onPress}
        style={styles.itemButton}
      >
        <Text style={styles.itemEmoji}>{emoji}</Text>
      </PressableScale>
    </Animated.View>
  );
}

/** Speech bubble shown over the opponent when they taunt you. */
export function EmoteBubble({ emoteId, seq }: { emoteId: EmoteId; seq: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withSpring(1, { damping: 10 });
    const timer = setTimeout(() => {
      progress.value = withTiming(0, { duration: 250 });
    }, 2500);
    return () => clearTimeout(timer);
  }, [seq, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.4 + progress.value * 0.6 }],
  }));
  const emote = EMOTES.find((e) => e.id === emoteId);
  if (!emote) return null;
  return (
    <Animated.View style={[styles.bubble, style]}>
      <Text style={styles.bubbleEmoji}>{emote.emoji}</Text>
      <Text style={styles.bubbleLabel}>{emote.label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', right: 20, alignItems: 'center', justifyContent: 'center' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 14, 26, 0.72)',
  },
  trigger: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: { fontSize: 26 },
  item: { position: 'absolute' },
  itemButton: {
    width: ITEM,
    height: ITEM,
    borderRadius: ITEM / 2,
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 24 },
  bubble: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  bubbleEmoji: { fontSize: 22 },
  bubbleLabel: { fontWeight: '800', color: '#111' },
});
