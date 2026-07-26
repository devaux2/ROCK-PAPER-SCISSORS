import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useMatchStore } from '../../src/stores/matchStore';
import { theme } from '../../src/theme';
import { ChallengeToast } from '../../src/components/ChallengeToast';

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 22,
        opacity: focused ? 1 : 0.3,
        color: focused ? theme.accent : theme.textDim,
        transform: [{ scale: focused ? 1 : 0.9 }],
      }}
    >
      {icon}
    </Text>
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
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontFamily: theme.fonts.display, fontSize: 22, letterSpacing: 1.5 },
          tabBarStyle: {
            backgroundColor: theme.bgRaised,
            borderTopColor: theme.panelBorder,
            borderTopWidth: 1,
            height: 64,
            paddingTop: 6,
            paddingBottom: 8,
          },
          tabBarLabelStyle: { fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textDim,
          sceneStyle: { backgroundColor: theme.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Play',
            headerShown: false,
            tabBarIcon: ({ focused }) => <TabIcon icon="⚔️" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: 'Friends',
            headerTitle: 'FRIENDS',
            tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            title: 'Leaderboard',
            headerTitle: 'LEADERBOARD',
            tabBarIcon: ({ focused }) => <TabIcon icon="🏆" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            headerTitle: 'PROFILE',
            tabBarIcon: ({ focused }) => <TabIcon icon="●" focused={focused} />,
          }}
        />
      </Tabs>
      <ChallengeToast />
    </>
  );
}
