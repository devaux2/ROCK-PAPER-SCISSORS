import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { MOVES, ROUNDS_TO_WIN, type Move } from '@rps/shared';
import { useMatchStore } from '../../src/stores/matchStore';
import { useSkin } from '../../src/skins';
import { game } from '../../src/socket/socket';
import { Avatar } from '../../src/components/Avatar';
import { Countdown } from '../../src/components/Countdown';
import { EmoteWheel, EmoteBubble } from '../../src/components/EmoteWheel';
import { Button, DisplayText, StatNumber, Tag } from '../../src/components/ui';
import { theme } from '../../src/theme';
import { playSound } from '../../src/sound';

/** One score pip — springs in with a pop + glow when it fills. */
function Pip({ filled, accent }: { filled: boolean; accent: string }) {
  const scale = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    scale.value = filled
      ? withSpring(1, theme.springs.pop)
      : withTiming(0, { duration: 140 });
  }, [filled, scale]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));
  return (
    <View style={styles.pipSlot}>
      <Animated.View
        style={[styles.pipFill, { backgroundColor: accent }, theme.glow(accent, 8), animated]}
      />
    </View>
  );
}

function Pips({ score, accent }: { score: number; accent: string }) {
  return (
    <View style={styles.pips}>
      {Array.from({ length: ROUNDS_TO_WIN }, (_, i) => (
        <Pip key={i} filled={i < score} accent={accent} />
      ))}
    </View>
  );
}

/** Text that softly pulses its opacity (waiting states, rematch offers). */
function PulsingText({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color: string;
  style?: object;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.55, { duration: 750 }), -1, true);
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.Text style={[styles.prompt, { color }, animated, style]}>{children}</Animated.Text>
  );
}

export default function MatchScreen() {
  const router = useRouter();
  const skin = useSkin();
  const phase = useMatchStore((s) => s.phase);
  const matchId = useMatchStore((s) => s.matchId);
  const mode = useMatchStore((s) => s.mode);
  const wager = useMatchStore((s) => s.wager);
  const opponent = useMatchStore((s) => s.opponent);
  const seat = useMatchStore((s) => s.seat);
  const roundNo = useMatchStore((s) => s.roundNo);
  const deadline = useMatchStore((s) => s.deadline);
  const scores = useMatchStore((s) => s.scores);
  const myMove = useMatchStore((s) => s.myMove);
  const lastResult = useMatchStore((s) => s.lastResult);
  const endResult = useMatchStore((s) => s.endResult);
  const incomingEmote = useMatchStore((s) => s.incomingEmote);
  const rematchOffered = useMatchStore((s) => s.rematchOffered);
  const setMyMove = useMatchStore((s) => s.setMyMove);
  const reset = useMatchStore((s) => s.reset);
  const [revealDone, setRevealDone] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const [rematchSent, setRematchSent] = useState(false);

  const myScore = seat === 'p1' ? scores.p1 : scores.p2;
  const oppScore = seat === 'p1' ? scores.p2 : scores.p1;

  const onRevealDone = useCallback(() => setRevealDone(true), []);

  useEffect(() => {
    if (phase === 'revealing') playSound('reveal');
  }, [phase]);

  useEffect(() => {
    if (endResult) playSound(endResult.youWon ? 'win' : 'lose');
  }, [endResult]);

  async function choose(move: Move) {
    if (!matchId || myMove) return;
    playSound('click');
    setMyMove(move);
    setRevealDone(false);
    await game.submitMove(matchId, move);
  }

  async function requestRematch() {
    if (!matchId) return;
    setRematchError(null);
    const res = await game.requestRematch(matchId);
    if (!res.ok) setRematchError(res.error ?? 'Rematch unavailable');
    else setRematchSent(true);
  }

  function leave() {
    reset();
    router.dismissTo('/(main)');
  }

  function forfeit() {
    if (matchId) game.forfeit(matchId);
  }

  if (!opponent) {
    // Deep link or stale state — nothing to show.
    return (
      <View style={[styles.root, { backgroundColor: skin.theme.bg, justifyContent: 'center' }]}>
        <Text style={{ color: skin.theme.textDim, textAlign: 'center' }}>No active match</Text>
        <View style={{ padding: 24 }}>
          <Button title="Back to menu" onPress={leave} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: skin.theme.bg }]}>
      {/* Opponent header */}
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View style={styles.avatarRing}>
          <Avatar avatar={opponent.avatar} size={44} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <DisplayText size={20}>{opponent.username}</DisplayText>
          <View style={styles.subRow}>
            <Text style={{ color: theme.textDim, fontSize: 12, fontWeight: '600' }}>
              {opponent.isBot ? 'Practice bot' : `⚡ ${opponent.elo}`}
            </Text>
            {mode === 'ranked' && wager > 0 && (
              <View style={styles.potChip}>
                <Text style={styles.potChipText}>pot 🪙 {wager * 2}</Text>
              </View>
            )}
          </View>
        </View>
        <Pips score={oppScore} accent={skin.theme.accent} />
        {incomingEmote && (
          <EmoteBubble emoteId={incomingEmote.emoteId} seq={incomingEmote.seq} />
        )}
      </Animated.View>

      {/* Arena */}
      <View style={styles.arena}>
        {phase === 'choosing' && (
          <>
            <View style={[styles.arenaGlowRing, { borderColor: skin.theme.accent }]} />
            <View style={styles.roundTag}>
              <Tag>ROUND {roundNo}</Tag>
            </View>
            {deadline && <Countdown deadline={deadline} />}
            {myMove ? (
              <PulsingText color={skin.theme.text}>
                Locked in. Waiting for opponent…
              </PulsingText>
            ) : (
              <Text style={[styles.prompt, { color: skin.theme.text }]}>
                {`Pick your ${skin.id === 'fighter' ? 'strike' : 'throw'}!`}
              </Text>
            )}
            <PulsingText color={skin.theme.textDim}>
              {opponent.isBot ? 'RoboThrow is computing…' : `${opponent.username} is choosing…`}
            </PulsingText>
          </>
        )}
        {phase === 'revealing' && lastResult && !revealDone && (
          <skin.RevealScene
            myMove={lastResult.yourMove}
            oppMove={lastResult.oppMove}
            outcome={lastResult.outcome}
            onDone={onRevealDone}
          />
        )}
        {phase === 'revealing' && revealDone && (
          <DisplayText size={30} color={skin.theme.accent} style={theme.textGlow(skin.theme.accent, 12)}>
            Next round…
          </DisplayText>
        )}
        {phase === 'ended' && endResult && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.endWrap}>
            <skin.MatchEndScene won={endResult.youWon} reason={endResult.reason} />
            <View style={styles.endStats}>
              {mode === 'ranked' && (
                <>
                  <StatNumber
                    value={endResult.coinsDelta}
                    size={26}
                    color={endResult.coinsDelta >= 0 ? theme.green : theme.danger}
                    prefix={endResult.coinsDelta >= 0 ? '+' : ''}
                    suffix=" 🪙"
                  />
                  <StatNumber
                    value={endResult.eloDelta}
                    size={26}
                    color={endResult.eloDelta >= 0 ? theme.green : theme.danger}
                    prefix={endResult.eloDelta >= 0 ? '+' : ''}
                    suffix=" ELO"
                  />
                </>
              )}
            </View>
            {rematchOffered && !rematchSent && (
              <PulsingText color={theme.accent} style={styles.rematchOffer}>
                {opponent.username} wants a rematch!
              </PulsingText>
            )}
            {rematchSent && (
              <Text style={[styles.rematchOffer, { color: skin.theme.textDim }]}>
                Rematch requested — waiting for {opponent.username}…
              </Text>
            )}
            {rematchError && <Text style={styles.rematchError}>{rematchError}</Text>}
            <Animated.View
              entering={FadeInDown.delay(120).springify()}
              style={styles.endButtons}
            >
              <Button title="Rematch" onPress={requestRematch} disabled={rematchSent} />
              <Button title="Back to menu" variant="secondary" onPress={leave} />
            </Animated.View>
          </Animated.View>
        )}
      </View>

      {/* My move buttons */}
      {(phase === 'choosing' || phase === 'revealing') && (
        <View style={styles.footer}>
          <View style={styles.moveRow}>
            {MOVES.map((move) => (
              <skin.MoveButton
                key={move}
                move={move}
                disabled={phase !== 'choosing' || myMove !== null}
                selected={myMove === move}
                onPress={() => choose(move)}
              />
            ))}
          </View>
          <View style={styles.footerMeta}>
            <Pips score={myScore} accent={skin.theme.accent} />
            <Text
              style={{ color: skin.theme.textDim, fontSize: 12 }}
              onPress={forfeit}
              suppressHighlighting
            >
              Forfeit
            </Text>
          </View>
        </View>
      )}

      {/* Practice mode included — taunting the bot is free therapy. */}
      {(phase === 'choosing' || phase === 'revealing') && (
        <EmoteWheel onEmote={(id) => matchId && game.sendEmote(matchId, id)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.bgRaised,
    borderBottomWidth: 1,
    borderBottomColor: theme.panelBorder,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: theme.accent,
    borderRadius: theme.radius.pill,
    padding: 2,
    ...theme.glow(theme.accent, 10),
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  potChip: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
    backgroundColor: theme.panel,
  },
  potChipText: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pips: { flexDirection: 'row', gap: 5 },
  pipSlot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'visible',
  },
  pipFill: { width: 12, height: 12, borderRadius: 6 },
  arenaGlowRing: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1.5,
    opacity: 0.16,
  },
  arena: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  roundTag: { alignItems: 'center', marginBottom: 10 },
  prompt: { fontSize: 17, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  footer: { paddingHorizontal: 12, paddingBottom: 30 },
  moveRow: { flexDirection: 'row' },
  footerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 14,
  },
  endWrap: { alignItems: 'center', width: '100%' },
  endStats: { flexDirection: 'row', gap: 20, marginTop: 14 },
  rematchOffer: { marginTop: 14, fontWeight: '800', fontSize: 15 },
  rematchError: { marginTop: 8, color: theme.danger, fontWeight: '700' },
  endButtons: { width: '100%', marginTop: 18, paddingHorizontal: 24 },
});
