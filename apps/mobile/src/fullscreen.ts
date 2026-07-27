import { Platform } from 'react-native';

/**
 * Push the web app into true fullscreen. Must be called from a user
 * gesture (we hook the login/signup/play taps). Silent no-op on native,
 * on iOS Safari (which only fullscreens video), or when already there.
 */
export function requestAppFullscreen(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.fullscreenElement) return;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    const request = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    const result = request?.() as Promise<void> | undefined;
    void result?.catch?.(() => {});
  } catch {
    // Unsupported browser — the PWA install path covers iOS.
  }
}
