import React, { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { WAGER_TIERS, type FriendEntry, type WagerTier } from '@rps/shared';
import { useFriendsStore } from '../../src/stores/friendsStore';
import { api } from '../../src/api/client';
import { game } from '../../src/socket/socket';
import { Avatar } from '../../src/components/Avatar';
import { Button, Input, ErrorText } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function Friends() {
  const router = useRouter();
  const friends = useFriendsStore((s) => s.friends);
  const refresh = useFriendsStore((s) => s.refresh);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [challenging, setChallenging] = useState<FriendEntry | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function addFriend() {
    setError(null);
    setInfo(null);
    try {
      await api.sendFriendRequest(username.trim());
      setInfo(`Request sent to ${username.trim()}`);
      setUsername('');
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send request');
    }
  }

  async function respond(userId: number, accept: boolean) {
    setError(null);
    try {
      if (accept) await api.acceptFriend(userId);
      else await api.declineFriend(userId);
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function challenge(friend: FriendEntry, tier?: WagerTier) {
    setChallenging(null);
    setError(null);
    const res = await game.sendChallenge(friend.user.id, tier);
    if (!res.ok) setError(res.error ?? 'Challenge failed');
    else setInfo(`Challenge sent to ${friend.user.username}!`);
  }

  const incoming = friends.filter((f) => f.status === 'pending' && f.incoming);
  const outgoing = friends.filter((f) => f.status === 'pending' && !f.incoming);
  const accepted = friends.filter((f) => f.status === 'accepted');

  return (
    <View style={styles.root}>
      <View style={styles.addRow}>
        <Input
          placeholder="Add by username"
          value={username}
          onChangeText={setUsername}
          style={{ flex: 1 }}
        />
        <View style={{ marginLeft: 8 }}>
          <Button title="Add" onPress={addFriend} disabled={!username.trim()} />
        </View>
      </View>
      <ErrorText error={error} />
      {info && <Text style={styles.info}>{info}</Text>}

      <FlatList
        data={[
          ...incoming.map((f) => ({ ...f, section: 'Requests' })),
          ...accepted.map((f) => ({ ...f, section: 'Friends' })),
          ...outgoing.map((f) => ({ ...f, section: 'Sent' })),
        ]}
        keyExtractor={(item) => `${item.section}-${item.user.id}`}
        ListEmptyComponent={
          <Text style={styles.empty}>No friends yet — add someone by username to rematch them anytime.</Text>
        }
        renderItem={({ item, index }) => {
          return (
            <View>
              <SectionHeader
                items={[...incoming, ...accepted, ...outgoing]}
                index={index}
                incoming={incoming.length}
                accepted={accepted.length}
              />
              <Pressable style={styles.row} onPress={() => router.push(`/user/${item.user.id}`)}>
                <View>
                  <Avatar avatar={item.user.avatar} size={44} />
                  {item.status === 'accepted' && (
                    <View
                      style={[styles.dot, { backgroundColor: item.online ? theme.green : theme.textDim }]}
                    />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{item.user.username}</Text>
                  <Text style={styles.meta}>
                    ⚡ {item.user.elo} · {Math.round(item.user.winRate * 100)}% wins
                  </Text>
                </View>
                {item.status === 'pending' && item.incoming ? (
                  <View style={styles.rowButtons}>
                    <Pressable style={styles.accept} onPress={() => respond(item.user.id, true)}>
                      <Text style={styles.acceptText}>✓</Text>
                    </Pressable>
                    <Pressable style={styles.decline} onPress={() => respond(item.user.id, false)}>
                      <Text style={styles.declineText}>✕</Text>
                    </Pressable>
                  </View>
                ) : item.status === 'pending' ? (
                  <Text style={styles.meta}>pending…</Text>
                ) : (
                  <Pressable
                    style={[styles.challengeBtn, !item.online && { opacity: 0.4 }]}
                    disabled={!item.online}
                    onPress={() => setChallenging(item)}
                  >
                    <Text style={styles.challengeText}>⚔️ Challenge</Text>
                  </Pressable>
                )}
              </Pressable>
            </View>
          );
        }}
      />

      <Modal visible={!!challenging} transparent animationType="slide" onRequestClose={() => setChallenging(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setChallenging(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Challenge {challenging?.user.username}</Text>
            <Button title="Casual — no wager" variant="secondary" onPress={() => challenge(challenging!, undefined)} />
            {WAGER_TIERS.map((tier) => (
              <Button
                key={tier}
                title={`Wager 🪙 ${tier}`}
                variant="secondary"
                onPress={() => challenge(challenging!, tier)}
              />
            ))}
            <Button title="Cancel" variant="ghost" onPress={() => setChallenging(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SectionHeader({
  items,
  index,
  incoming,
  accepted,
}: {
  items: FriendEntry[];
  index: number;
  incoming: number;
  accepted: number;
}) {
  let label: string | null = null;
  if (index === 0 && incoming > 0) label = 'Friend requests';
  else if (index === incoming && accepted > 0) label = 'Friends';
  else if (index === incoming + accepted && items.length > incoming + accepted) label = 'Sent requests';
  if (!label) return null;
  return <Text style={styles.section}>{label}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  info: { color: theme.green, textAlign: 'center', marginVertical: 4 },
  empty: { color: theme.textDim, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
  section: {
    color: theme.textDim,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.panel,
    borderRadius: 14,
    padding: 12,
    marginVertical: 4,
  },
  dot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.panel,
  },
  name: { color: theme.text, fontWeight: '800', fontSize: 15 },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  rowButtons: { flexDirection: 'row', gap: 8 },
  accept: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  decline: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: { color: theme.text, fontWeight: '900', fontSize: 16 },
  challengeBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  challengeText: { fontWeight: '800', color: theme.accentText, fontSize: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: { color: theme.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
});
