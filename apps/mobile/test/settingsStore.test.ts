import { describe, it, expect } from 'vitest';
import { useSettingsStore } from '../src/stores/settingsStore';
import { storage } from '../src/storage';

describe('settingsStore', () => {
  it('persists the chosen skin and hydrates it back', async () => {
    useSettingsStore.getState().setSkin('fighter');
    expect(useSettingsStore.getState().activeSkinId).toBe('fighter');
    // Simulate an app restart: state resets, hydrate restores from storage.
    useSettingsStore.setState({ activeSkinId: 'classic' });
    await useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().activeSkinId).toBe('fighter');
    expect(await storage.get('rps.skin')).toBe('fighter');
  });
});
