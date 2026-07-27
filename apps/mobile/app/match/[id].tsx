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
import { Button, DisplayText, PressableScale, StatNumber, Tag } from '../../src/components/ui';
import { startVoice, stopVoice, toggleMic, useVoiceStore } from '../../src/voice';
import { useAuthStore } from '../../src/stores/authStore';
import { VsOverlay } from '../../src/components/VsOverlay';
import { PayoutCelebration } from '../../src/components/PayoutCelebration';
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
  const [showVs, setShowVs] = useState(false);
  const me = useAuthStore((s) => s.user);
  const voiceStatus = useVoiceStore((s) => s.status);
  const micMuted = useVoiceStore((s) => s.micMuted);
  const isBot = opponent?.isBot === true;

  // Open the voice line for the whole visit — from match start straight
  // through the end screen — and hang up when leaving.
  useEffect(() => {
    if (!matchId || isBot) return;
    void startVoice(matchId, seat === 'p1');
    return () => stopVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, isBot]);

  // Slam the VS card whenever a fresh match begins (round 1, blank board).
  useEffect(() => {
    if (matchId && roundNo === 1 && scores.p1 === 0 && scores.p2 === 0 && phase === 'choosing') {
      setShowVs(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);
  const [rematchError, setRematchError] = useState<string | null>(null);
  const [rematchSent, setRematchSent] = useState(false);
  const [showPayout, setShowPayout] = useState(false);

  // Let the VICTORY/DEFEAT stamp land first; the money show follows.
  useEffect(() => {
    if (phase !== 'ended') {
      setShowPayout(false);
      return;
    }
    const timer = setTimeout(() => setShowPayout(true), 550);
    return () => clearTimeout(timer);
  }, [phase]);

  const myScore = seat === 'p1' ? scores.p1 : scores.p2;
  const oppScore = seat === 'p1' ? scores.p2 : scores.p1;

  const onRevealDone = useCallback(() => setRevealDone(true), []);

  // Reveal sounds are owned by the skin's RevealScene timeline now.
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
              {opponent.isBot
                ? 'Practice bot'
                : `${Math.round(opponent.winRate * 100)}% win rate`}
            </Text>
            {mode === 'ranked' && wager > 0 && (
              <View style={styles.potChip}>
                <Text style={styles.potChipText}>pot 🪙 {wager * 2}</Text>
              </View>
            )}
          </View>
        </View>
        {!isBot && voiceStatus !== 'off' && voiceStatus !== 'unsupported' && (
          <PressableScale
            accessibilityLabel="Mic toggle"
            onPress={() => toggleMic()}
            style={[
              styles.micChip,
              voiceStatus === 'live' && !micMuted && styles.micChipLive,
              voiceStatus === 'failed' && styles.micChipFailed,
            ]}
          >
            <Text style={{ fontSize: 15 }}>
              {micMuted ? '🔇' : voiceStatus === 'failed' ? '🚫' : '🎙️'}
            </Text>
          </PressableScale>
        )}
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
            {mode === 'ranked' && wager > 0 && (
              <DisplayText
                size={34}
                color={theme.accent}
                style={[theme.textGlow(theme.accent, 16), { marginBottom: 4 }]}
              >
                Pot 🪙 {wager * 2}
              </DisplayText>
            )}
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
            {endResult.reason === 'no_play' && !endResult.youWon ? (
              <NoPlayScene />
            ) : (
              <skin.MatchEndScene
                won={endResult.youWon}
                reason={endResult.reason === 'no_play' ? 'forfeit' : endResult.reason}
              />
            )}
            {mode === 'ranked' && showPayout && (
              <PayoutCelebration
                won={endResult.youWon}
                wager={wager}
                coinsDelta={endResult.coinsDelta}
                newBalance={endResult.newCoins}
              />
            )}
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

      {showVs && me && (
        <VsOverlay
          me={{ username: me.username, avatar: me.avatar }}
          opponent={{ username: opponent.username, avatar: opponent.avatar }}
          accent={skin.theme.accent}
          wager={mode === 'ranked' ? wager : 0}
          onDone={() => setShowVs(false)}
        />
      )}

      {/* Taunts live on the end screen — gloat after the payout. */}
      {phase === 'ended' && (
        <EmoteWheel anchorBottom={28} onEmote={(id) => matchId && game.sendEmote(matchId, id)} />
      )}
    </View>
  );
}

/** The walk of shame: you stood there and threw nothing. */
function NoPlayScene() {
  return (
    <Animated.View entering={FadeInDown.springify().damping(11)} style={npStyles.root}>
      <DisplayText size={96} color={theme.danger} style={theme.textGlow(theme.danger, 26)}>
        ✕
      </DisplayText>
      <DisplayText size={44} color={theme.danger} style={theme.textGlow(theme.danger, 14)}>
        No play
      </DisplayText>
      <Text style={npStyles.sub}>You didn't throw</Text>
    </Animated.View>
  );
}

const npStyles = StyleSheet.create({
  root: { alignItems: 'center', gap: 2 },
  sub: { color: theme.textDim, fontWeight: '700', marginTop: 4 },
});

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
  micChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.panel,
    borderWidth: 1.5,
    borderColor: theme.panelBorder,
    marginRight: 10,
  },
  micChipLive: { borderColor: theme.green, ...theme.glow(theme.green, 8) },
  micChipFailed: { borderColor: theme.danger, opacity: 0.7 },
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
