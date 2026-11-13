/** Horizontal "Related Products" row. */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPrice, type Product } from '../data/products';
import { colors, type } from '../theme';

interface Props {
  products: Product[];
  onPress: (product: Product) => void;
}

export function RelatedProducts({ products, onPress }: Props) {
  if (products.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={[type.section, styles.title]}>Related Products</Text>
      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onPress(item)} accessibilityRole="button" accessibilityLabel={item.name}>
            {item.images[0] ? (
              <Image source={item.images[0]} style={styles.image} contentFit="cover" contentPosition="top" />
            ) : (
              <View style={[styles.image, styles.placeholder]}>
                <Ionicons name="shirt-outline" size={36} color={colors.textMuted} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>{formatPrice(item.priceHkd, 'short')}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const CARD = 160;
const styles = StyleSheet.create({
  wrap: { gap: 14 },
  title: { paddingHorizontal: 18 },
  list: { paddingHorizontal: 18, gap: 18 },
  card: { width: CARD, gap: 6 },
  image: { width: CARD, height: CARD, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, color: colors.text, lineHeight: 21 },
  price: { fontSize: 14, fontWeight: '700', color: colors.ink },
});
