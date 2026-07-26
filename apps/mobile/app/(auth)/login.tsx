import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/authStore';
import { Button, Input, ErrorText, DisplayText, MarkerText, PressableScale } from '../../src/components/ui';
import { CoinField, LightPool } from '../../src/components/bling';
import { theme } from '../../src/theme';

/** Gentle idle float for the ✊✋✌️ hero. */
function FloatingHero() {
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [float]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -8 * float.value }],
  }));
  return <Animated.Text style={[styles.hero, style]}>✊✋✌️</Animated.Text>;
}

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
      <LightPool size={360} style={{ top: 40, alignSelf: 'center' }} />
      <CoinField count={8} />
      <Animated.View entering={FadeInDown.springify()} style={styles.heroWrap}>
        <FloatingHero />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.logoWrap}>
        <DisplayText size={72} color={theme.text} style={[styles.logo, theme.textGlow('rgba(255,201,60,0.55)', 24)]}>
          RPS
        </DisplayText>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(120).springify()}>
        <MarkerText
          size={20}
          style={[styles.subtitle, theme.textGlow('rgba(255,178,32,0.6)', 12)]}
        >
          Real money. Real wins.
        </MarkerText>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.form}>
        <Input placeholder="Username" value={username} onChangeText={setUsername} />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <ErrorText error={error} />
        <Button
          title="Log in"
          size="lg"
          onPress={submit}
          loading={busy}
          disabled={!username || !password}
        />
        <Link href="/(auth)/signup" asChild>
          <PressableScale>
            <Text style={styles.link}>New here? Create an account</Text>
          </PressableScale>
        </Link>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.bg },
  heroWrap: { alignItems: 'center' },
  hero: { fontSize: 56, textAlign: 'center' },
  logoWrap: { alignItems: 'center', marginTop: theme.space(3) },
  logo: { textAlign: 'center' },
  subtitle: {
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 24,
    transform: [{ rotate: '-2deg' }],
  },
  form: { marginTop: theme.space(2) },
  link: { color: theme.accent, textAlign: 'center', marginTop: 16, fontWeight: '700' },
});
