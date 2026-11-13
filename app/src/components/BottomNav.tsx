/**
 * The floating pill tab bar from the current app. Only "Products" is live in
 * this prototype; the other tabs show a short note instead of navigating.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { notify } from '../utils/notify';

type Tab = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap };

const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'stores', label: 'Stores', icon: 'business' },
  { key: 'cart', label: 'Cart', icon: 'bag' },
  { key: 'products', label: 'Products', icon: 'pricetag' },
  { key: 'profile', label: 'Profile', icon: 'person-circle' },
];

export function BottomNav({ active = 'products', onProducts }: { active?: string; onProducts?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.pill}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Pressable
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() =>
                tab.key === 'products'
                  ? onProducts?.()
                  : notify(tab.label, 'Not part of this try-on prototype.')
              }
            >
              <Ionicons name={tab.icon} size={26} color={isActive ? colors.ink : '#111'} />
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 14, paddingTop: 8 },
  pill: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 5,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 30, gap: 2 },
  tabActive: { backgroundColor: '#F0EEF0' },
  label: { fontSize: 11, color: colors.text },
  labelActive: { color: colors.ink, fontWeight: '600' },
});
