import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
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
import { requestAppFullscreen } from '../../src/fullscreen';
import { Avatar } from '../../src/components/Avatar';
import { DisplayText, ErrorText, MarkerText, PressableScale, StatNumber } from '../../src/components/ui';
import { CoinField, GoldPlate, LightPool } from '../../src/components/bling';
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

/**
 * The one-screen casino floor: everything that matters — who you are, what
 * you hold, what you're staking, proof people are winning — visible at once
 * with zero scrolling.
 */
export default function Home() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compact = height < 780;
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
    requestAppFullscreen();
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
      {/* ---- header: who you are / what you hold ---- */}
      <Animated.View entering={FadeInDown.springify()} style={styles.headerRow}>
        <PressableScale style={styles.identity} onPress={() => router.push('/profile')}>
          <View style={styles.avatarRing}>
            <Avatar avatar={user?.avatar ?? 'avatar_01'} size={40} />
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
          <StatNumber value={coins} size={20} color={theme.accent} prefix="🪙 " />
        </PressableScale>
      </Animated.View>

      {/* ---- hero: the hands under the arch ---- */}
      <Animated.View entering={FadeInDown.delay(50).springify()} style={styles.hero}>
        <LightPool size={compact ? 240 : 300} style={{ top: -30, alignSelf: 'center' }} />
        <CoinField count={compact ? 6 : 8} />
        <View style={styles.arch} pointerEvents="none" />
        <DisplayText
          size={compact ? 44 : 56}
          color={theme.text}
          style={[styles.logo, theme.textGlow('rgba(255,201,60,0.55)', 20)]}
        >
          RPS
        </DisplayText>
        <MarkerText
          size={compact ? 14 : 17}
          style={[styles.tagline, theme.textGlow('rgba(255,178,32,0.6)', 10)]}
        >
          Real money. Real wins.
        </MarkerText>
        <View style={styles.handsRow}>
          <HandPedestal emoji="✊" label="Rock" sub="Crush it" compact={compact} />
          <HandPedestal emoji="✋" label="Paper" sub="Outsmart" hero compact={compact} />
          <HandPedestal emoji="✌️" label="Scissors" sub="Cut it" compact={compact} />
        </View>
      </Animated.View>

      {/* ---- the stake console ---- */}
      <Animated.View entering={FadeInDown.delay(110).springify()} style={styles.stakeCard}>
        <View style={styles.stakeHeader}>
          <Text style={styles.stakeHeaderIcon}>🪙</Text>
          <Text style={styles.stakeHeaderText}>CURRENT STAKE</Text>
          {wager > 0 && affordable && (
            <Text style={styles.stakeHeaderWin}> · WINNER TAKES 🪙 {wager * 2}</Text>
          )}
        </View>

        <View style={styles.stepperRow}>
          <StepButton label="−" disabled={stakeIndex === 0} onPress={() => step(-1)} />
          {wager === 0 ? (
            <DisplayText size={compact ? 38 : 46} color={theme.text} style={styles.stakeValue}>
              Free
            </DisplayText>
          ) : (
            <StatNumber value={wager} size={compact ? 44 : 54} color={theme.accent} style={styles.stakeValue} />
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
          style={{ marginTop: 10 }}
        >
          <GoldPlate disabled={!affordable}>
            <View style={styles.playInner}>
              <DisplayText size={compact ? 26 : 30} color={theme.accentText}>
                {wager === 0 ? 'Play free' : 'Play now'}
              </DisplayText>
              <Text style={styles.playSub}>
                {wager === 0 ? 'CASUAL MATCH · NO STAKES' : 'FIND AN OPPONENT'}
              </Text>
            </View>
          </GoldPlate>
        </PressableScale>
        {!affordable && (
          <Text style={styles.brokeHint}>You need 🪙 {wager} to enter this bracket</Text>
        )}
        <ErrorText error={error} />
      </Animated.View>

      {/* ---- your numbers ---- */}
      <Animated.View entering={FadeInDown.delay(160).springify()} style={styles.statsRow}>
        <StatCell icon="🏆" label="Total wins">
          <StatNumber value={user?.wins ?? 0} size={22} color={theme.accent} />
        </StatCell>
        <StatCell icon="🎯" label="Win rate">
          <StatNumber
            value={Math.round((user?.winRate ?? 0) * 100)}
            suffix="%"
            size={22}
            color={theme.accent}
          />
        </StatCell>
        <StatCell icon="💵" label="Biggest win">
          <StatNumber value={user?.biggestWin ?? 0} size={22} color={theme.accent} />
        </StatCell>
      </Animated.View>

      {/* ---- proof other people are winning (one line, rotating) ---- */}
      <WinTicker wins={wins} />

      {/* ---- daily bonus + practice, one row ---- */}
      <Animated.View entering={FadeInDown.delay(240).springify()} style={styles.bottomRow}>
        <DailyBonusCard coins={coins} onClaimed={refreshMe} />
        <PressableScale onPress={playBot} style={styles.botCard}>
          <Text style={{ fontSize: 18 }}>🤖</Text>
          <Text style={styles.botCardText}>Practice vs bot — free</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

/** One stone hand on its plinth. The center one stands taller. */
function HandPedestal({
  emoji,
  label,
  sub,
  hero,
  compact,
}: {
  emoji: string;
  label: string;
  sub: string;
  hero?: boolean;
  compact?: boolean;
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
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value * -4 }] }));
  const size = compact ? (hero ? 40 : 32) : hero ? 50 : 40;
  return (
    <View style={[styles.pedestalWrap, hero && { marginTop: -12 }]}>
      <Animated.Text
        style={[{ fontSize: size }, theme.textGlow('rgba(255,178,32,0.75)', 14), animated]}
      >
        {emoji}
      </Animated.Text>
      <View style={styles.plinth}>
        <DisplayText size={12} color={theme.text}>
          {label}
        </DisplayText>
        {!compact && <Text style={styles.plinthSub}>{sub}</Text>}
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
      <DisplayText size={26} color={theme.accent}>
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

/** Single-line ticker cycling through the latest pots collected. */
function WinTicker({ wins }: { wins: RecentWinRow[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (wins.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % wins.length), 3200);
    return () => clearInterval(timer);
  }, [wins.length]);
  if (wins.length === 0) {
    return (
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.ticker}>
        <Text style={styles.tickerBadge}>LIVE</Text>
        <Text style={styles.tickerName}>Pots land here the second someone wins one…</Text>
      </Animated.View>
    );
  }
  const w = wins[index % wins.length];
  return (
    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.ticker}>
      <Text style={styles.tickerBadge}>RECENT WIN</Text>
      <Animated.View key={`${w.username}-${w.at}`} entering={FadeIn.duration(360)} style={styles.tickerBody}>
        <Text style={styles.tickerName} numberOfLines={1}>
          {w.username}
        </Text>
        <Text style={styles.tickerAmount}>won 🪙 {w.amount}</Text>
        <Text style={styles.tickerTime}>{timeAgo(w.at)}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function DailyBonusCard({ coins, onClaimed }: { coins: number; onClaimed: () => Promise<void> | void }) {
  const eligible = coins < DAILY_TOPUP_THRESHOLD;
  const [msg, setMsg] = useState<string | null>(null);

  async function claim() {
    setMsg(null);
    try {
      const res = await api.dailyTopup();
      playSound('coins');
      setMsg(`+🪙 ${res.granted}!`);
      await onClaimed();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Top-up failed');
    }
  }

  return (
    <View style={[styles.bonusCard, !eligible && { opacity: 0.55 }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <DisplayText size={14} color={theme.accent}>
            Daily bonus
          </DisplayText>
          {eligible && <View style={styles.bonusDot} />}
        </View>
        <Text style={styles.bonusSub} numberOfLines={1}>
          {msg ?? (eligible ? 'Refill to 🪙 100' : `Below 🪙 ${DAILY_TOPUP_THRESHOLD} only`)}
        </Text>
      </View>
      <PressableScale disabled={!eligible} onPress={claim} style={styles.claimBtn}>
        <LinearGradient
          colors={theme.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.claimBtnInner}
        >
          <Text style={styles.claimBtnText}>CLAIM</Text>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    paddingHorizontal: 14,
    paddingTop: 46,
    paddingBottom: 8,
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: {
    borderWidth: 2,
    borderColor: theme.accent,
    borderRadius: 24,
    padding: 2,
    ...theme.glow('#FFB020', 10),
  },
  headerName: { color: theme.text, fontWeight: '900', fontSize: 15 },
  rankChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    marginTop: 2,
  },
  rankChipText: { color: theme.textDim, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  balancePill: {
    alignItems: 'center',
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 5,
    ...theme.glow('#FFB020', 8),
  },
  balanceLabel: { color: theme.textDim, fontSize: 8, fontWeight: '900', letterSpacing: 2 },

  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 150 },
  logo: { textAlign: 'center' },
  tagline: { textAlign: 'center', marginTop: -2, transform: [{ rotate: '-2deg' }] },
  arch: {
    position: 'absolute',
    bottom: -30,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
    borderColor: 'rgba(255,178,32,0.30)',
    alignSelf: 'center',
    ...theme.glow('#FFB020', 22),
  },
  handsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 5,
    minWidth: 80,
  },
  plinthSub: { color: theme.textDim, fontSize: 9, fontWeight: '700', marginTop: 1 },

  stakeCard: {
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
    ...theme.glow('#FFB020', 12),
  },
  stakeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  stakeHeaderIcon: { fontSize: 12 },
  stakeHeaderText: { color: theme.text, fontSize: 11, fontWeight: '900', letterSpacing: 2.5 },
  stakeHeaderWin: { color: theme.green, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stakeValue: { textAlign: 'center', minWidth: 130 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', gap: 5, marginTop: 6 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.panelBorder,
  },
  chipSelected: { borderColor: theme.accent, ...theme.glow('#FFB020', 8) },
  chipText: { color: theme.textDim, fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  playInner: { alignItems: 'center', paddingVertical: 11, alignSelf: 'stretch' },
  playSub: { color: 'rgba(26,17,2,0.65)', fontSize: 10, fontWeight: '900', letterSpacing: 2.5, marginTop: 1 },
  brokeHint: {
    color: theme.danger,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '700',
    fontSize: 12,
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.lg,
    marginTop: 8,
    paddingVertical: 8,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statIcon: { fontSize: 15 },
  statLabel: { color: theme.textDim, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },

  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.md,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tickerBody: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  tickerBadge: { color: theme.green, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  tickerName: { color: theme.text, fontWeight: '800', fontSize: 12, flexShrink: 1 },
  tickerAmount: { color: theme.accent, fontWeight: '900', fontSize: 12 },
  tickerTime: { color: theme.textDim, fontSize: 10, marginLeft: 'auto' },

  bottomRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bonusCard: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  bonusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.danger,
    ...theme.glow(theme.danger, 6),
  },
  bonusSub: { color: theme.textDim, fontSize: 10, marginTop: 1 },
  claimBtn: { marginLeft: 8, borderRadius: theme.radius.sm, ...theme.glow('#FFB020', 8) },
  claimBtnInner: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  claimBtnText: { color: theme.accentText, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  botCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 8,
  },
  botCardText: { color: theme.textDim, fontWeight: '800', fontSize: 11, flexShrink: 1 },
});
