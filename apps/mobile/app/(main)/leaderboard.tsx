import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { LeaderboardRow, LeaderboardWindow } from '@rps/shared';
import { api } from '../../src/api/client';
import { Avatar } from '../../src/components/Avatar';
import { theme } from '../../src/theme';

const MEDALS = ['🥇', '🥈', '🥉'];

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
      <View style={styles.toggle}>
        {(['weekly', 'monthly'] as const).map((w) => (
          <Pressable
            key={w}
            onPress={() => setWindow(w)}
            style={[styles.toggleItem, window === w && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, window === w && { color: theme.accentText }]}>
              {w === 'weekly' ? 'This week' : 'This month'}
            </Text>
          </Pressable>
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(row) => String(row.user.id)}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No ranked matches {window === 'weekly' ? 'this week' : 'this month'} yet. Be the first!
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/user/${item.user.id}`)}>
            <Text style={styles.rank}>{MEDALS[item.rank - 1] ?? `#${item.rank}`}</Text>
            <Avatar avatar={item.user.avatar} size={40} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{item.user.username}</Text>
              <Text style={styles.meta}>⚡ {item.currentElo} Elo</Text>
            </View>
            <Text style={[styles.gained, item.ratingGained < 0 && { color: theme.red }]}>
              {item.ratingGained >= 0 ? '+' : ''}
              {item.ratingGained}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: theme.panel,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  toggleItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  toggleActive: { backgroundColor: theme.accent },
  toggleText: { color: theme.textDim, fontWeight: '800' },
  error: { color: theme.red, textAlign: 'center', marginVertical: 8 },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderRadius: 14,
    padding: 12,
    marginVertical: 4,
  },
  rank: { width: 44, fontSize: 18, fontWeight: '900', color: theme.text },
  name: { color: theme.text, fontWeight: '800' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  gained: { color: theme.green, fontWeight: '900', fontSize: 16 },
});
