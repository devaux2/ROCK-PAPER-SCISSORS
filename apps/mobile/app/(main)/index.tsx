import React, { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { WAGER_TIERS, DAILY_TOPUP_THRESHOLD, type WagerTier } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { game } from '../../src/socket/socket';
import { api } from '../../src/api/client';
import {
  Button,
  Card,
  DisplayText,
  ErrorText,
  PressableScale,
  StatNumber,
  Tag,
} from '../../src/components/ui';
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

  // Mark queueing BEFORE emitting: the server can pair instantly, so
  // match:start may arrive before the join ack — the store must not be
  // reset after that.
  async function queueRanked(tier: WagerTier) {
    setWagerSheet(false);
    setError(null);
    startQueueing('ranked', tier);
    const res = await game.joinQueue('ranked', tier);
    if (!res.ok) {
      useMatchStore.getState().stopQueueing();
      setError(res.error ?? 'Could not join queue');
      return;
    }
    // Instant pairing can beat the ack: if the match already started, the
    // (main) layout has navigated there — don't stack /matchmaking on top.
    if (useMatchStore.getState().phase === 'queueing') router.push('/matchmaking');
  }

  async function queueCasual() {
    setError(null);
    startQueueing('casual', 0);
    const res = await game.joinQueue('casual');
    if (!res.ok) {
      useMatchStore.getState().stopQueueing();
      setError(res.error ?? 'Could not join queue');
      return;
    }
    if (useMatchStore.getState().phase === 'queueing') router.push('/matchmaking');
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
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <DisplayText size={44} color={theme.accent} style={[styles.logo, theme.glow(theme.accent, 20)]}>
          THROWDOWN
        </DisplayText>
        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Text style={styles.statEmoji}>🪙</Text>
            <StatNumber value={user?.coins ?? 0} size={22} color={theme.accent} />
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statEmoji}>⚡</Text>
            <StatNumber value={user?.elo ?? 1000} size={22} color={theme.blue} suffix=" ELO" />
          </View>
        </View>
      </Animated.View>

      {canTopup && (
        <Animated.View entering={FadeInDown.delay(60).springify()}>
          <Card style={{ borderColor: theme.accent }}>
            <Text style={styles.topupText}>Running low? Claim your daily coins.</Text>
            <Button title="Claim daily top-up" onPress={claimTopup} />
            {topupMsg && <Text style={styles.topupMsg}>{topupMsg}</Text>}
          </Card>
        </Animated.View>
      )}

      <ErrorText error={error} />

      <Animated.View entering={FadeInDown.delay(120).springify()}>
        <Card glow={theme.accent} style={styles.heroCard}>
          <View style={styles.modeHeader}>
            <DisplayText size={26} color={theme.text}>⚔️ Ranked</DisplayText>
            <Tag>Winner takes pot</Tag>
          </View>
          <Text style={styles.modeDesc}>
            Wager coins, winner takes the pot. Elo on the line.
          </Text>
          <Button title="Find ranked match" size="lg" onPress={() => setWagerSheet(true)} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).springify()}>
        <Card>
          <DisplayText size={22} color={theme.text}>🎲 Casual</DisplayText>
          <Text style={styles.modeDesc}>No wager, no rating. Just throws.</Text>
          <Button title="Find casual match" variant="secondary" onPress={queueCasual} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).springify()}>
        <Card>
          <DisplayText size={22} color={theme.text}>🤖 Practice</DisplayText>
          <Text style={styles.modeDesc}>Sharpen up against RoboThrow. Nothing at stake.</Text>
          <Button title="Play vs bot" variant="secondary" onPress={playBot} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()}>
        <Button title="⚙️  Settings & skins" variant="ghost" onPress={() => router.push('/settings')} />
      </Animated.View>

      <Modal visible={wagerSheet} transparent animationType="none" onRequestClose={() => setWagerSheet(false)}>
        <Animated.View entering={FadeIn.duration(160)} style={styles.sheetBackdropFill}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setWagerSheet(false)}>
            <Animated.View entering={SlideInDown.springify().damping(16)}>
              <Pressable style={styles.sheet} onPress={() => {}}>
                <View style={styles.sheetHandle} />
                <DisplayText size={26} color={theme.text} style={styles.sheetTitle}>
                  Choose your wager
                </DisplayText>
                {WAGER_TIERS.map((tier) => {
                  const affordable = (user?.coins ?? 0) >= tier;
                  return (
                    <PressableScale
                      key={tier}
                      disabled={!affordable}
                      onPress={() => queueRanked(tier)}
                      style={[styles.tier, !affordable && styles.tierDisabled]}
                    >
                      <DisplayText size={22} color={affordable ? theme.accent : theme.textDim}>
                        🪙 {tier}
                      </DisplayText>
                      <DisplayText size={18} color={affordable ? theme.green : theme.textDim}>
                        win {tier * 2}
                      </DisplayText>
                    </PressableScale>
                  );
                })}
                <Button title="Cancel" variant="ghost" onPress={() => setWagerSheet(false)} />
              </Pressable>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 64 },
  header: { alignItems: 'center' },
  logo: { textAlign: 'center' },
  statRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 14 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  statEmoji: { fontSize: 16 },
  heroCard: { borderColor: theme.accent },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topupText: { color: theme.text, marginBottom: 8, fontWeight: '600' },
  topupMsg: { color: theme.green, marginTop: 6, textAlign: 'center', fontWeight: '700' },
  modeDesc: { color: theme.textDim, marginTop: 6, marginBottom: 12, fontWeight: '600' },
  sheetBackdropFill: { flex: 1 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,6,14,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 20,
    paddingBottom: 36,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.panelBorder,
    marginBottom: 12,
  },
  sheetTitle: { textAlign: 'center', marginBottom: 14 },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bgRaised,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginVertical: 5,
  },
  tierDisabled: { opacity: 0.4 },
});
