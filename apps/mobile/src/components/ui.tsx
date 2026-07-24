import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '../theme';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && { backgroundColor: theme.accent },
        variant === 'secondary' && { backgroundColor: theme.panel, borderWidth: 1, borderColor: theme.panelBorder },
        variant === 'danger' && { backgroundColor: theme.red },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        (pressed || disabled || loading) && { opacity: 0.6 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.accentText : theme.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: variant === 'primary' ? theme.accentText : variant === 'ghost' ? theme.textDim : theme.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.textDim}
      autoCapitalize="none"
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <Text style={styles.error}>{error}</Text>;
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 6,
  },
  buttonText: { fontWeight: '800', fontSize: 16 },
  input: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: 12,
    padding: 14,
    color: theme.text,
    marginVertical: 6,
    fontSize: 16,
  },
  card: {
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelBorder,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  error: { color: theme.red, marginVertical: 6, textAlign: 'center' },
});
