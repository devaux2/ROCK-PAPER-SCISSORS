import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Avatar } from '../../src/components/Avatar';
import { Button, Card, DisplayText, StatNumber, Tag } from '../../src/components/ui';
import { theme } from '../../src/theme';
import { rankTitle } from '../../src/rank';

export default function Profile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const logout = useAuthStore((s) => s.logout);

  useFocusEffect(
    useCallback(() => {
      void refreshMe();
    }, [refreshMe])
  );

  if (!user) return null;
  const played = user.wins + user.losses;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20 }}>
      <Animated.View entering={FadeInDown.springify()} style={styles.headline}>
        <View style={[styles.avatarRing, theme.glow(theme.accent)]}>
          <Avatar avatar={user.avatar} size={96} />
        </View>
        <DisplayText size={34} style={{ marginTop: theme.space(3) }}>
          {user.username}
        </DisplayText>
        <View style={styles.rankChip}>
          <Text style={styles.rankChipText}>🥇 {rankTitle(user.wins).toUpperCase()}</Text>
        </View>
        {user.bio ? (
          <Text style={styles.bio}>{user.bio}</Text>
        ) : (
          <Text style={[styles.bio, { fontStyle: 'italic' }]}>No bio yet — say something menacing.</Text>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).springify()}>
        <Tag>Fight record</Tag>
        <View style={styles.statGrid}>
          <StatCard label="Win rate">
            {played ? (
              <StatNumber value={Math.round(user.winRate * 100)} suffix="%" size={30} color={theme.accent} />
            ) : (
              <DisplayText size={30} color={theme.textDim}>
                —
              </DisplayText>
            )}
          </StatCard>
          <StatCard label="Record">
            <DisplayText size={30}>{`${user.wins} W · ${user.losses} L`}</DisplayText>
          </StatCard>
          <StatCard label="Coins">
            <StatNumber value={user.coins} prefix="🪙 " size={30} color={theme.accent} />
          </StatCard>
          <StatCard label="Biggest win">
            <StatNumber value={user.biggestWin} prefix="🪙 " size={30} color={theme.green} />
          </StatCard>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).springify()}>
        <Button title="Edit profile" onPress={() => router.push('/edit-profile')} />
        <Button title="Match history" variant="secondary" onPress={() => router.push('/history')} />
        <Button title="Settings & skins" variant="secondary" onPress={() => router.push('/settings')} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(180).springify()}>
        <Button title="Log out" variant="ghost" onPress={() => void logout()} />
      </Animated.View>
    </ScrollView>
  );
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card style={styles.statCard}>
      {children}
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headline: { alignItems: 'center', marginBottom: theme.space(3) },
  avatarRing: {
    borderWidth: 3,
    borderColor: theme.accent,
    borderRadius: theme.radius.pill,
    padding: 4,
  },
  bio: { color: theme.textDim, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
  rankChip: {
    backgroundColor: theme.bgRaised,
    borderWidth: 1,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  rankChipText: { color: theme.accent, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(3),
    marginTop: theme.space(3),
    marginBottom: theme.space(2),
  },
  statCard: {
    flexBasis: '45%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: theme.bgRaised,
    marginVertical: 0,
    paddingVertical: theme.space(4),
  },
  statLabel: {
    color: theme.textDim,
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
