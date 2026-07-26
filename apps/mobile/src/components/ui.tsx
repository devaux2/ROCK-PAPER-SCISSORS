import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Every tappable in the app scales on press through this. */
export function PressableScale({
  children,
  style,
  disabled,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withSpring(0.96, theme.springs.press);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, theme.springs.press);
        rest.onPressOut?.(e);
      }}
      style={[animated, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Anton poster type — uppercase, heavyweight, loud. */
export function DisplayText({
  children,
  size = 24,
  color = theme.text,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: theme.fonts.display,
          fontSize: size,
          color,
          letterSpacing: Math.max(0.5, size * 0.03),
          textTransform: 'uppercase',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Graffiti-marker voice — taglines, trash talk, one per screen max. */
export function MarkerText({
  children,
  size = 18,
  color = theme.accent,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[{ fontFamily: theme.fonts.marker, fontSize: size, color }, style]}>
      {children}
    </Text>
  );
}

/** Number that rolls to its new value instead of snapping. */
export function StatNumber({
  value,
  size = 22,
  color = theme.text,
  prefix = '',
  suffix = '',
  style,
}: {
  value: number;
  size?: number;
  color?: string;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState(value);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (display === value) return;
    // Only settle back if THIS spring finished — assigning from a
    // cancelled callback recurses into the next assignment's cancel.
    pop.value = withSpring(1.18, theme.springs.pop, (finished) => {
      'worklet';
      if (finished) pop.value = withSpring(1, theme.springs.press);
    });
    const from = display;
    const delta = value - from;
    const start = Date.now();
    const DURATION = 420;
    const interval = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t >= 1) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.Text
      style={[
        {
          fontFamily: theme.fonts.numeric,
          fontSize: size,
          color,
          letterSpacing: 1,
        },
        animated,
        style,
      ]}
    >
      {prefix}
      {display}
      {suffix}
    </Animated.Text>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  size = 'md',
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
}) {
  const dim = disabled || loading;
  const label = (color: string) => (
    <DisplayText size={size === 'lg' ? 24 : 19} color={color} style={styles.buttonLabel}>
      {title}
    </DisplayText>
  );
  const inner = loading ? (
    <ActivityIndicator color={variant === 'primary' ? theme.accentText : theme.text} />
  ) : variant === 'primary' ? (
    label(theme.accentText)
  ) : variant === 'ghost' ? (
    label(theme.textDim)
  ) : (
    label(theme.text)
  );

  if (variant === 'primary') {
    // Glow lives on the gradient itself so the halo follows the rounded
    // shape — a glowing wrapper renders as a dark slab on web.
    return (
      <PressableScale onPress={onPress} disabled={dim} style={dim && { opacity: 0.55 }}>
        <LinearGradient
          colors={theme.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            size === 'lg' && styles.buttonLg,
            !dim && theme.glow('#FFB020', 14),
          ]}
        >
          {inner}
        </LinearGradient>
      </PressableScale>
    );
  }
  return (
    <PressableScale
      onPress={onPress}
      disabled={dim}
      style={[
        styles.button,
        size === 'lg' && styles.buttonLg,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        variant === 'ghost' && styles.buttonGhost,
        dim && { opacity: 0.55 },
      ]}
    >
      {inner}
    </PressableScale>
  );
}

export function Input(props: TextInputProps) {
  const focus = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    borderColor: focus.value ? theme.accent : theme.panelBorder,
    shadowOpacity: focus.value * 0.35,
  }));
  return (
    <Animated.View style={[styles.inputWrap, theme.glow(theme.accent, 12), { shadowOpacity: 0 }, animated]}>
      <TextInput
        placeholderTextColor={theme.textDim}
        autoCapitalize="none"
        {...props}
        onFocus={(e) => {
          focus.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          focus.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
          props.onBlur?.(e);
        }}
        style={[styles.input, props.style]}
      />
    </Animated.View>
  );
}

export function Card({
  children,
  style,
  glow,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: string;
}) {
  return (
    <View style={[styles.card, glow ? theme.glow(glow, 14) : null, style]}>{children}</View>
  );
}

/** Tiny skewed arcade label — one per screen region, per DESIGN.md. */
export function Tag({ children, color = theme.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <Text style={[styles.tagText, { color }]}>{children}</Text>
    </View>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <Text style={styles.error}>{error}</Text>;
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    minHeight: 50,
  },
  buttonLg: { minHeight: 60, borderRadius: theme.radius.lg },
  buttonLabel: { textAlign: 'center' },
  buttonSecondary: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
  },
  buttonDanger: { backgroundColor: theme.danger },
  buttonGhost: { backgroundColor: 'transparent' },
  inputWrap: {
    borderWidth: 1.5,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.md,
    backgroundColor: theme.bgRaised,
    marginVertical: 6,
  },
  input: {
    padding: 14,
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: theme.radius.lg,
    padding: theme.space(4),
    marginVertical: 8,
  },
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    transform: [{ skewX: '-6deg' }],
  },
  tagText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  error: { color: theme.danger, marginVertical: 6, textAlign: 'center', fontWeight: '700' },
});
