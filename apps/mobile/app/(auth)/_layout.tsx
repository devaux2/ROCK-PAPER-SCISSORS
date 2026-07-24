import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { theme } from '../../src/theme';

export default function AuthLayout() {
  const token = useAuthStore((s) => s.token);
  if (token) return <Redirect href="/(main)" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    />
  );
}
