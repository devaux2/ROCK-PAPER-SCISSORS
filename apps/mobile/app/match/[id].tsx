import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MOVES, ROUNDS_TO_WIN, type Move } from '@rps/shared';
import { useMatchStore } from '../../src/stores/matchStore';
import { useSkin } from '../../src/skins';
import { game } from '../../src/socket/socket';
import { Avatar } from '../../src/components/Avatar';
import { Countdown } from '../../src/components/Countdown';
import { EmoteWheel, EmoteBubble } from '../../src/components/EmoteWheel';
import { Button } from '../../src/components/ui';
import { playSound } from '../../src/sound';

function Pips({ score, accent }: { score: number; accent: string }) {
  return (
    <View style={styles.pips}>
      {Array.from({ length: ROUNDS_TO_WIN }, (_, i) => (
        <View
          key={i}
          style={[styles.pip, { backgroundColor: i < score ? accent : 'rgba(255,255,255,0.15)' }]}
        />
      ))}
    </View>
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
      <View style={[styles.header, { backgroundColor: skin.theme.panel }]}>
        <Avatar avatar={opponent.avatar} size={44} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.oppName, { color: skin.theme.text }]}>{opponent.username}</Text>
          <Text style={{ color: skin.theme.textDim, fontSize: 12 }}>
            {opponent.isBot ? 'Practice bot' : `⚡ ${opponent.elo}`}
            {mode === 'ranked' && wager > 0 ? `  ·  pot 🪙 ${wager * 2}` : ''}
          </Text>
        </View>
        <Pips score={oppScore} accent={skin.theme.accent} />
        {incomingEmote && (
          <EmoteBubble emoteId={incomingEmote.emoteId} seq={incomingEmote.seq} />
        )}
      </View>

      {/* Arena */}
      <View style={styles.arena}>
        {phase === 'choosing' && (
          <>
            <Text style={[styles.roundLabel, { color: skin.theme.textDim }]}>
              ROUND {roundNo}
            </Text>
            {deadline && <Countdown deadline={deadline} />}
            <Text style={[styles.prompt, { color: skin.theme.text }]}>
              {myMove
                ? 'Locked in. Waiting for opponent…'
                : `Pick your ${skin.id === 'fighter' ? 'strike' : 'throw'}!`}
            </Text>
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
          <Text style={[styles.prompt, { color: skin.theme.textDim }]}>Next round…</Text>
        )}
        {phase === 'ended' && endResult && (
          <View style={styles.endWrap}>
            <skin.MatchEndScene won={endResult.youWon} reason={endResult.reason} />
            <View style={styles.endStats}>
              {mode === 'ranked' && (
                <>
                  <Text style={[styles.endStat, { color: endResult.coinsDelta >= 0 ? '#3FB950' : '#F85149' }]}>
                    {endResult.coinsDelta >= 0 ? '+' : ''}
                    {endResult.coinsDelta} 🪙
                  </Text>
                  <Text style={[styles.endStat, { color: endResult.eloDelta >= 0 ? '#3FB950' : '#F85149' }]}>
                    {endResult.eloDelta >= 0 ? '+' : ''}
                    {endResult.eloDelta} ELO
                  </Text>
                </>
              )}
            </View>
            {rematchOffered && !rematchSent && (
              <Text style={[styles.rematchOffer, { color: skin.theme.accent }]}>
                {opponent.username} wants a rematch!
              </Text>
            )}
            {rematchSent && (
              <Text style={[styles.rematchOffer, { color: skin.theme.textDim }]}>
                Rematch requested — waiting for {opponent.username}…
              </Text>
            )}
            {rematchError && <Text style={styles.rematchError}>{rematchError}</Text>}
            <View style={styles.endButtons}>
              <Button title="Rematch" onPress={requestRematch} disabled={rematchSent} />
              <Button title="Back to menu" variant="secondary" onPress={leave} />
            </View>
          </View>
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

      {(phase === 'choosing' || phase === 'revealing') && !opponent.isBot && (
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
  },
  oppName: { fontWeight: '900', fontSize: 16 },
  pips: { flexDirection: 'row', gap: 5 },
  pip: { width: 12, height: 12, borderRadius: 6 },
  arena: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  roundLabel: { fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
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
  endStat: { fontSize: 20, fontWeight: '900' },
  rematchOffer: { marginTop: 14, fontWeight: '800' },
  rematchError: { marginTop: 8, color: '#F85149' },
  endButtons: { width: '100%', marginTop: 18, paddingHorizontal: 24 },
});
