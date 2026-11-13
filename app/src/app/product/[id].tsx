/**
 * Product page — a rebuild of the current BRB screen, plus the new "Try on" button
 * in the bottom action bar (only for garments the backend can try on).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { BottomNav } from '../../components/BottomNav';
import { ImageCarousel } from '../../components/ImageCarousel';
import { useAppWidth } from '../../components/PhoneFrame';
import { PhotoViewer } from '../../components/PhotoViewer';
import { RelatedProducts } from '../../components/RelatedProducts';
import { SizeOptions } from '../../components/SizeOptions';
import { TryOnSheet } from '../../components/TryOnSheet';
import { formatPrice, getProduct, getRelated } from '../../data/products';
import { notify } from '../../utils/notify';
import { colors, type } from '../../theme';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = getProduct(id);
  const width = useAppWidth();

  const [size, setSize] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!product) {
    return (
      <View style={styles.root}>
        <AppHeader title="Not found" onBack={() => router.back()} />
        <Text style={[type.body, { padding: 24 }]}>This product is no longer available.</Text>
      </View>
    );
  }

  const needsSize = product.sizes.length > 0;
  const canAddToCart = !needsSize || size !== null;

  const share = () => void Share.share({ message: `${product.name} — ${formatPrice(product.priceHkd)} on BRB` });

  const addToCart = () => {
    if (!canAddToCart) {
      notify('Pick a size', 'Select a option to add this item to cart.');
      return;
    }
    notify('Added to cart', `${product.name}${size ? ` (${size})` : ''}`);
  };

  return (
    <View style={styles.root}>
      <AppHeader title={product.name} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} onShare={share} />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <ImageCarousel images={product.images} height={Math.round(width * 0.82)} onPressImage={setViewerIndex} />

        <View style={styles.content}>
          <View style={styles.storeRow}>
            <View style={[styles.storeDot, { backgroundColor: product.store.isOpen ? '#2E7D32' : colors.closedDot }]} />
            <Text style={styles.storeName}>{product.store.name}</Text>
            <Text style={[styles.storeStatus, product.store.isOpen && { color: '#2E7D32' }]}>
              {product.store.isOpen ? 'Open' : 'Closed'}
            </Text>
          </View>

          <Text style={type.title}>{product.name}</Text>
          <Text style={type.price}>{formatPrice(product.priceHkd)}</Text>

          <SizeOptions sizes={product.sizes} selected={size} onSelect={setSize} />

          <View style={{ gap: 10 }}>
            <Text style={type.section}>Description</Text>
            <Text style={type.body}>{product.description}</Text>
          </View>

          <View style={styles.delivery}>
            <Ionicons name="cube" size={22} color={colors.textMuted} />
            <Text style={type.body}>Standard delivery: {product.deliveryMinutes} minutes</Text>
          </View>
        </View>

        <RelatedProducts
          products={getRelated(product.id)}
          onPress={(p) => router.push({ pathname: '/product/[id]', params: { id: p.id } })}
        />
      </ScrollView>

      {/* Bottom action bar: save · try on · add to cart */}
      <View style={styles.actionBar}>
        <Pressable
          style={styles.heart}
          onPress={() => setSaved((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
          accessibilityState={{ selected: saved }}
        >
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={30} color={colors.ink} />
        </Pressable>

        {product.tryOnEnabled && (
          <Pressable
            style={({ pressed }) => [styles.tryOn, pressed && { opacity: 0.8 }]}
            onPress={() => setTryOnOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Try on with your photo"
          >
            <Ionicons name="sparkles" size={20} color={colors.brand} />
            <Text style={styles.tryOnText}>Try on</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.cart, !canAddToCart && styles.cartDisabled, pressed && { opacity: 0.85 }]}
          onPress={addToCart}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAddToCart }}
        >
          <Ionicons name="cart-outline" size={24} color="#FFF" />
          <Text style={styles.cartText}>Add to Cart</Text>
        </Pressable>
      </View>

      <BottomNav onProducts={() => router.replace('/')} />

      <TryOnSheet product={product} visible={tryOnOpen} onClose={() => setTryOnOpen(false)} onAddToCart={addToCart} />
      <PhotoViewer
        product={product}
        index={viewerIndex}
        saved={saved}
        onToggleSave={() => setSaved((s) => !s)}
        onShare={share}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 18, paddingTop: 28, gap: 18 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storeDot: { width: 10, height: 10, borderRadius: 5 },
  storeName: { fontSize: 17, color: colors.ink },
  storeStatus: { fontSize: 15, color: colors.closedText, marginLeft: 6 },
  delivery: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  heart: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.heartBg, alignItems: 'center', justifyContent: 'center' },
  tryOn: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.brand,
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tryOnText: { color: colors.brand, fontSize: 16, fontWeight: '700' },
  cart: {
    flex: 1,
    height: 56,
    borderRadius: 30,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cartDisabled: { backgroundColor: colors.brandDisabled },
  cartText: { color: '#FFF', fontSize: 18, fontWeight: '600' },
});
