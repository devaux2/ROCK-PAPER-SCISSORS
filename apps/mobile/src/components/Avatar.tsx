import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { BUILTIN_AVATARS, isCustomAvatar, customAvatarUri } from '../avatars';

export function Avatar({ avatar, size = 48 }: { avatar: string; size?: number }) {
  if (isCustomAvatar(avatar)) {
    return (
      <Image
        source={{ uri: customAvatarUri(avatar) }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  const builtin = BUILTIN_AVATARS[avatar] ?? BUILTIN_AVATARS.avatar_01!;
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: builtin.bg },
      ]}
    >
      <Text style={{ fontSize: size * 0.55 }}>{builtin.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
});
