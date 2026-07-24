import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Avatar } from '../../src/components/Avatar';
import { Button, Card } from '../../src/components/ui';
import { theme } from '../../src/theme';

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
      <View style={styles.headline}>
        <Avatar avatar={user.avatar} size={96} />
        <Text style={styles.name}>{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : (
          <Text style={[styles.bio, { fontStyle: 'italic' }]}>No bio yet — say something menacing.</Text>
        )}
      </View>

      <Card>
        <View style={styles.statRow}>
          <Stat label="Win rate" value={played ? `${Math.round(user.winRate * 100)}%` : '—'} />
          <Stat label="Record" value={`${user.wins}W · ${user.losses}L`} />
        </View>
        <View style={[styles.statRow, { marginTop: 14 }]}>
          <Stat label="Elo" value={String(user.elo)} />
          <Stat label="Coins" value={`🪙 ${user.coins}`} />
        </View>
      </Card>

      <Button title="Edit profile" onPress={() => router.push('/edit-profile')} />
      <Button title="Match history" variant="secondary" onPress={() => router.push('/history')} />
      <Button title="Settings & skins" variant="secondary" onPress={() => router.push('/settings')} />
      <Button title="Log out" variant="ghost" onPress={() => void logout()} />
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
  statValue: { color: theme.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: theme.textDim, marginTop: 2, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
});
