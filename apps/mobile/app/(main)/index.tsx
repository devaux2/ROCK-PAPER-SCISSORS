import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { WAGER_TIERS, DAILY_TOPUP_THRESHOLD, type WagerTier } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { game } from '../../src/socket/socket';
import { api } from '../../src/api/client';
import { Button, Card, ErrorText } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const startQueueing = useMatchStore((s) => s.startQueueing);
  const [wagerSheet, setWagerSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topupMsg, setTopupMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshMe();
    }, [refreshMe])
  );

  async function queueRanked(tier: WagerTier) {
    setWagerSheet(false);
    setError(null);
    const res = await game.joinQueue('ranked', tier);
    if (!res.ok) {
      setError(res.error ?? 'Could not join queue');
      return;
    }
    startQueueing('ranked', tier);
    router.push('/matchmaking');
  }

  async function queueCasual() {
    setError(null);
    const res = await game.joinQueue('casual');
    if (!res.ok) {
      setError(res.error ?? 'Could not join queue');
      return;
    }
    startQueueing('casual', 0);
    router.push('/matchmaking');
  }

  async function playBot() {
    setError(null);
    const res = await game.startBotMatch();
    if (!res.ok) setError(res.error ?? 'Could not start practice match');
    // match:start will navigate via the (main) layout effect.
  }

  async function claimTopup() {
    setError(null);
    try {
      const res = await api.dailyTopup();
      setTopupMsg(`+${res.granted} coins claimed!`);
      void refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed');
    }
  }

  const canTopup = (user?.coins ?? 0) < DAILY_TOPUP_THRESHOLD;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>THROWDOWN</Text>
      <View style={styles.coinRow}>
        <Text style={styles.coins}>🪙 {user?.coins ?? 0}</Text>
        <Text style={styles.elo}>⚡ {user?.elo ?? 1000} ELO</Text>
      </View>

      {canTopup && (
        <Card style={{ borderColor: theme.accent }}>
          <Text style={styles.topupText}>Running low? Claim your daily coins.</Text>
          <Button title="Claim daily top-up" onPress={claimTopup} />
          {topupMsg && <Text style={styles.topupMsg}>{topupMsg}</Text>}
        </Card>
      )}

      <ErrorText error={error} />

      <Card>
        <Text style={styles.modeTitle}>⚔️ Ranked</Text>
        <Text style={styles.modeDesc}>
          Wager coins, winner takes the pot. Elo on the line.
        </Text>
        <Button title="Find ranked match" onPress={() => setWagerSheet(true)} />
      </Card>

      <Card>
        <Text style={styles.modeTitle}>🎲 Casual</Text>
        <Text style={styles.modeDesc}>No wager, no rating. Just throws.</Text>
        <Button title="Find casual match" variant="secondary" onPress={queueCasual} />
      </Card>

      <Card>
        <Text style={styles.modeTitle}>🤖 Practice</Text>
        <Text style={styles.modeDesc}>Sharpen up against RoboThrow. Nothing at stake.</Text>
        <Button title="Play vs bot" variant="secondary" onPress={playBot} />
      </Card>

      <Button title="⚙️  Settings & skins" variant="ghost" onPress={() => router.push('/settings')} />

      <Modal visible={wagerSheet} transparent animationType="slide" onRequestClose={() => setWagerSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setWagerSheet(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Choose your wager</Text>
            {WAGER_TIERS.map((tier) => {
              const affordable = (user?.coins ?? 0) >= tier;
              return (
                <Pressable
                  key={tier}
                  disabled={!affordable}
                  onPress={() => queueRanked(tier)}
                  style={({ pressed }) => [styles.tier, (!affordable || pressed) && { opacity: 0.45 }]}
                >
                  <Text style={styles.tierCoins}>🪙 {tier}</Text>
                  <Text style={styles.tierWin}>win {tier * 2}</Text>
                </Pressable>
              );
            })}
            <Button title="Cancel" variant="ghost" onPress={() => setWagerSheet(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 64 },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: theme.accent,
    letterSpacing: 6,
    textAlign: 'center',
  },
  coinRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginVertical: 12 },
  coins: { color: theme.text, fontSize: 18, fontWeight: '800' },
  elo: { color: theme.blue, fontSize: 18, fontWeight: '800' },
  topupText: { color: theme.text, marginBottom: 8, fontWeight: '600' },
  topupMsg: { color: theme.green, marginTop: 6, textAlign: 'center', fontWeight: '700' },
  modeTitle: { color: theme.text, fontSize: 20, fontWeight: '900' },
  modeDesc: { color: theme.textDim, marginTop: 4, marginBottom: 10 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: { color: theme.text, fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  tier: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 16,
    marginVertical: 5,
  },
  tierCoins: { color: theme.text, fontWeight: '800', fontSize: 16 },
  tierWin: { color: theme.green, fontWeight: '700' },
});
