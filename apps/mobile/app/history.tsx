import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { MatchHistoryRow } from '@rps/shared';
import { api } from '../src/api/client';
import { Avatar } from '../src/components/Avatar';
import { Card, DisplayText, ErrorText } from '../src/components/ui';
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
          rows ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>🥊</Text>
              <DisplayText size={30} color={theme.text}>No bouts yet</DisplayText>
              <Text style={styles.empty}>No matches yet. Go throw something.</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const outcome = outcomeLabel(item);
          const row = (
            <Card style={styles.row}>
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
                <View style={[styles.outcomeChip, { borderColor: outcome.color }]}>
                  <DisplayText size={15} color={outcome.color}>
                    {outcome.text}
                  </DisplayText>
                </View>
                {item.mode === 'ranked' && !item.aborted && (
                  <Text
                    style={[
                      styles.delta,
                      { color: item.coinsDelta >= 0 ? theme.green : theme.red },
                    ]}
                  >
                    {item.coinsDelta >= 0 ? '+' : ''}
                    {item.coinsDelta} 🪙
                  </Text>
                )}
              </View>
            </Card>
          );
          return index < 8 ? (
            <Animated.View entering={FadeInDown.delay(index * 60).springify()}>{row}</Animated.View>
          ) : (
            row
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  emptyWrap: { alignItems: 'center', marginTop: 70, gap: 8 },
  emptyEmoji: { fontSize: 54 },
  empty: { color: theme.textDim, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.space(3),
    marginVertical: 4,
  },
  name: { color: theme.text, fontWeight: '800' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  outcomeChip: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  delta: { fontSize: 11, marginTop: 4, fontWeight: '700' },
});
