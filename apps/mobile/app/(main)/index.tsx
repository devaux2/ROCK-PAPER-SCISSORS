import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { WAGER_TIERS, DAILY_TOPUP_THRESHOLD, type WagerTier, type RecentWinRow } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { game } from '../../src/socket/socket';
import { api } from '../../src/api/client';
import { playSound, startMusic } from '../../src/sound';
import { Avatar } from '../../src/components/Avatar';
import { DisplayText, ErrorText, MarkerText, PressableScale, StatNumber } from '../../src/components/ui';
import { CoinField, GoldPlate, LightPool, ShineSweep } from '../../src/components/bling';
import { rankTitle } from '../../src/rank';
import { theme } from '../../src/theme';

/** All selectable stakes; 0 = casual. */
const STAKES: number[] = [0, ...WAGER_TIERS];

function chipLabel(stake: number): string {
  if (stake === 0) return 'FREE';
  return stake >= 1000 ? `${stake / 1000}K` : String(stake);
}

function timeAgo(iso: string): string {
  const then = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const startQueueing = useMatchStore((s) => s.startQueueing);
  const wager = useSettingsStore((s) => s.wager);
  const setWager = useSettingsStore((s) => s.setWager);
  const [error, setError] = useState<string | null>(null);
  const [wins, setWins] = useState<RecentWinRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      void refreshMe();
      api.winsFeed().then(setWins).catch(() => {});
      startMusic();
    }, [refreshMe])
  );

  const coins = user?.coins ?? 0;
  const affordable = wager === 0 || coins >= wager;
  const stakeIndex = Math.max(0, STAKES.indexOf(wager));

  function step(dir: 1 | -1) {
    playSound('click');
    const next = Math.min(STAKES.length - 1, Math.max(0, stakeIndex + dir));
    setWager(STAKES[next]);
  }

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

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---- header: who you are / what you hold ---- */}
        <Animated.View entering={FadeInDown.springify()} style={styles.headerRow}>
          <PressableScale style={styles.identity} onPress={() => router.push('/profile')}>
            <View style={styles.avatarRing}>
              <Avatar avatar={user?.avatar ?? 'avatar_01'} size={44} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.headerName}>{user?.username ?? ''}</Text>
              <View style={styles.rankChip}>
                <Text style={styles.rankChipText}>🥇 {rankTitle(user?.wins ?? 0)}</Text>
              </View>
            </View>
          </PressableScale>
          <PressableScale
            accessibilityLabel="Balance"
            style={styles.balancePill}
            onPress={() => router.push('/wallet')}
          >
            <Text style={styles.balanceLabel}>BALANCE</Text>
            <StatNumber value={coins} size={22} color={theme.accent} prefix="🪙 " />
          </PressableScale>
        </Animated.View>

        {/* ---- hero: the three hands under the arch ---- */}
        <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.hero}>
          <LightPool size={340} style={{ top: -20, alignSelf: 'center' }} />
          <CoinField count={10} />
          <DisplayText size={84} color={theme.text} style={[styles.logo, theme.textGlow('rgba(255,201,60,0.55)', 24)]}>
            RPS
          </DisplayText>
          <MarkerText size={20} style={[styles.tagline, theme.textGlow('rgba(255,178,32,0.6)', 12)]}>
            Real money. Real wins.
          </MarkerText>
          <View style={styles.arch} pointerEvents="none" />
          <View style={styles.handsRow}>
            <HandPedestal emoji="✊" label="Rock" sub="Crush it" />
            <HandPedestal emoji="✋" label="Paper" sub="Outsmart" hero />
            <HandPedestal emoji="✌️" label="Scissors" sub="Cut it" />
          </View>
        </Animated.View>

        {/* ---- the stake console ---- */}
        <Animated.View entering={FadeInDown.delay(110).springify()} style={styles.stakeCard}>
          <View style={styles.stakeHeader}>
            <Text style={styles.stakeHeaderIcon}>🪙</Text>
            <Text style={styles.stakeHeaderText}>CURRENT STAKE</Text>
          </View>

          <View style={styles.stepperRow}>
            <StepButton label="−" disabled={stakeIndex === 0} onPress={() => step(-1)} />
            {wager === 0 ? (
              <DisplayText size={56} color={theme.text} style={styles.stakeValue}>
                Free
              </DisplayText>
            ) : (
              <StatNumber value={wager} size={64} color={theme.accent} style={styles.stakeValue} />
            )}
            <StepButton label="+" disabled={stakeIndex === STAKES.length - 1} onPress={() => step(1)} />
          </View>

          <View style={styles.chipRow}>
            {STAKES.map((stake) => {
              const selected = stake === wager;
              const canAfford = stake === 0 || coins >= stake;
              return (
                <PressableScale
                  key={stake}
                  disabled={!canAfford}
                  onPress={() => {
                    playSound('click');
                    setWager(stake);
                  }}
                  style={[styles.chip, selected && styles.chipSelected, !canAfford && { opacity: 0.35 }]}
                >
                  <Text style={[styles.chipText, selected && { color: theme.accent }]}>
                    {chipLabel(stake)}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <PressableScale
            accessibilityLabel="Play now"
            disabled={!affordable}
            onPress={play}
            style={{ marginTop: 14 }}
          >
            <GoldPlate disabled={!affordable}>
              <View style={styles.playInner}>
                <DisplayText size={34} color={theme.accentText}>
                  {wager === 0 ? 'Play free' : 'Play now'}
                </DisplayText>
                <Text style={styles.playSub}>
                  {wager === 0 ? 'CASUAL MATCH · NO STAKES' : 'FIND AN OPPONENT'}
                </Text>
              </View>
            </GoldPlate>
          </PressableScale>

          {wager > 0 && affordable && (
            <Text style={styles.potHint}>
              Winner takes <Text style={{ color: theme.accent, fontWeight: '900' }}>🪙 {wager * 2}</Text>
            </Text>
          )}
          {!affordable && (
            <Text style={[styles.potHint, { color: theme.danger }]}>
              You need 🪙 {wager} to enter this bracket
            </Text>
          )}
          <ErrorText error={error} />
        </Animated.View>

        {/* ---- your numbers ---- */}
        <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.statsRow}>
          <StatCell icon="🏆" label="Total wins">
            <StatNumber value={user?.wins ?? 0} size={26} color={theme.accent} />
          </StatCell>
          <StatCell icon="🎯" label="Win rate">
            <StatNumber
              value={Math.round((user?.winRate ?? 0) * 100)}
              suffix="%"
              size={26}
              color={theme.accent}
            />
          </StatCell>
          <StatCell icon="💵" label="Biggest win">
            <StatNumber value={user?.biggestWin ?? 0} size={26} color={theme.accent} />
          </StatCell>
        </Animated.View>

        {/* ---- proof other people are winning ---- */}
        {wins.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.ticker}>
            {wins.slice(0, 3).map((w, i) => (
              <View key={`${w.username}-${w.at}-${i}`} style={[styles.tickerRow, i > 0 && styles.tickerRowBorder]}>
                <Text style={styles.tickerBadge}>RECENT WIN</Text>
                <Text style={styles.tickerName} numberOfLines={1}>
                  {w.username}
                </Text>
                <Text style={styles.tickerAmount}>won 🪙 {w.amount}</Text>
                <Text style={styles.tickerTime}>{timeAgo(w.at)}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* ---- climb the ranks ---- */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <PressableScale onPress={() => router.push('/leaderboard')} style={styles.ranksCard}>
            <Text style={styles.ranksShield}>🛡️</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <DisplayText size={20} color={theme.text}>
                Climb the ranks
              </DisplayText>
              <Text style={styles.ranksSub}>Win more. Rank up.{'\n'}Take the top spot.</Text>
            </View>
            <View style={styles.ranksBtn}>
              <Text style={styles.ranksBtnText}>VIEW RANKS</Text>
            </View>
          </PressableScale>
        </Animated.View>

        {/* ---- daily bonus ---- */}
        <DailyBonusCard coins={coins} onClaimed={refreshMe} />

        <PressableScale onPress={playBot} style={styles.botLink}>
          <Text style={styles.botLinkText}>🤖 Practice vs bot — free</Text>
        </PressableScale>
      </ScrollView>
    </View>
  );
}

/** One stone hand on its plinth. The center one stands taller. */
function HandPedestal({
  emoji,
  label,
  sub,
  hero,
}: {
  emoji: string;
  label: string;
  sub: string;
  hero?: boolean;
}) {
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: hero ? 1600 : 2100, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: hero ? 1600 : 2100, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
  }, [bob, hero]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -5 }] }));
  return (
    <View style={[styles.pedestalWrap, hero && { marginTop: -18 }]}>
      <Animated.Text
        style={[
          { fontSize: hero ? 64 : 52 },
          theme.textGlow('rgba(255,178,32,0.75)', 18),
          animated,
        ]}
      >
        {emoji}
      </Animated.Text>
      <View style={[styles.plinth, hero && styles.plinthHero]}>
        <DisplayText size={15} color={theme.text}>
          {label}
        </DisplayText>
        <Text style={styles.plinthSub}>{sub}</Text>
      </View>
    </View>
  );
}

function StepButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityLabel={label === '+' ? 'Raise stake' : 'Lower stake'}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stepBtn, disabled && { opacity: 0.3 }]}
    >
      <DisplayText size={30} color={theme.accent}>
        {label}
      </DisplayText>
    </PressableScale>
  );
}

function StatCell({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function DailyBonusCard({ coins, onClaimed }: { coins: number; onClaimed: () => Promise<void> | void }) {
  const eligible = coins < DAILY_TOPUP_THRESHOLD;
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function claim() {
    setErr(null);
    setMsg(null);
    try {
      const res = await api.dailyTopup();
      playSound('coins');
      setMsg(`+🪙 ${res.granted} claimed!`);
      await onClaimed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Top-up failed');
    }
  }

  return (
    <Animated.View entering={FadeInDown.delay(280).springify()} style={styles.bonusCard}>
      {eligible && <ShineSweep period={3600} />}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <DisplayText size={18} color={theme.accent}>
            Daily bonus
          </DisplayText>
          {eligible && <View style={styles.bonusDot} />}
        </View>
        <Text style={styles.bonusSub}>
          {eligible
            ? 'Refill to 🪙 100 — claim it while you can!'
            : `Drops when your balance falls below 🪙 ${DAILY_TOPUP_THRESHOLD}`}
        </Text>
        {msg && <Text style={styles.bonusMsg}>{msg}</Text>}
        {err && <Text style={styles.bonusErr}>{err}</Text>}
      </View>
      <PressableScale
        disabled={!eligible}
        onPress={claim}
        style={[styles.claimBtn, !eligible && { opacity: 0.35 }]}
      >
        <LinearGradient
          colors={theme.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.claimBtnInner}
        >
          <Text style={styles.claimBtnText}>CLAIM</Text>
        </LinearGradient>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 16, paddingTop: 54, paddingBottom: 110 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: {
    borderWidth: 2,
    borderColor: theme.accent,
    borderRadius: 26,
    padding: 2,
    ...theme.glow('#FFB020', 10),
  },
  headerName: { color: theme.text, fontWeight: '900', fontSize: 16 },
  rankChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  rankChipText: { color: theme.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  balancePill: {
    alignItems: 'center',
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...theme.glow('#FFB020', 8),
  },
  balanceLabel: { color: theme.textDim, fontSize: 9, fontWeight: '900', letterSpacing: 2 },

  hero: { alignItems: 'center', marginTop: 18, paddingBottom: 6 },
  logo: { textAlign: 'center' },
  tagline: { textAlign: 'center', marginTop: -2, transform: [{ rotate: '-2deg' }] },
  arch: {
    position: 'absolute',
    bottom: -40,
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1.5,
    borderColor: 'rgba(255,178,32,0.30)',
    alignSelf: 'center',
    ...theme.glow('#FFB020', 22),
  },
  handsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 14,
    marginTop: 18,
  },
  pedestalWrap: { alignItems: 'center' },
  plinth: {
    alignItems: 'center',
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.goldBorder,
    borderTopWidth: 2,
    borderTopColor: theme.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
    minWidth: 92,
  },
  plinthHero: { minWidth: 100, paddingVertical: 8 },
  plinthSub: { color: theme.textDim, fontSize: 10, fontWeight: '700', marginTop: 1 },

  stakeCard: {
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.xl,
    padding: 16,
    marginTop: 22,
    ...theme.glow('#FFB020', 12),
  },
  stakeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  stakeHeaderIcon: { fontSize: 14 },
  stakeHeaderText: { color: theme.text, fontSize: 12, fontWeight: '900', letterSpacing: 3 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stakeValue: { textAlign: 'center', minWidth: 150 },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.panelBorder,
  },
  chipSelected: { borderColor: theme.accent, ...theme.glow('#FFB020', 8) },
  chipText: { color: theme.textDim, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  playInner: { alignItems: 'center', paddingVertical: 16, alignSelf: 'stretch' },
  playSub: { color: 'rgba(26,17,2,0.65)', fontSize: 11, fontWeight: '900', letterSpacing: 3, marginTop: 2 },
  potHint: { color: theme.textDim, textAlign: 'center', marginTop: 10, fontWeight: '700', fontSize: 13 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.lg,
    marginTop: 14,
    paddingVertical: 12,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 2 },
  statIcon: { fontSize: 18 },
  statLabel: { color: theme.textDim, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

  ticker: {
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.md,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  tickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 8 },
  tickerRowBorder: { borderTopWidth: 1, borderTopColor: theme.panelBorder },
  tickerBadge: { color: theme.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  tickerName: { color: theme.text, fontWeight: '800', fontSize: 13, flex: 1 },
  tickerAmount: { color: theme.accent, fontWeight: '900', fontSize: 13 },
  tickerTime: { color: theme.textDim, fontSize: 11 },

  ranksCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginTop: 10,
  },
  ranksShield: { fontSize: 34 },
  ranksSub: { color: theme.textDim, fontSize: 12, marginTop: 2, lineHeight: 16 },
  ranksBtn: {
    borderWidth: 1.5,
    borderColor: theme.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  ranksBtnText: { color: theme.accent, fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },

  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginTop: 10,
    overflow: 'hidden',
  },
  bonusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.danger,
    ...theme.glow(theme.danger, 6),
  },
  bonusSub: { color: theme.textDim, fontSize: 12, marginTop: 3 },
  bonusMsg: { color: theme.green, fontWeight: '800', marginTop: 4, fontSize: 12 },
  bonusErr: { color: theme.danger, fontWeight: '700', marginTop: 4, fontSize: 12 },
  claimBtn: { marginLeft: 12, borderRadius: theme.radius.sm, ...theme.glow('#FFB020', 10) },
  claimBtnInner: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  claimBtnText: { color: theme.accentText, fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },

  botLink: { alignSelf: 'center', marginTop: 16, padding: 8 },
  botLinkText: { color: theme.textDim, fontWeight: '700', fontSize: 13 },
});
