import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Server base URL, in order of preference:
 * 1. EXPO_PUBLIC_API_URL env override (baked in at build time).
 * 2. Production web build served by the game server itself -> same origin.
 * 3. Dev: derive the host from Metro's hostUri (Expo Go on a phone reaches
 *    the dev machine; `expo start --web` reaches localhost) on port 3001.
 */
export function getBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const hostUri = Constants.expoConfig?.hostUri;
  if (Platform.OS === 'web' && !hostUri && typeof window !== 'undefined') {
    return window.location.origin;
  }
  const host = hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3001`;
}
