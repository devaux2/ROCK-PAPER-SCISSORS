import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { WAGER_TIERS, type FriendEntry, type WagerTier } from '@rps/shared';
import { useFriendsStore } from '../../src/stores/friendsStore';
import { api } from '../../src/api/client';
import { game } from '../../src/socket/socket';
import { Avatar } from '../../src/components/Avatar';
import { Button, Input, ErrorText, Card, Tag, DisplayText, PressableScale } from '../../src/components/ui';
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
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>🤝</Text>
            <DisplayText size={30} color={theme.text}>No rivals yet</DisplayText>
            <Text style={styles.empty}>No friends yet — add someone by username to rematch them anytime.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          return (
            <Animated.View entering={index < 8 ? FadeInDown.delay(index * 60).springify() : undefined}>
              <SectionHeader
                items={[...incoming, ...accepted, ...outgoing]}
                index={index}
                incoming={incoming.length}
                accepted={accepted.length}
              />
              <PressableScale onPress={() => router.push(`/user/${item.user.id}`)}>
                <Card style={styles.rowCard}>
                  <View>
                    <Avatar avatar={item.user.avatar} size={44} />
                    {item.status === 'accepted' && <OnlineDot online={item.online} />}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{item.user.username}</Text>
                    <Text style={styles.meta}>
                      {item.user.wins} W · {item.user.losses} L · {Math.round(item.user.winRate * 100)}% wins
                    </Text>
                  </View>
                  {item.status === 'pending' && item.incoming ? (
                    <View style={styles.rowButtons}>
                      <PressableScale
                        style={[styles.circleBtn, styles.accept]}
                        onPress={() => respond(item.user.id, true)}
                      >
                        <Text style={styles.acceptText}>✓</Text>
                      </PressableScale>
                      <PressableScale
                        style={[styles.circleBtn, styles.decline]}
                        onPress={() => respond(item.user.id, false)}
                      >
                        <Text style={styles.declineText}>✕</Text>
                      </PressableScale>
                    </View>
                  ) : item.status === 'pending' ? (
                    <Text style={styles.meta}>pending…</Text>
                  ) : (
                    <PressableScale
                      style={[styles.challengeWrap, !item.online && { opacity: 0.4 }]}
                      disabled={!item.online}
                      onPress={() => setChallenging(item)}
                    >
                      <LinearGradient
                        colors={theme.gradients.cta}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.challengeBtn}
                      >
                        <Text style={styles.challengeText}>⚔️ Challenge</Text>
                      </LinearGradient>
                    </PressableScale>
                  )}
                </Card>
              </PressableScale>
            </Animated.View>
          );
        }}
      />

      <Modal visible={!!challenging} transparent animationType="fade" onRequestClose={() => setChallenging(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setChallenging(null)}>
          <Animated.View entering={SlideInDown.springify().damping(16)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              <DisplayText size={26} style={styles.sheetTitle}>
                Challenge {challenging?.user.username}
              </DisplayText>
              <Button
                title="Casual — no wager"
                variant="secondary"
                onPress={() => challenge(challenging!, undefined)}
              />
              <View style={styles.tierRow}>
                {WAGER_TIERS.map((tier) => (
                  <PressableScale
                    key={tier}
                    style={styles.tierChip}
                    onPress={() => challenge(challenging!, tier)}
                  >
                    <DisplayText size={20} color={theme.accent}>
                      🪙 {tier}
                    </DisplayText>
                  </PressableScale>
                ))}
              </View>
              <Button title="Cancel" variant="ghost" onPress={() => setChallenging(null)} />
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Status dot; when online, a soft green glow slowly pulses. */
function OnlineDot({ online }: { online: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (online) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900 }),
          withTiming(0, { duration: 900 })
        ),
        -1
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [online, pulse]);
  const animated = useAnimatedStyle(() => ({
    shadowOpacity: 0.25 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: online ? theme.green : theme.textDim },
        online ? theme.glow(theme.green, 8) : null,
        online ? animated : null,
      ]}
    />
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
  let color = theme.accent;
  if (index === 0 && incoming > 0) {
    label = 'Friend requests';
  } else if (index === incoming && accepted > 0) {
    label = 'Friends';
    color = theme.green;
  } else if (index === incoming + accepted && items.length > incoming + accepted) {
    label = 'Sent requests';
    color = theme.textDim;
  }
  if (!label) return null;
  return (
    <View style={styles.section}>
      <Tag color={color}>{label}</Tag>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  addRow: { flexDirection: 'row', alignItems: 'center' },
  info: { color: theme.green, textAlign: 'center', marginVertical: 4, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 8, paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 54 },
  empty: { color: theme.textDim, textAlign: 'center' },
  section: { marginTop: 14, marginBottom: 2 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginVertical: 4,
    borderRadius: theme.radius.md,
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
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accept: { backgroundColor: theme.green, ...theme.glow(theme.green, 10) },
  acceptText: { color: theme.accentText, fontWeight: '900', fontSize: 16 },
  decline: {
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.danger,
  },
  declineText: { color: theme.danger, fontWeight: '900', fontSize: 16 },
  challengeWrap: { borderRadius: theme.radius.sm, ...theme.glow('#FFB020', 10) },
  challengeBtn: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  challengeText: { fontWeight: '800', color: theme.accentText, fontSize: 12 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: { textAlign: 'center', marginBottom: 12 },
  tierRow: { flexDirection: 'row', gap: 8, marginVertical: 6 },
  tierChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.accent,
    backgroundColor: theme.bgRaised,
  },
});
