/** "Option" size chips plus the orange hint until a size is picked. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme';

interface Props {
  sizes: string[];
  selected: string | null;
  onSelect: (size: string) => void;
}

export function SizeOptions({ sizes, selected, onSelect }: Props) {
  if (sizes.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={type.section}>Option</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {sizes.map((size) => {
          const isSelected = size === selected;
          return (
            <Pressable
              key={size}
              onPress={() => onSelect(size)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{size}</Text>
            </Pressable>
          );
        })}
      </View>
      {!selected && (
        <View style={styles.hint}>
          <Ionicons name="alert-circle" size={18} color={colors.warning} />
          <Text style={styles.hintText}>Select a option to add this item to cart.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  chip: { minWidth: 56, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.chip, alignItems: 'center' },
  chipSelected: { backgroundColor: colors.chipSelected },
  chipText: { fontSize: 15, color: colors.text },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintText: { color: colors.warning, fontSize: 14 },
});
