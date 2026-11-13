/** Purple top bar: round back button, truncated title, round share button. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface Props {
  title: string;
  onBack?: () => void;
  onShare?: () => void;
}

export function AppHeader({ title, onBack, onShare }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      {onBack ? (
        <RoundButton icon="chevron-back" label="Go back" onPress={onBack} />
      ) : (
        <View style={styles.spacer} />
      )}
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {onShare ? <RoundButton icon="share-outline" label="Share" onPress={onShare} /> : <View style={styles.spacer} />}
    </View>
  );
}

function RoundButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.round, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 12,
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  round: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 46 },
});
