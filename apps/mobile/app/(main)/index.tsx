import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { WAGER_TIERS, DAILY_TOPUP_THRESHOLD, type WagerTier } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { game } from '../../src/socket/socket';
import { api } from '../../src/api/client';
import { playSound, startMusic } from '../../src/sound';
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
  const wager = useSettingsStore((s) => s.wager);
  const setWager = useSettingsStore((s) => s.setWager);
  const [wagerSheet, setWagerSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topupMsg, setTopupMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshMe();
      startMusic();
    }, [refreshMe])
  );

  const coins = user?.coins ?? 0;
  const affordable = wager === 0 || coins >= wager;

  // The one button that matters. Wager 0 -> casual, otherwise ranked
  // matched inside the same wager bracket.
  async function play() {
    setError(null);
    startMusic();
    playSound('click');
    const ranked = wager > 0;
    startQueueing(ranked ? 'ranked' : 'casual', wager);
    const res = ranked
      ? await game.joinQueue('ranked', wager as WagerTier)
      : await game.joinQueue('casual');
    if (!res.ok) {
      useMatchStore.getState().stopQueueing();
      setError(res.error ?? 'Could not join queue');
      return;
    }
    if (useMatchStore.getState().phase === 'queueing') router.push('/matchmaking');
  }

  async function playBot() {
    setError(null);
    startMusic();
    const res = await game.startBotMatch();
    if (!res.ok) setError(res.error ?? 'Could not start practice match');
  }

  async function claimTopup() {
    setError(null);
    try {
      const res = await api.dailyTopup();
      setTopupMsg(`+${res.granted} coins claimed!`);
      playSound('win');
      void refreshMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed');
    }
  }

  const canTopup = coins < DAILY_TOPUP_THRESHOLD;

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.springify()}>
          <DisplayText
            size={48}
            color={theme.accent}
            style={[styles.logo, theme.textGlow(theme.accent, 18)]}
          >
            RPS
          </DisplayText>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <StatNumber value={coins} size={20} color={theme.accent} prefix="🪙 " />
            </View>
          </View>
        </Animated.View>

        {canTopup && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Card glow={theme.accent} style={{ borderColor: theme.accent }}>
              <Text style={styles.topupText}>Running low? Claim your daily coins.</Text>
              <Button title="Claim daily top-up" onPress={claimTopup} />
              {topupMsg && <Text style={styles.topupMsg}>{topupMsg}</Text>}
            </Card>
          </Animated.View>
        )}

        <ErrorText error={error} />

        {/* The arena floor: one giant PLAY */}
        <Animated.View entering={FadeInDown.delay(120).springify()} style={styles.playZone}>
          <PlayButton disabled={!affordable} onPress={play} />
          {wager === 0 ? (
            <Text style={styles.playHint}>Casual — nothing at stake</Text>
          ) : affordable ? (
            <DisplayText
              size={26}
              color={theme.green}
              style={[{ textAlign: 'center', marginTop: 12 }, theme.textGlow(theme.green, 10)]}
            >
              Winner takes 🪙 {wager * 2}
            </DisplayText>
          ) : (
            <Text style={[styles.playHint, { color: theme.danger }]}>
              You need 🪙 {wager} for this bracket
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.secondaryRow}>
          <Button title="Play vs bot" variant="secondary" onPress={playBot} />
          <Button title="⚙️  Settings & skins" variant="ghost" onPress={() => router.push('/settings')} />
        </Animated.View>
      </ScrollView>

      {/* Stake selector — bottom right, big enough to see from orbit */}
      <PressableScale
        accessibilityLabel="Wager selector"
        style={styles.wagerDock}
        onPress={() => {
          playSound('click');
          setWagerSheet(true);
        }}
      >
        {wager > 0 ? (
          <LinearGradient
            colors={theme.gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.wagerCard, theme.glow('#FFB020', 18)]}
          >
            <Text style={[styles.wagerLabel, { color: 'rgba(0,0,0,0.55)' }]}>YOUR STAKE</Text>
            <DisplayText size={40} color={theme.accentText}>
              🪙 {wager}
            </DisplayText>
            <Text style={styles.wagerWin}>WIN 🪙 {wager * 2}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.wagerCard, styles.wagerCardCasual]}>
            <Text style={[styles.wagerLabel, { color: theme.textDim }]}>YOUR STAKE</Text>
            <DisplayText size={30} color={theme.text}>
              Casual
            </DisplayText>
            <Text style={[styles.wagerWin, { color: theme.accent }]}>TAP TO BET</Text>
          </View>
        )}
      </PressableScale>

      <Modal visible={wagerSheet} transparent animationType="none" onRequestClose={() => setWagerSheet(false)}>
        <Animated.View entering={FadeIn.duration(140)} style={styles.sheetBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setWagerSheet(false)} />
          <Animated.View entering={SlideInDown.springify().damping(16)} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <DisplayText size={24} style={{ textAlign: 'center', marginBottom: 12 }}>
              Choose your stake
            </DisplayText>
            <TierRow
              label="Casual"
              sub="no wager · just pride"
              selected={wager === 0}
              affordable
              onPress={() => {
                setWager(0);
                setWagerSheet(false);
              }}
            />
            {WAGER_TIERS.map((tier) => (
              <TierRow
                key={tier}
                label={`🪙 ${tier}`}
                sub={`win ${tier * 2}`}
                selected={wager === tier}
                affordable={coins >= tier}
                onPress={() => {
                  setWager(tier);
                  setWagerSheet(false);
                }}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

/** The giant pulsing PLAY button. */
function PlayButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  // The universal "wanna go?" gesture: a fist held out, ready to throw.
  return (
    <Animated.View style={[animated, { alignItems: 'center' }]}>
      <PressableScale onPress={onPress} disabled={disabled} style={disabled && { opacity: 0.5 }}>
        <LinearGradient
          colors={theme.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.playButton, !disabled && theme.glow('#FFB020', 26)]}
        >
          <Text style={styles.playFist}>✊</Text>
          <DisplayText size={40} color={theme.accentText}>
            Play
          </DisplayText>
        </LinearGradient>
      </PressableScale>
    </Animated.View>
  );
}

function TierRow({
  label,
  sub,
  selected,
  affordable,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  affordable: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      disabled={!affordable}
      onPress={onPress}
      style={[styles.tier, selected && styles.tierSelected, !affordable && { opacity: 0.4 }]}
    >
      <DisplayText size={22} color={selected ? theme.accent : theme.text}>
        {label}
      </DisplayText>
      <Text style={[styles.tierSub, { color: label === 'Casual' ? theme.textDim : theme.green }]}>
        {sub}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 20, paddingTop: 56, paddingBottom: 120, flexGrow: 1 },
  logo: { textAlign: 'center' },
  chipRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 12 },
  chip: {
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  topupText: { color: theme.text, marginBottom: 8, fontWeight: '600' },
  topupMsg: { color: theme.green, marginTop: 6, textAlign: 'center', fontWeight: '700' },
  playZone: { flex: 1, justifyContent: 'center', paddingVertical: theme.space(8) },
  playButton: {
    width: 210,
    height: 210,
    borderRadius: 105,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playFist: { fontSize: 84, marginBottom: -2 },
  playHint: {
    color: theme.textDim,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '700',
  },
  secondaryRow: { marginTop: theme.space(2) },
  wagerDock: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  wagerCard: {
    minWidth: 150,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  wagerCardCasual: {
    backgroundColor: theme.bgRaised,
    borderWidth: 2,
    borderColor: theme.accent,
  },
  wagerLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  wagerWin: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: 'rgba(0,0,0,0.6)',
    marginTop: 2,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: theme.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 20,
    paddingBottom: 34,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.panelBorder,
    marginBottom: 12,
  },
  tier: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.bgRaised,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.panelBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginVertical: 4,
  },
  tierSelected: { borderColor: theme.accent },
  tierSub: { fontWeight: '800', fontSize: 13 },
});
