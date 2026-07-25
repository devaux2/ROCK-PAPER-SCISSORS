import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { setStorageImpl } from '../src/storage';
import { configureApi } from '../src/api/client';
import { getBaseUrl } from '../src/api/baseUrl';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { connectSocket, disconnectSocket } from '../src/socket/socket';
import { theme } from '../src/theme';

// Secure storage on device; AsyncStorage fallback on web.
setStorageImpl(
  Platform.OS === 'web'
    ? {
        get: (k) => AsyncStorage.getItem(k),
        set: (k, v) => AsyncStorage.setItem(k, v),
        remove: (k) => AsyncStorage.removeItem(k),
      }
    : {
        get: (k) => SecureStore.getItemAsync(k),
        set: (k, v) => SecureStore.setItemAsync(k, v),
        remove: (k) => SecureStore.deleteItemAsync(k),
      }
);

configureApi({
  baseUrl: getBaseUrl(),
  getToken: () => useAuthStore.getState().token,
});

export default function RootLayout() {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [started, setStarted] = useState(false);
  const [fontsLoaded] = useFonts({ BebasNeue_400Regular });

  useEffect(() => {
    void useSettingsStore.getState().hydrate();
    void useAuthStore.getState().hydrate();
    setStarted(true);
  }, []);

  // Keep the realtime socket in lockstep with the auth token.
  useEffect(() => {
    if (token) connectSocket(getBaseUrl(), token);
    else disconnectSocket();
    return () => disconnectSocket();
  }, [token]);

  if (!started || !hydrated || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <StatusBar style="light" />
      {/* On web the game stays a phone-shaped column even on wide screens. */}
      <View style={styles.shell}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            contentStyle: { backgroundColor: theme.bg },
            headerTitleStyle: { fontFamily: theme.fonts.display, fontSize: 22 },
            animation: 'slide_from_right',
            animationDuration: 260,
          }}
        >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="matchmaking" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="match/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="edit-profile" options={{ title: 'EDIT PROFILE', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'SETTINGS', presentation: 'modal' }} />
          <Stack.Screen name="user/[id]" options={{ title: 'PLAYER' }} />
          <Stack.Screen name="history" options={{ title: 'MATCH HISTORY' }} />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1, backgroundColor: '#000' },
  shell: {
    flex: 1,
    backgroundColor: theme.bg,
    ...(Platform.OS === 'web'
      ? { width: '100%', maxWidth: 520, alignSelf: 'center' as const }
      : {}),
  },
});
