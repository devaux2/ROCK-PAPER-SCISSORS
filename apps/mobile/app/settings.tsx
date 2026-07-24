import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSettingsStore } from '../src/stores/settingsStore';
import { playSound } from '../src/sound';
import { SKINS } from '../src/skins';
import { MOVES } from '@rps/shared';
import { theme } from '../src/theme';

export default function Settings() {
  const activeSkinId = useSettingsStore((s) => s.activeSkinId);
  const setSkin = useSettingsStore((s) => s.setSkin);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.soundRow}>
        <View>
          <Text style={styles.soundLabel}>Sound effects</Text>
          <Text style={styles.hint}>Clicks, reveals, wins and losses.</Text>
        </View>
        <Switch
          value={soundEnabled}
          onValueChange={(v) => {
            setSoundEnabled(v);
            if (v) playSound('win');
          }}
          trackColor={{ true: theme.accent }}
        />
      </View>

      <Text style={styles.label}>Game skin</Text>
      <Text style={styles.hint}>
        Same game, different flavor. Every skin plays identically — only the look, layout and
        animations change.
      </Text>
      {Object.values(SKINS).map((skin) => (
        <Pressable
          key={skin.id}
          onPress={() => setSkin(skin.id)}
          style={[
            styles.skinCard,
            { backgroundColor: skin.theme.panel },
            activeSkinId === skin.id && { borderColor: theme.accent },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.skinName, { color: skin.theme.text }]}>{skin.displayName}</Text>
            <Text style={[styles.skinTagline, { color: skin.theme.textDim }]}>{skin.tagline}</Text>
            <View style={styles.movePreview}>
              {MOVES.map((m) => (
                <Text key={m} style={styles.moveIcon}>
                  {skin.moves[m].icon}
                </Text>
              ))}
            </View>
          </View>
          {activeSkinId === skin.id && <Text style={styles.activeBadge}>ACTIVE</Text>}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.panel,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  soundLabel: { color: theme.text, fontWeight: '800', fontSize: 16 },
  label: {
    color: theme.textDim,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 6,
  },
  hint: { color: theme.textDim, marginBottom: 14 },
  skinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 16,
    marginVertical: 6,
  },
  skinName: { fontSize: 18, fontWeight: '900' },
  skinTagline: { marginTop: 2 },
  movePreview: { flexDirection: 'row', gap: 10, marginTop: 8 },
  moveIcon: { fontSize: 26 },
  activeBadge: { color: theme.accent, fontWeight: '900', letterSpacing: 1 },
});
