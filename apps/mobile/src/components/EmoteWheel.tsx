import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
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
/** Two arcs so 8 emotes never overlap (44px targets stay tappable). */
const RINGS = [
  { radius: 76, count: 3 },
  { radius: 138, count: 5 },
];
const SWEEP_START = Math.PI * 0.97; // just past straight-left
const SWEEP_END = Math.PI * 0.53; // just short of straight-up

/**
 * Radial emote wheel: tap the corner face button to fan 8 emotes in two
 * arcs across the upper-left quadrant; tapping one sends it and collapses.
 */
export function EmoteWheel({ onEmote }: { onEmote: (id: EmoteId) => void }) {
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
        ring.count === 1
          ? (SWEEP_START + SWEEP_END) / 2
          : SWEEP_START + ((SWEEP_END - SWEEP_START) * i) / (ring.count - 1),
    }));
  });

  return (
    <View pointerEvents="box-none" style={styles.root}>
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
  root: { position: 'absolute', right: 20, bottom: 24, alignItems: 'center', justifyContent: 'center' },
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
