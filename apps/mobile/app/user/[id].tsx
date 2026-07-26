import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import type { PublicProfile } from '@rps/shared';
import { api } from '../../src/api/client';
import { Avatar } from '../../src/components/Avatar';
import { Card, DisplayText, ErrorText, StatNumber, Tag } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .user(Number(id))
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load profile'));
  }, [id]);

  if (error) return <ErrorText error={error} />;
  if (!profile) return null;
  const played = profile.wins + profile.losses;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20 }}>
      <Animated.View entering={FadeInDown.springify()} style={styles.headline}>
        <View style={[styles.avatarRing, theme.glow(theme.accent)]}>
          <Avatar avatar={profile.avatar} size={96} />
        </View>
        <DisplayText size={34} style={{ marginTop: theme.space(3) }}>
          {profile.username}
        </DisplayText>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).springify()}>
        <Tag>Fight record</Tag>
        <View style={styles.statGrid}>
          <StatCard label="Win rate">
            {played ? (
              <StatNumber value={Math.round(profile.winRate * 100)} suffix="%" size={28} color={theme.accent} />
            ) : (
              <DisplayText size={28} color={theme.textDim}>
                —
              </DisplayText>
            )}
          </StatCard>
          <StatCard label="Record">
            <DisplayText size={28}>{`${profile.wins}W · ${profile.losses}L`}</DisplayText>
          </StatCard>
        </View>
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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space(3),
    marginTop: theme.space(3),
  },
  statCard: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: theme.bgRaised,
    marginVertical: 0,
    paddingVertical: theme.space(4),
    paddingHorizontal: theme.space(2),
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
