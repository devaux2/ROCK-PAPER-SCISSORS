import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/stores/authStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { theme } from '../../src/theme';
import { Avatar } from '../../src/components/Avatar';
import { PressableScale } from '../../src/components/ui';
import { ChallengeToast } from '../../src/components/ChallengeToast';

/** Left-to-right slot order; index (home) is the raised center PLAY. */
const TAB_ORDER = ['leaderboard', 'friends', 'index', 'wallet', 'profile'] as const;

const TAB_META: Record<string, { icon: string; label: string }> = {
  leaderboard: { icon: '🏆', label: 'RANKS' },
  friends: { icon: '🤝', label: 'FRIENDS' },
  index: { icon: '✊', label: 'PLAY' },
  wallet: { icon: '💰', label: 'WALLET' },
  profile: { icon: '', label: 'PROFILE' },
};

interface BarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void };
}

/** Custom bar: dark gradient slab with a raised gold fist in the middle. */
function GoldTabBar({ state, navigation }: BarProps) {
  const avatar = useAuthStore((s) => s.user?.avatar);
  const focusedName = state.routes[state.index]?.name;
  const byName = new Map(state.routes.map((r) => [r.name, r]));

  return (
    <LinearGradient colors={theme.gradients.tabBar} style={styles.bar}>
      {TAB_ORDER.map((name) => {
        const route = byName.get(name);
        if (!route) return null;
        const focused = focusedName === name;
        const meta = TAB_META[name];

        if (name === 'index') {
          return (
            <View key={route.key} style={styles.centerSlot}>
              <PressableScale
                accessibilityLabel="Play tab"
                onPress={() => navigation.navigate(name)}
                style={[styles.centerBtnWrap, theme.glow('#FFB020', focused ? 22 : 12)]}
              >
                <LinearGradient
                  colors={theme.gradients.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.centerBtn}
                >
                  <Text style={styles.centerFist}>✊</Text>
                </LinearGradient>
              </PressableScale>
              <Text style={[styles.label, focused && styles.labelFocused]}>{meta.label}</Text>
            </View>
          );
        }

        return (
          <PressableScale
            key={route.key}
            accessibilityLabel={`${meta.label} tab`}
            onPress={() => navigation.navigate(name)}
            style={styles.slot}
          >
            {name === 'profile' ? (
              <View style={[styles.avatarIcon, focused && styles.avatarIconFocused]}>
                <Avatar avatar={avatar ?? 'avatar_01'} size={22} />
              </View>
            ) : (
              <Text style={[styles.icon, !focused && styles.iconDim]}>{meta.icon}</Text>
            )}
            <Text style={[styles.label, focused && styles.labelFocused]}>{meta.label}</Text>
            {focused && <View style={styles.activeBar} />}
          </PressableScale>
        );
      })}
    </LinearGradient>
  );
}

export default function MainLayout() {
  const token = useAuthStore((s) => s.token);
  const matchId = useMatchStore((s) => s.matchId);
  const phase = useMatchStore((s) => s.phase);
  const router = useRouter();

  // A match can start while anywhere in the app (accepted challenge,
  // rematch) — jump to the game screen.
  useEffect(() => {
    if (matchId && (phase === 'choosing' || phase === 'revealing')) {
      router.push(`/match/${matchId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  if (!token) return <Redirect href="/(auth)/login" />;

  return (
    <>
      <Tabs
        tabBar={(props) => <GoldTabBar {...(props as unknown as BarProps)} />}
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerShadowVisible: false,
          headerTintColor: theme.text,
          headerTitleStyle: { fontFamily: theme.fonts.display, fontSize: 20, letterSpacing: 1 },
          sceneStyle: { backgroundColor: theme.bg },
        }}
      >
        <Tabs.Screen name="index" options={{ headerShown: false }} />
        <Tabs.Screen name="friends" options={{ headerTitle: 'FRIENDS' }} />
        <Tabs.Screen name="leaderboard" options={{ headerTitle: 'RANKS' }} />
        <Tabs.Screen name="wallet" options={{ headerTitle: 'WALLET' }} />
        <Tabs.Screen name="profile" options={{ headerTitle: 'PROFILE' }} />
      </Tabs>
      <ChallengeToast />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: theme.panelBorder,
    paddingBottom: 10,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  slot: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  icon: { fontSize: 21 },
  iconDim: { opacity: 0.35 },
  label: {
    color: theme.textDim,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  labelFocused: { color: theme.accent },
  activeBar: {
    position: 'absolute',
    top: -8,
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.accent,
    ...theme.glow('#FFB020', 8),
  },
  centerSlot: { flex: 1.2, alignItems: 'center', gap: 3 },
  centerBtnWrap: { borderRadius: 33, marginTop: -30 },
  centerBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  centerFist: { fontSize: 30 },
  avatarIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: theme.textDim,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    opacity: 0.6,
  },
  avatarIconFocused: { borderColor: theme.accent, opacity: 1, ...theme.glow('#FFB020', 8) },
});
