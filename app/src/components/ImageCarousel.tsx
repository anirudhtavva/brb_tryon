/** Swipeable product photos with the dark "pill" page indicator from the current app. */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';
import { useAppWidth } from './PhoneFrame';

interface Props {
  images: number[];
  height: number;
  onPressImage?: (index: number) => void;
}

export function ImageCarousel({ images, height, onPressImage }: Props) {
  const width = useAppWidth();
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Ionicons name="shirt-outline" size={56} color={colors.textMuted} />
        <Text style={styles.placeholderText}>Product photo coming soon</Text>
      </View>
    );
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ height }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index: i }) => (
          <Pressable onPress={() => onPressImage?.(i)} accessibilityLabel={`Product photo ${i + 1} of ${images.length}`}>
            <Image source={item} style={{ width, height }} contentFit="cover" contentPosition="top" transition={150} />
          </Pressable>
        )}
      />
      {images.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(60,60,60,0.55)',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#FFFFFF' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt, gap: 8 },
  placeholderText: { color: colors.textMuted, fontSize: 14 },
});
