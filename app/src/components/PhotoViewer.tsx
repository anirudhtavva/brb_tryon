/** Full-screen black photo viewer (third screenshot): back, share, photo, SAVE, price and name. */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPrice, type Product } from '../data/products';
import { PhoneFrame } from './PhoneFrame';

interface Props {
  product: Product;
  index: number | null;
  saved: boolean;
  onToggleSave: () => void;
  onShare: () => void;
  onClose: () => void;
}

export function PhotoViewer({ product, index, saved, onToggleSave, onShare, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const image = index !== null ? product.images[index] : undefined;
  return (
    <Modal visible={index !== null} animationType="fade" onRequestClose={onClose}>
      <PhoneFrame>
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close photo">
            <Ionicons name="arrow-back" size={30} color="#FFF" />
          </Pressable>
          <Pressable onPress={onShare} hitSlop={10} accessibilityLabel="Share">
            <Ionicons name="share-outline" size={28} color="#FFF" />
          </Pressable>
        </View>
        {image && <Image source={image} style={styles.image} contentFit="contain" />}
        <Pressable style={styles.save} onPress={onToggleSave} accessibilityRole="button" accessibilityState={{ selected: saved }}>
          <Ionicons name={saved ? 'heart' : 'heart-outline'} size={26} color="#FFF" />
          <Text style={styles.saveText}>{saved ? 'SAVED' : 'SAVE'}</Text>
        </Pressable>
        <Text style={styles.price}>{formatPrice(product.priceHkd)}</Text>
        <Text style={styles.name}>{product.name}</Text>
      </View>
      </PhoneFrame>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, marginBottom: 16 },
  image: { flex: 1, width: '100%' },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 30,
    marginTop: 20,
  },
  saveText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  price: { color: '#FFF', fontSize: 26, fontWeight: '700', marginTop: 24 },
  name: { color: '#FFF', fontSize: 17, marginTop: 6 },
});
