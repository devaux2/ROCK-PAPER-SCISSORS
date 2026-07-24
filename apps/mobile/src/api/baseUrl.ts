import Constants from 'expo-constants';

/**
 * Server base URL. Override with EXPO_PUBLIC_API_URL; otherwise derive the
 * host from Metro's hostUri so Expo Go on a phone reaches the dev machine.
 */
export function getBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3001`;
}
