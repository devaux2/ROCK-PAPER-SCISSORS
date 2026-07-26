import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { TransactionRow, TransactionType } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { api } from '../../src/api/client';
import { DisplayText, StatNumber } from '../../src/components/ui';
import { CoinField, LightPool } from '../../src/components/bling';
import { theme } from '../../src/theme';

const TX_META: Record<TransactionType, { icon: string; label: string }> = {
  signup_bonus: { icon: '🎁', label: 'Welcome bonus' },
  wager_escrow: { icon: '🤜', label: 'Stake placed' },
  wager_refund: { icon: '↩️', label: 'Stake returned' },
  payout: { icon: '💰', label: 'Pot collected' },
  daily_topup: { icon: '☀️', label: 'Daily bonus' },
};

function timeLabel(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Wallet() {
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [rows, setRows] = useState<TransactionRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      void refreshMe();
      api.history().then(setRows).catch(() => {});
    }, [refreshMe])
  );

  return (
    <View style={styles.root}>
      <Animated.View entering={FadeInDown.springify()} style={styles.hero}>
        <LightPool size={260} style={{ top: -60, alignSelf: 'center' }} />
        <CoinField count={6} />
        <Text style={styles.heroLabel}>YOUR BANKROLL</Text>
        <StatNumber
          value={user?.coins ?? 0}
          size={64}
          color={theme.accent}
          prefix="🪙 "
          style={theme.textGlow('rgba(255,178,32,0.5)', 18)}
        />
        <Text style={styles.heroHint}>Win pots to grow it. Biggest win: 🪙 {user?.biggestWin ?? 0}</Text>
      </Animated.View>

      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListHeaderComponent={
          rows.length ? (
            <DisplayText size={16} color={theme.textDim} style={{ marginBottom: 6 }}>
              Activity
            </DisplayText>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No coin movements yet — go win a pot.</Text>
        }
        renderItem={({ item, index }) => {
          const meta = TX_META[item.type];
          const positive = item.amount >= 0;
          return (
            <Animated.View
              entering={index < 10 ? FadeInDown.delay(index * 40).springify() : undefined}
              style={styles.row}
            >
              <Text style={styles.rowIcon}>{meta.icon}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.rowLabel}>{meta.label}</Text>
                <Text style={styles.rowTime}>{timeLabel(item.createdAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.rowAmount, { color: positive ? theme.green : theme.danger }]}>
                  {positive ? '+' : '−'}🪙 {Math.abs(item.amount)}
                </Text>
                <Text style={styles.rowBalance}>🪙 {item.balanceAfter}</Text>
              </View>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  hero: {
    alignItems: 'center',
    paddingTop: 26,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: theme.panelBorder,
  },
  heroLabel: { color: theme.textDim, fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  heroHint: { color: theme.textDim, fontSize: 12, marginTop: 4, fontWeight: '600' },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.md,
    padding: 12,
    marginVertical: 3,
  },
  rowIcon: { fontSize: 20 },
  rowLabel: { color: theme.text, fontWeight: '800', fontSize: 14 },
  rowTime: { color: theme.textDim, fontSize: 11, marginTop: 1 },
  rowAmount: { fontFamily: theme.fonts.numeric, fontSize: 18, letterSpacing: 0.5 },
  rowBalance: { color: theme.textDim, fontSize: 11, marginTop: 1 },
});
