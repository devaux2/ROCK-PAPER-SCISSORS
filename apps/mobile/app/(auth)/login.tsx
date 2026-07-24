import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Button, Input, ErrorText } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.logo}>✊✋✌️</Text>
      <Text style={styles.title}>THROWDOWN</Text>
      <Text style={styles.subtitle}>Best-of-3. Winner takes the pot.</Text>
      <View style={styles.form}>
        <Input placeholder="Username" value={username} onChangeText={setUsername} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <ErrorText error={error} />
        <Button title="Log in" onPress={submit} loading={busy} disabled={!username || !password} />
        <Link href="/(auth)/signup" asChild>
          <Text style={styles.link}>New here? Create an account</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  logo: { fontSize: 56, textAlign: 'center' },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: theme.accent,
    textAlign: 'center',
    letterSpacing: 6,
    marginTop: 8,
  },
  subtitle: { color: theme.textDim, textAlign: 'center', marginTop: 6, marginBottom: 24 },
  form: { marginTop: 8 },
  link: { color: theme.blue, textAlign: 'center', marginTop: 16, fontWeight: '600' },
});
