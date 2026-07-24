import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { EMOTES, type EmoteId } from '@rps/shared';
import { theme } from '../theme';

const WHEEL_RADIUS = 92;
const ITEM = 48;

/**
 * Radial emote wheel: tap the corner face button to fan 8 emotes across the
 * upper-left quadrant; tapping one sends it and collapses the wheel.
 */
export function EmoteWheel({ onEmote }: { onEmote: (id: EmoteId) => void }) {
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = open
      ? withSpring(1, { damping: 14, stiffness: 160 })
      : withTiming(0, { duration: 140 });
  }, [open, progress]);

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {EMOTES.map((emote, i) => (
        <WheelItem
          key={emote.id}
          emoji={emote.emoji}
          // Sweep from straight-left (π) to straight-up (π/2).
          angle={Math.PI - (i / (EMOTES.length - 1)) * (Math.PI / 2)}
          progress={progress}
          onPress={() => {
            onEmote(emote.id);
            setOpen(false);
          }}
        />
      ))}
      <Pressable style={styles.trigger} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.triggerText}>{open ? '✕' : '😏'}</Text>
      </Pressable>
    </View>
  );
}

function WheelItem({
  emoji,
  angle,
  progress,
  onPress,
}: {
  emoji: string;
  angle: number;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const r = progress.value * WHEEL_RADIUS;
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
    <Animated.View style={[styles.item, style]}>
      <Pressable onPress={onPress} style={styles.itemButton}>
        <Text style={styles.itemEmoji}>{emoji}</Text>
      </Pressable>
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
    borderWidth: 1,
    borderColor: theme.panelBorder,
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
    borderWidth: 1,
    borderColor: theme.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 24 },
  bubble: {
    position: 'absolute',
    top: -8,
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
