import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { MatchHistoryRow } from '@rps/shared';
import { api } from '../src/api/client';
import { Avatar } from '../src/components/Avatar';
import { ErrorText } from '../src/components/ui';
import { theme } from '../src/theme';

function outcomeLabel(row: MatchHistoryRow): { text: string; color: string } {
  if (row.aborted) return { text: 'VOID', color: theme.textDim };
  if (row.won) return { text: 'WIN', color: theme.green };
  return { text: 'LOSS', color: theme.red };
}

function modeLabel(row: MatchHistoryRow): string {
  if (row.mode === 'bot') return '🤖 Practice';
  if (row.mode === 'casual') return '🎲 Casual';
  return `⚔️ Ranked · 🪙 ${row.wager}`;
}

export default function History() {
  const [rows, setRows] = useState<MatchHistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .matchHistory()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load history'));
  }, []);

  return (
    <View style={styles.root}>
      <ErrorText error={error} />
      <FlatList
        data={rows ?? []}
        keyExtractor={(row) => row.matchId}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          rows ? <Text style={styles.empty}>No matches yet. Go throw something.</Text> : null
        }
        renderItem={({ item }) => {
          const outcome = outcomeLabel(item);
          return (
            <View style={styles.row}>
              {item.opponent ? (
                <Avatar avatar={item.opponent.avatar} size={40} />
              ) : (
                <Text style={{ fontSize: 30 }}>🤖</Text>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.name}>{item.opponent?.username ?? 'RoboThrow'}</Text>
                <Text style={styles.meta}>
                  {modeLabel(item)} · {item.myScore}–{item.oppScore}
                  {item.endReason === 'forfeit' ? ' · forfeit' : ''}
                  {item.endReason === 'disconnect' ? ' · disconnect' : ''}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.outcome, { color: outcome.color }]}>{outcome.text}</Text>
                {item.mode === 'ranked' && !item.aborted && (
                  <Text style={[styles.delta, { color: item.coinsDelta >= 0 ? theme.green : theme.red }]}>
                    {item.coinsDelta >= 0 ? '+' : ''}
                    {item.coinsDelta} 🪙 · {item.eloDelta >= 0 ? '+' : ''}
                    {item.eloDelta} elo
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 60 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderRadius: 14,
    padding: 12,
    marginVertical: 4,
  },
  name: { color: theme.text, fontWeight: '800' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  outcome: { fontWeight: '900', fontSize: 15 },
  delta: { fontSize: 11, marginTop: 2, fontWeight: '700' },
});
