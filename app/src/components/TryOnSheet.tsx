/**
 * The "Try on" sheet. One component, one screen per phase of `useTryOn`:
 * intro → loading → result, or a friendly error with the right next step.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isTryOnConfigured } from '../config';
import type { Product } from '../data/products';
import { useTryOn, type TryOnState } from '../hooks/useTryOn';
import { colors, radius } from '../theme';
import { PhoneFrame } from './PhoneFrame';

interface Props {
  product: Product;
  visible: boolean;
  onClose: () => void;
  onAddToCart: () => void;
}

export function TryOnSheet({ product, visible, onClose, onAddToCart }: Props) {
  const { state, start, retry, reset } = useTryOn(product.id);
  const insets = useSafeAreaInsets();

  // Closing always cancels and clears — the photo isn't kept anywhere.
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <PhoneFrame>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.topRow}>
          <Text style={styles.heading}>Virtual try-on</Text>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={28} color={colors.ink} />
          </Pressable>
        </View>
        <Text style={styles.subheading} numberOfLines={1}>
          {product.name}
        </Text>

        <Body
          state={state}
          product={product}
          onPick={start}
          onRetry={retry}
          onReset={reset}
          onClose={close}
          onAddToCart={() => {
            close();
            onAddToCart();
          }}
        />
      </View>
      </PhoneFrame>
    </Modal>
  );
}

interface BodyProps {
  state: TryOnState;
  product: Product;
  onPick: (source: 'camera' | 'library') => void;
  onRetry: () => void;
  onReset: () => void;
  onClose: () => void;
  onAddToCart: () => void;
}

function Body({ state, product, onPick, onRetry, onReset, onClose, onAddToCart }: BodyProps) {
  switch (state.phase) {
    case 'idle':
      return <Intro product={product} onPick={onPick} />;
    case 'preparing':
    case 'uploading':
    case 'processing':
      return <Loading state={state} onCancel={onReset} />;
    case 'done':
      return <Result before={state.photo.uri} after={state.resultUri} onAgain={onReset} onAddToCart={onAddToCart} />;
    case 'error':
      return <ErrorView state={state} onRetry={onRetry} onNewPhoto={onReset} onClose={onClose} />;
  }
}

/* ---------- Intro: tips + privacy + pick a photo ---------- */

function Intro({ product, onPick }: { product: Product; onPick: BodyProps['onPick'] }) {
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.introRow}>
        {product.images[0] && <Image source={product.images[0]} style={styles.thumb} contentFit="cover" contentPosition="top" />}
        <View style={{ flex: 1, gap: 10 }}>
          <Tip icon="body-outline" text="Stand facing the camera, arms relaxed" />
          <Tip icon="sunny-outline" text="Good light, plain background" />
          <Tip icon="person-outline" text="Just you in the photo, full upper body visible" />
        </View>
      </View>

      <View style={styles.privacy}>
        <Ionicons name="lock-closed" size={16} color={colors.brand} />
        <Text style={styles.privacyText}>
          Your photo is only used to create this preview. We don't save it, and our AI partner deletes it automatically
          after processing.
        </Text>
      </View>

      {!isTryOnConfigured && (
        <Text style={styles.configWarning}>Developer note: set EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_APP_KEY in app/.env.</Text>
      )}

      <PrimaryButton icon="camera" label="Take a photo" onPress={() => onPick('camera')} />
      <SecondaryButton icon="images-outline" label="Choose from library" onPress={() => onPick('library')} />
    </ScrollView>
  );
}

function Tip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.tip}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

/* ---------- Loading: photo preview + progress text + elapsed time ---------- */

const MESSAGES = ['Fitting the garment to you…', 'Matching fabric and folds…', 'Adding the final touches…'];

function Loading({ state, onCancel }: { state: Extract<TryOnState, { phase: 'preparing' | 'uploading' | 'processing' }>; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const label =
    state.phase === 'preparing'
      ? 'Getting your photo ready…'
      : state.phase === 'uploading'
        ? 'Uploading securely…'
        : MESSAGES[Math.min(MESSAGES.length - 1, Math.floor(seconds / 6))];

  const photoUri = state.phase === 'preparing' ? null : state.photo.uri;

  return (
    <View style={styles.body}>
      <View style={styles.preview}>
        {photoUri && <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={6} />}
        <View style={styles.previewOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText} accessibilityLiveRegion="polite">
            {label}
          </Text>
          <Text style={styles.loadingSub}>
            {seconds < 25 ? 'Usually takes 10–20 seconds' : 'Almost there, thanks for waiting'} · {seconds}s
          </Text>
        </View>
      </View>
      <SecondaryButton icon="close" label="Cancel" onPress={onCancel} />
    </View>
  );
}

/* ---------- Result: before/after toggle ---------- */

function Result({ before, after, onAgain, onAddToCart }: { before: string; after: string; onAgain: () => void; onAddToCart: () => void }) {
  const [showBefore, setShowBefore] = useState(false);
  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* Pinch to zoom (up to 4x), double-tap-free: iOS ScrollView handles it natively. */}
      <ScrollView
        key={showBefore ? 'before' : 'after'} // reset zoom when switching photos
        style={styles.preview}
        contentContainerStyle={{ flex: 1 }}
        minimumZoomScale={1}
        maximumZoomScale={4}
        bouncesZoom
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: showBefore ? before : after }}
          style={{ flex: 1 }}
          contentFit="contain"
          transition={200}
          cachePolicy="memory" // privacy: never write the shopper's photos to the disk cache
          accessibilityLabel={showBefore ? 'Your original photo' : 'You wearing this item'}
        />
      </ScrollView>
      <Text style={styles.disclaimer}>Pinch to zoom</Text>

      <View style={styles.segment} accessibilityRole="tablist">
        {(['After', 'Before'] as const).map((label) => {
          const active = (label === 'Before') === showBefore;
          return (
            <Pressable
              key={label}
              style={[styles.segmentItem, active && styles.segmentActive]}
              onPress={() => setShowBefore(label === 'Before')}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.disclaimer}>AI preview. Real fit and colour can vary slightly.</Text>
      <PrimaryButton icon="cart-outline" label="Add to Cart" onPress={onAddToCart} />
      <SecondaryButton icon="refresh" label="Try another photo" onPress={onAgain} />
    </ScrollView>
  );
}

/* ---------- Error ---------- */

function ErrorView({
  state,
  onRetry,
  onNewPhoto,
  onClose,
}: {
  state: Extract<TryOnState, { phase: 'error' }>;
  onRetry: () => void;
  onNewPhoto: () => void;
  onClose: () => void;
}) {
  const primary = {
    retry: { icon: 'refresh' as const, label: 'Try again', onPress: onRetry },
    'new-photo': { icon: 'images-outline' as const, label: 'Choose another photo', onPress: onNewPhoto },
    'open-settings': { icon: 'settings-outline' as const, label: 'Open Settings', onPress: () => void Linking.openSettings() },
    close: { icon: 'close' as const, label: 'Close', onPress: onClose },
  }[state.action];

  return (
    <View style={[styles.body, styles.center]}>
      <View style={styles.errorIcon}>
        <Ionicons name="alert-circle-outline" size={44} color={colors.warning} />
      </View>
      <Text style={styles.errorText} accessibilityRole="alert">
        {state.message}
      </Text>
      <PrimaryButton {...primary} />
      {state.action !== 'close' && <SecondaryButton icon="arrow-back" label="Back" onPress={onNewPhoto} />}
    </View>
  );
}

/* ---------- Buttons ---------- */

type ButtonProps = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

function PrimaryButton({ icon, label, onPress }: ButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={22} color="#FFFFFF" />
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ icon, label, onPress }: ButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '700', color: colors.ink },
  subheading: { fontSize: 15, color: colors.textMuted, marginTop: 2, marginBottom: 16 },
  body: { gap: 14, paddingBottom: 12 },
  center: { flex: 1, justifyContent: 'center' },
  introRow: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  thumb: { width: 110, height: 150, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  tip: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  tipText: { flex: 1, fontSize: 15, color: colors.text },
  privacy: { flexDirection: 'row', gap: 10, backgroundColor: '#F3EEFA', padding: 14, borderRadius: radius.sm },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  configWarning: { color: colors.error, fontSize: 13 },
  preview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  previewOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  loadingText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  loadingSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  segment: { flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.chip, borderRadius: 999, padding: 4 },
  segmentItem: { paddingHorizontal: 28, paddingVertical: 8, borderRadius: 999 },
  segmentActive: { backgroundColor: colors.brand },
  segmentText: { fontSize: 15, color: colors.text },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },
  disclaimer: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  errorIcon: { alignSelf: 'center', marginBottom: 4 },
  errorText: { fontSize: 17, lineHeight: 24, color: colors.text, textAlign: 'center', marginBottom: 8 },
  primary: {
    height: 56,
    borderRadius: 30,
    backgroundColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  secondary: {
    height: 52,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: colors.brand, fontSize: 16, fontWeight: '600' },
});
