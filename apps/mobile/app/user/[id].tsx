import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { PublicProfile } from '@rps/shared';
import { api } from '../../src/api/client';
import { Avatar } from '../../src/components/Avatar';
import { Card, ErrorText } from '../../src/components/ui';
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
      <View style={styles.headline}>
        <Avatar avatar={profile.avatar} size={96} />
        <Text style={styles.name}>{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      </View>
      <Card>
        <View style={styles.statRow}>
          <Stat label="Win rate" value={played ? `${Math.round(profile.winRate * 100)}%` : '—'} />
          <Stat label="Record" value={`${profile.wins}W · ${profile.losses}L`} />
          <Stat label="Elo" value={String(profile.elo)} />
        </View>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headline: { alignItems: 'center', marginBottom: 12 },
  name: { color: theme.text, fontSize: 26, fontWeight: '900', marginTop: 10 },
  bio: { color: theme.textDim, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: theme.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: theme.textDim, marginTop: 2, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
});
