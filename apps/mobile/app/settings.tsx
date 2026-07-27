import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettingsStore } from '../src/stores/settingsStore';
import { playSound, syncMusic } from '../src/sound';
import { applyVoiceVolume, stopVoice } from '../src/voice';
import { SKINS } from '../src/skins';
import { MOVES } from '@rps/shared';
import { Card, DisplayText, PressableScale, Tag } from '../src/components/ui';
import { theme } from '../src/theme';

export default function Settings() {
  const activeSkinId = useSettingsStore((s) => s.activeSkinId);
  const setSkin = useSettingsStore((s) => s.setSkin);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const setMusicEnabled = useSettingsStore((s) => s.setMusicEnabled);
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const voiceVolume = useSettingsStore((s) => s.voiceVolume);
  const setVoiceVolume = useSettingsStore((s) => s.setVoiceVolume);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20 }}>
      <Animated.View entering={FadeInDown.springify()}>
        <Card style={styles.soundRow}>
          <View>
            <Text style={styles.soundLabel}>Music</Text>
            <Text style={styles.hint}>The arena loop.</Text>
          </View>
          <Switch
            value={musicEnabled}
            onValueChange={(v) => {
              setMusicEnabled(v);
              syncMusic();
            }}
            trackColor={{ true: theme.accent, false: theme.panelBorder }}
            thumbColor={theme.text}
          />
        </Card>
        <Card style={styles.soundRow}>
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
            trackColor={{ true: theme.accent, false: theme.panelBorder }}
            thumbColor={theme.text}
          />
        </Card>
        <Card style={styles.soundRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.soundLabel}>Voice chat</Text>
            <Text style={styles.hint}>Talk to your opponent during matches.</Text>
            {voiceEnabled && (
              <View style={styles.volRow}>
                {([
                  ['Quiet', 0.35],
                  ['Normal', 0.7],
                  ['Loud', 1],
                ] as const).map(([label, vol]) => {
                  const selected = Math.abs(voiceVolume - vol) < 0.01;
                  return (
                    <PressableScale
                      key={label}
                      onPress={() => {
                        setVoiceVolume(vol);
                        applyVoiceVolume(vol);
                      }}
                      style={[styles.volChip, selected && styles.volChipSelected]}
                    >
                      <Text style={[styles.volChipText, selected && { color: theme.accent }]}>
                        {label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </View>
          <Switch
            value={voiceEnabled}
            onValueChange={(v) => {
              setVoiceEnabled(v);
              if (!v) stopVoice();
            }}
            trackColor={{ true: theme.accent, false: theme.panelBorder }}
            thumbColor={theme.text}
          />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).springify()}>
        <Text style={styles.label}>Game skin</Text>
        <Text style={styles.hint}>
          Same game, different flavor. Every skin plays identically — only the look, layout and
          animations change.
        </Text>
      </Animated.View>
      {Object.values(SKINS).map((skin, i) => {
        const active = activeSkinId === skin.id;
        return (
          <Animated.View key={skin.id} entering={FadeInDown.delay(120 + i * 60).springify()}>
            <PressableScale
              onPress={() => setSkin(skin.id)}
              style={[
                styles.skinCard,
                { borderColor: active ? theme.accent : theme.panelBorder },
                active && theme.glow(theme.accent, 14),
              ]}
            >
              <LinearGradient
                colors={[skin.theme.bg, skin.theme.panel]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.skinPoster}
              >
                <View style={{ flex: 1 }}>
                  <DisplayText size={26} color={skin.theme.text}>
                    {skin.displayName}
                  </DisplayText>
                  <Text style={[styles.skinTagline, { color: skin.theme.textDim }]}>
                    {skin.tagline}
                  </Text>
                  <View style={styles.movePreview}>
                    {MOVES.map((m) => (
                      <Text key={m} style={styles.moveIcon}>
                        {skin.moves[m].icon}
                      </Text>
                    ))}
                  </View>
                </View>
                {active && <Tag>ACTIVE</Tag>}
              </LinearGradient>
            </PressableScale>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.space(3),
  },
  soundLabel: { color: theme.text, fontWeight: '800', fontSize: 16 },
  label: {
    color: theme.textDim,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 6,
  },
  hint: { color: theme.textDim, marginBottom: 14 },
  volRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  volChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.panelBorder,
    backgroundColor: theme.bgRaised,
  },
  volChipSelected: { borderColor: theme.accent },
  volChipText: { color: theme.textDim, fontWeight: '800', fontSize: 12 },
  skinCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    marginVertical: 6,
    overflow: 'hidden',
  },
  skinPoster: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.space(4),
    borderRadius: theme.radius.lg - 2,
  },
  skinTagline: { marginTop: 2 },
  movePreview: { flexDirection: 'row', gap: theme.space(3), marginTop: theme.space(2) },
  moveIcon: { fontSize: 34 },
});
