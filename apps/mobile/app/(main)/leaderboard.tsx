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
import { CoinField } from '../../src/components/bling';
import { theme } from '../../src/theme';

const PODIUM_TINTS = [theme.accent, '#C0C8D8', '#CD7F5A'];

/** Olympic-style podium for the top three: 2nd · 1st (tall) · 3rd. */
function Podium({ rows, onOpen }: { rows: LeaderboardRow[]; onOpen: (id: number) => void }) {
  const slots = [rows[1], rows[0], rows[2]];
  const heights = [64, 92, 48];
  return (
    <View style={styles.podiumWrap}>
      <CoinField count={6} />
      {slots.map((row, i) => {
        if (!row) return <View key={i} style={styles.podiumCol} />;
        const place = row.rank - 1;
        const tint = PODIUM_TINTS[place];
        const first = place === 0;
        return (
          <PressableScale key={row.user.id} style={styles.podiumCol} onPress={() => onOpen(row.user.id)}>
            {first && (
              <Text style={[styles.crown, theme.textGlow('rgba(255,201,60,0.8)', 14)]}>👑</Text>
            )}
            <View style={[styles.podiumAvatar, { borderColor: tint }, theme.glow(tint, first ? 18 : 10)]}>
              <Avatar avatar={row.user.avatar} size={first ? 62 : 48} />
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>
              {row.user.username}
            </Text>
            <StatNumber
              value={Math.abs(row.coinsWon)}
              size={first ? 22 : 17}
              color={row.coinsWon < 0 ? theme.red : theme.accent}
              prefix={row.coinsWon >= 0 ? '+🪙 ' : '−🪙 '}
            />
            <View style={[styles.podiumBlock, { height: heights[i], borderColor: tint }]}>
              <DisplayText size={first ? 30 : 22} color={tint}>
                {row.rank}
              </DisplayText>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

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
        data={rows.slice(3)}
        keyExtractor={(row) => String(row.user.id)}
        ListHeaderComponent={
          rows.length > 0 ? (
            <Animated.View entering={FadeInDown.springify()}>
              <Podium rows={rows.slice(0, 3)} onOpen={(id) => router.push(`/user/${id}`)} />
            </Animated.View>
          ) : null
        }
        ListEmptyComponent={
          rows.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>👑</Text>
              <DisplayText size={26} color={theme.text}>
                The throne is empty
              </DisplayText>
              <Text style={styles.empty}>
                No winnings {window === 'weekly' ? 'this week' : 'this month'} yet. Be the first!
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={index < 8 ? FadeInDown.delay(index * 50).springify() : undefined}>
            <PressableScale onPress={() => router.push(`/user/${item.user.id}`)}>
              <Card style={styles.row}>
                <DisplayText size={18} color={theme.textDim} style={styles.rankNum}>
                  #{item.rank}
                </DisplayText>
                <Avatar avatar={item.user.avatar} size={40} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.user.username}</Text>
                  <Text style={styles.meta}>
                    {item.user.wins} W · {item.user.losses} L
                  </Text>
                </View>
                <StatNumber
                  value={Math.abs(item.coinsWon)}
                  size={20}
                  color={item.coinsWon < 0 ? theme.red : theme.accent}
                  prefix={item.coinsWon >= 0 ? '+🪙 ' : '−🪙 '}
                />
              </Card>
            </PressableScale>
          </Animated.View>
        )}
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
  rankNum: { width: 44 },
  name: { color: theme.text, fontWeight: '800' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 8 },
  emptyEmoji: { fontSize: 52 },

  podiumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 26,
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: theme.goldBorder,
  },
  podiumCol: { flex: 1, alignItems: 'center', maxWidth: 120 },
  crown: { fontSize: 26, marginBottom: -4 },
  podiumAvatar: {
    borderWidth: 2.5,
    borderRadius: 40,
    padding: 3,
    marginBottom: 6,
  },
  podiumName: { color: theme.text, fontWeight: '800', fontSize: 13, maxWidth: 110 },
  podiumBlock: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderTopLeftRadius: theme.radius.sm,
    borderTopRightRadius: theme.radius.sm,
  },
});
