import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFriendsStore } from '../stores/friendsStore';
import { game } from '../socket/socket';
import { Avatar } from './Avatar';
import { Button } from './ui';
import { theme } from '../theme';

/** Slide-over shown anywhere in the main app when a friend challenges you. */
export function ChallengeToast() {
  const challenge = useFriendsStore((s) => s.incomingChallenge);
  const setChallenge = useFriendsStore((s) => s.setIncomingChallenge);
  const [error, setError] = useState<string | null>(null);

  if (!challenge) return null;

  async function accept() {
    const res = await game.acceptChallenge(challenge!.challengeId);
    if (!res.ok) setError(res.error ?? 'Could not accept');
    else setChallenge(null);
  }

  function decline() {
    game.declineChallenge(challenge!.challengeId);
    setChallenge(null);
    setError(null);
  }

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <Avatar avatar={challenge.from.avatar} size={40} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.title}>{challenge.from.username} challenges you!</Text>
          <Text style={styles.sub}>
            {challenge.wager > 0 ? `Wager: ${challenge.wager} coins` : 'Casual — no wager'}
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>
      <View style={styles.buttons}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <Button title="Accept" onPress={accept} />
        </View>
        <View style={{ flex: 1, marginLeft: 6 }}>
          <Button title="Decline" variant="secondary" onPress={decline} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: theme.text, fontWeight: '800', fontSize: 15 },
  sub: { color: theme.textDim, marginTop: 2 },
  error: { color: theme.red, marginTop: 2 },
  buttons: { flexDirection: 'row', marginTop: 10 },
});
