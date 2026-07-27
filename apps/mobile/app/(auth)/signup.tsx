import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { STARTING_COINS } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { requestAppFullscreen } from '../../src/fullscreen';
import { Button, Input, ErrorText, DisplayText, PressableScale, Tag } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function Signup() {
  const signup = useAuthStore((s) => s.signup);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    requestAppFullscreen(); // user gesture — take the whole screen for the game
    setError(null);
    setBusy(true);
    try {
      await signup(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View entering={FadeInDown.springify()} style={styles.tagWrap}>
        <Tag>New challenger</Tag>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.titleWrap}>
        <DisplayText size={44} color={theme.text} style={styles.title}>
          Join the arena
        </DisplayText>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(120).springify()}>
        <Text style={styles.subtitle}>
          Start with {STARTING_COINS} coins. Wager them in ranked, or play casual for free.
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.form}>
        <Input placeholder="Username (3–20 chars)" value={username} onChangeText={setUsername} />
        <Input
          placeholder="Password (6+ chars)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <ErrorText error={error} />
        <Button
          title="Create account"
          size="lg"
          onPress={submit}
          loading={busy}
          disabled={!username || !password}
        />
        <Link href="/(auth)/login" asChild>
          <PressableScale>
            <Text style={styles.link}>Already have an account? Log in</Text>
          </PressableScale>
        </Link>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  tagWrap: { flexDirection: 'row', justifyContent: 'center', marginBottom: theme.space(3) },
  titleWrap: { alignItems: 'center' },
  title: {
    textAlign: 'center',
    textShadowColor: theme.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subtitle: {
    color: theme.textDim,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    fontWeight: '600',
  },
  form: { marginTop: theme.space(2) },
  link: { color: theme.accent, textAlign: 'center', marginTop: 16, fontWeight: '700' },
});
