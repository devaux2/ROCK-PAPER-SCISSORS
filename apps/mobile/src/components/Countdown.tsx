import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

/** Counts down to an absolute epoch-ms deadline (server-authoritative). */
export function Countdown({ deadline }: { deadline: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(Math.max(0, deadline - Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [deadline]);
  const seconds = Math.ceil(remaining / 1000);
  return (
    <Text style={[styles.text, seconds <= 3 && { color: theme.red }]}>{seconds}</Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 34, fontWeight: '900', color: theme.text, textAlign: 'center' },
});
