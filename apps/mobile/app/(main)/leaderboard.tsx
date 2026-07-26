import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { LeaderboardRow, LeaderboardWindow } from '@rps/shared';
import { api } from '../../src/api/client';
import { Avatar } from '../../src/components/Avatar';
import { Card, DisplayText, PressableScale, StatNumber } from '../../src/components/ui';
import { theme } from '../../src/theme';

const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_TINTS = [theme.accent, '#C0C8D8', '#CD7F5A'];

export default function Leaderboard() {
  const router = useRouter();
  const [window, setWindow] = useState<LeaderboardWindow>('weekly');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (w: LeaderboardWindow) => {
      setError(null);
      try {
        setRows(await api.leaderboard(w));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load leaderboard');
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void load(window);
    }, [load, window])
  );

  return (
    <View style={styles.root}>
      <SegmentedToggle window={window} onChange={setWindow} />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(row) => String(row.user.id)}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No winnings {window === 'weekly' ? 'this week' : 'this month'} yet. Be the first!
          </Text>
        }
        renderItem={({ item, index }) => {
          const podium = item.rank <= 3 ? item.rank - 1 : -1;
          const tint = podium >= 0 ? PODIUM_TINTS[podium] : undefined;
          return (
            <Animated.View entering={index < 8 ? FadeInDown.delay(index * 60).springify() : undefined}>
              <PressableScale onPress={() => router.push(`/user/${item.user.id}`)}>
                <Card
                  glow={tint}
                  style={[
                    styles.row,
                    podium >= 0 && styles.rowPodium,
                    tint ? { borderColor: tint } : null,
                  ]}
                >
                  {podium >= 0 ? (
                    <DisplayText size={28} style={styles.rankMedal}>
                      {MEDALS[podium]}
                    </DisplayText>
                  ) : (
                    <DisplayText size={18} color={theme.textDim} style={styles.rankNum}>
                      #{item.rank}
                    </DisplayText>
                  )}
                  <Avatar avatar={item.user.avatar} size={podium >= 0 ? 48 : 40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.name, podium >= 0 && styles.namePodium]}>
                      {item.user.username}
                    </Text>
                    <Text style={styles.meta}>
                      {item.user.wins} W · {item.user.losses} L
                    </Text>
                  </View>
                  <StatNumber
                    value={Math.abs(item.coinsWon)}
                    size={podium >= 0 ? 26 : 20}
                    color={item.coinsWon < 0 ? theme.red : theme.accent}
                    prefix={item.coinsWon >= 0 ? '+🪙 ' : '−🪙 '}
                  />
                </Card>
              </PressableScale>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

/** Weekly/monthly segmented control with a spring-sliding accent thumb. */
function SegmentedToggle({
  window,
  onChange,
}: {
  window: LeaderboardWindow;
  onChange: (w: LeaderboardWindow) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useSharedValue(window === 'monthly' ? 1 : 0);
  const thumbWidth = Math.max(0, (trackWidth - PAD * 2) / 2);
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * thumbWidth }],
  }));

  function select(w: LeaderboardWindow) {
    offset.value = withSpring(w === 'monthly' ? 1 : 0, theme.springs.press);
    onChange(w);
  }

  return (
    <View
      style={styles.toggle}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && (
        <Animated.View
          style={[
            styles.thumb,
            { width: thumbWidth },
            theme.glow(theme.accent, 10),
            thumbStyle,
          ]}
        />
      )}
      {(['weekly', 'monthly'] as const).map((w) => (
        <Pressable key={w} onPress={() => select(w)} style={styles.toggleItem}>
          <Text style={[styles.toggleText, window === w && { color: theme.accentText }]}>
            {w === 'weekly' ? 'This week' : 'This month'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const PAD = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: 12,
    padding: PAD,
    marginBottom: 12,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 9,
    backgroundColor: theme.accent,
  },
  toggleItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  toggleText: { color: theme.textDim, fontWeight: '800' },
  error: { color: theme.red, textAlign: 'center', marginVertical: 8 },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    borderRadius: theme.radius.md,
  },
  rowPodium: { padding: 16, borderRadius: theme.radius.lg },
  rankMedal: { width: 48, textAlign: 'left' },
  rankNum: { width: 44 },
  name: { color: theme.text, fontWeight: '800' },
  namePodium: { fontSize: 17 },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
});
