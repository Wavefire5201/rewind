import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageSquare, FileArrowUp, X } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

export type ImportSource = 'camera-roll' | 'backup';

interface ImportSheetProps {
  visible: boolean;
  onSelect: (source: ImportSource) => void;
  onClose: () => void;
}

interface Option {
  source: ImportSource;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const OPTIONS: Option[] = [
  {
    source: 'camera-roll',
    label: 'camera roll',
    description: 'import photos from your library',
    icon: <ImageSquare size={22} color={Colors.textPrimary} weight="light" />,
  },
  {
    source: 'backup',
    label: 'rewind backup',
    description: 'restore from a .rewind file',
    icon: <FileArrowUp size={22} color={Colors.textPrimary} weight="light" />,
  },
];

export default function ImportSheet({ visible, onSelect, onClose }: ImportSheetProps) {
  const { fonts } = useFont();
  const insets = useSafeAreaInsets();

  function handlePress(option: Option) {
    haptics.tap();
    onSelect(option.source);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: fonts.medium }]}>import</Text>
          <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <X size={20} color={Colors.textSecondary} weight="light" />
          </Pressable>
        </View>

        {OPTIONS.map((option) => (
          <Pressable
            key={option.source}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            onPress={() => handlePress(option)}
            accessibilityLabel={option.label}
            accessibilityRole="button"
          >
            <View style={styles.iconContainer}>{option.icon}</View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { fontFamily: fonts.regular }]}>
                {option.label}
              </Text>
              <Text style={[styles.rowDescription, { fontFamily: fonts.regular }]}>{option.description}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.mono.medium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderPrimary,
  },
  iconContainer: {
    width: 36,
    alignItems: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  rowDescription: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
