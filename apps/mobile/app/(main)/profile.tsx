import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter } from 'expo-router';
import type { SocialPlatform } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { api } from '../../src/api/client';
import { getBaseUrl } from '../../src/api/baseUrl';
import { Avatar } from '../../src/components/Avatar';
import { Button, Card, DisplayText, Input, PressableScale, StatNumber, Tag } from '../../src/components/ui';
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

      <Animated.View entering={FadeInDown.delay(90).springify()}>
        <ShareToEarn wins={user.wins} biggestWin={user.biggestWin} onClaimed={refreshMe} />
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

/**
 * Share-to-earn: open a prefilled post composer on X/Facebook, paste the
 * published post's link back here, collect +250 coins (per platform, per
 * day). The platform is detected from the pasted link.
 */
function ShareToEarn({
  wins,
  biggestWin,
  onClaimed,
}: {
  wins: number;
  biggestWin: number;
  onClaimed: () => Promise<void> | void;
}) {
  const [link, setLink] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shareText = `I'm ${wins}W deep in RPS — real-stakes rock paper scissors${
    biggestWin > 0 ? `, biggest pot 🪙${biggestWin}` : ''
  }. Come lose your coins: ${getBaseUrl()}`;

  function openComposer(platform: SocialPlatform) {
    const url =
      platform === 'x'
        ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
        : `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getBaseUrl())}&quote=${encodeURIComponent(shareText)}`;
    void Linking.openURL(url).catch(() => {});
  }

  function detectPlatform(raw: string): SocialPlatform | null {
    try {
      const host = new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, '');
      if (['x.com', 'twitter.com', 'mobile.twitter.com'].includes(host)) return 'x';
      if (['facebook.com', 'm.facebook.com', 'fb.com'].includes(host)) return 'facebook';
    } catch {
      // fallthrough
    }
    return null;
  }

  async function claim() {
    setErr(null);
    setMsg(null);
    const platform = detectPlatform(link);
    if (!platform) {
      setErr('Paste the link to your post on X or Facebook');
      return;
    }
    setBusy(true);
    try {
      const res = await api.socialBonus(platform, link.trim());
      setMsg(`+🪙 ${res.granted} added — new balance 🪙 ${res.coins}`);
      setLink('');
      await onClaimed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Tag color={theme.green}>Boost your bankroll</Tag>
      <Card style={shareStyles.card}>
        <Text style={shareStyles.blurb}>
          Post about RPS, paste your post's link below, and collect{' '}
          <Text style={{ color: theme.accent, fontWeight: '900' }}>+🪙 250</Text> — once a day per
          platform.
        </Text>
        <View style={shareStyles.btnRow}>
          <PressableScale style={shareStyles.shareBtn} onPress={() => openComposer('x')}>
            <Text style={shareStyles.shareBtnIcon}>𝕏</Text>
            <Text style={shareStyles.shareBtnText}>Post on X</Text>
          </PressableScale>
          <PressableScale style={shareStyles.shareBtn} onPress={() => openComposer('facebook')}>
            <Text style={[shareStyles.shareBtnIcon, { color: '#4D8DFF' }]}>f</Text>
            <Text style={shareStyles.shareBtnText}>Post on Facebook</Text>
          </PressableScale>
        </View>
        <View style={shareStyles.claimRow}>
          <Input
            placeholder="Paste your post link"
            value={link}
            onChangeText={setLink}
            style={{ flex: 1 }}
          />
          <View style={{ marginLeft: 8 }}>
            <Button title="Claim" onPress={claim} disabled={!link.trim() || busy} loading={busy} />
          </View>
        </View>
        {msg && <Text style={shareStyles.ok}>{msg}</Text>}
        {err && <Text style={shareStyles.err}>{err}</Text>}
      </Card>
    </>
  );
}

const shareStyles = StyleSheet.create({
  card: { marginBottom: theme.space(3) },
  blurb: { color: theme.textDim, fontWeight: '600', lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.bgRaised,
    borderWidth: 1.5,
    borderColor: theme.goldBorder,
    borderRadius: theme.radius.md,
    paddingVertical: 11,
  },
  shareBtnIcon: { color: theme.text, fontSize: 17, fontWeight: '900' },
  shareBtnText: { color: theme.text, fontWeight: '800', fontSize: 12 },
  claimRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  ok: { color: theme.green, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  err: { color: theme.danger, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});

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
