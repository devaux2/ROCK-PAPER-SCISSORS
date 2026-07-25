import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuthStore } from '../src/stores/authStore';
import { api } from '../src/api/client';
import { AVATAR_IDS, isCustomAvatar } from '../src/avatars';
import { Avatar } from '../src/components/Avatar';
import { Button, Input, ErrorText, PressableScale } from '../src/components/ui';
import { theme } from '../src/theme';

export default function EditProfile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? 'avatar_01');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pickPhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is needed to pick a photo');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    // Shrink to a 128px square so it fits comfortably in the avatar column.
    const small = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 128, height: 128 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (small.base64) setAvatar(`b64:${small.base64}`);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateProfile({ bio: bio.trim(), avatar });
      setUser(updated);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 20 }}>
      <Animated.View entering={FadeInDown.springify()} style={styles.preview}>
        <View style={[styles.previewRing, theme.glow(theme.accent)]}>
          <Avatar avatar={avatar} size={96} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).springify()}>
        <Text style={styles.label}>Choose an avatar</Text>
        <View style={styles.grid}>
          {AVATAR_IDS.map((id) => {
            const selected = avatar === id;
            return (
              <PressableScale
                key={id}
                onPress={() => setAvatar(id)}
                style={[
                  styles.gridItem,
                  selected && styles.gridItemActive,
                  selected && theme.glow(theme.accent, 12),
                ]}
              >
                <AvatarPop selected={selected}>
                  <Avatar avatar={id} size={52} />
                </AvatarPop>
              </PressableScale>
            );
          })}
        </View>
        <Button
          title={isCustomAvatar(avatar) ? 'Photo selected ✓ — pick another' : 'Use a photo instead'}
          variant="secondary"
          onPress={pickPhoto}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).springify()}>
        <Text style={styles.label}>Bio</Text>
        <Input
          placeholder="Say something menacing (160 chars max)"
          value={bio}
          onChangeText={setBio}
          maxLength={160}
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <ErrorText error={error} />
        <Button title="Save" onPress={save} loading={busy} />
      </Animated.View>
    </ScrollView>
  );
}

/** Spring pop when an avatar becomes the selected one. */
function AvatarPop({ selected, children }: { selected: boolean; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  React.useEffect(() => {
    if (selected) {
      scale.value = withSpring(1.15, theme.springs.pop, (finished) => {
        'worklet';
        if (finished) scale.value = withSpring(1, theme.springs.press);
      });
    }
  }, [selected, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={animated}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  preview: { alignItems: 'center', marginBottom: 16 },
  previewRing: {
    borderWidth: 3,
    borderColor: theme.accent,
    borderRadius: theme.radius.pill,
    padding: 4,
  },
  label: {
    color: theme.textDim,
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: theme.space(2) },
  gridItem: {
    padding: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridItemActive: { borderColor: theme.accent },
});
