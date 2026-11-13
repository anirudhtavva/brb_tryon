/**
 * Keeps the app phone-sized on the web.
 *
 * On a laptop browser the app would otherwise stretch to the full window and every
 * photo would be huge. Here it sits in a phone-width column in the middle of the
 * screen, so a laptop shows exactly what an iPhone shows. On iOS/Android this is a
 * plain pass-through and changes nothing.
 */
import type { ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

/** Widest phone we design for (iPhone Pro Max is 440 points wide). */
export const MAX_APP_WIDTH = 440;

/** The width the app actually has: the screen on a phone, at most 440 on the web. */
export function useAppWidth(): number {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' ? Math.min(width, MAX_APP_WIDTH) : width;
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={styles.backdrop}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#ECE8F2', alignItems: 'center' },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_APP_WIDTH,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    // Soft edge so the column reads as "the phone" on a wide screen.
    boxShadow: '0 0 24px rgba(35, 19, 56, 0.12)',
  },
});
