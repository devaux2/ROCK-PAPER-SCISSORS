import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { STARTING_COINS } from '@rps/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { Button, Input, ErrorText } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function Signup() {
  const signup = useAuthStore((s) => s.signup);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
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
      <Text style={styles.title}>Join the arena</Text>
      <Text style={styles.subtitle}>
        Start with {STARTING_COINS} coins. Wager them in ranked, or play casual for free.
      </Text>
      <View style={styles.form}>
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
          onPress={submit}
          loading={busy}
          disabled={!username || !password}
        />
        <Link href="/(auth)/login" asChild>
          <Text style={styles.link}>Already have an account? Log in</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  title: { fontSize: 30, fontWeight: '900', color: theme.text, textAlign: 'center' },
  subtitle: { color: theme.textDim, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  form: { marginTop: 8 },
  link: { color: theme.blue, textAlign: 'center', marginTop: 16, fontWeight: '600' },
});
