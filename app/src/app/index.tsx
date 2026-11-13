/** Products tab: Women / Men switch and a 2-column grid. Items you can try on get a badge. */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../components/AppHeader';
import { BottomNav } from '../components/BottomNav';
import { type Audience, formatPrice, PRODUCTS } from '../data/products';
import { colors } from '../theme';

export default function ProductsScreen() {
  const [audience, setAudience] = useState<Audience>('women');
  const items = useMemo(() => PRODUCTS.filter((p) => p.audience === audience), [audience]);

  return (
    <View style={styles.root}>
      <AppHeader title="Products" />

      <View style={styles.segment} accessibilityRole="tablist">
        {(['women', 'men'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setAudience(key)}
            style={[styles.segmentItem, audience === key && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: audience === key }}
          >
            <Text style={[styles.segmentText, audience === key && styles.segmentTextActive]}>
              {key === 'women' ? 'Women' : 'Men'}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 14 }}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <View>
              {item.images[0] ? (
                <Image source={item.images[0]} style={styles.image} contentFit="cover" contentPosition="top" />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Ionicons name="shirt-outline" size={40} color={colors.textMuted} />
                </View>
              )}
              {item.tryOnEnabled && (
                <View style={styles.badge}>
                  <Ionicons name="sparkles" size={12} color="#FFF" />
                  <Text style={styles.badgeText}>Try on</Text>
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>{formatPrice(item.priceHkd, 'short')}</Text>
          </Pressable>
        )}
      />

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  segment: { flexDirection: 'row', margin: 16, backgroundColor: colors.chip, borderRadius: 999, padding: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  segmentActive: { backgroundColor: colors.brand },
  segmentText: { fontSize: 15, color: colors.text },
  segmentTextActive: { color: '#FFF', fontWeight: '600' },
  grid: { paddingHorizontal: 16, paddingBottom: 24, gap: 18 },
  card: { flex: 1, maxWidth: '50%', gap: 6 },
  image: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: colors.surfaceAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  name: { fontSize: 15, color: colors.text, lineHeight: 20 },
  price: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
