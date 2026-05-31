import React from 'react';
import { View, Text, Modal, Pressable, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Images, FilmStrip, FolderOpen, DownloadSimple, X } from 'phosphor-react-native';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';

export type ExportFormat = 'album' | 'backup' | 'gif' | 'mp4';

interface ExportSheetProps {
  visible: boolean;
  onSelect: (format: ExportFormat) => void;
  onClose: () => void;
}

interface Option {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

const OPTIONS: Option[] = [
  {
    format: 'album',
    label: 'Photo Album',
    description: 'Save frames to camera roll',
    icon: <FolderOpen size={22} color={Colors.textPrimary} weight="light" />,
  },
  {
    format: 'backup',
    label: 'Rewind Backup',
    description: 'Importable .rewind file',
    icon: <DownloadSimple size={22} color={Colors.textPrimary} weight="light" />,
  },
  {
    format: 'gif',
    label: 'Animated GIF',
    description: 'Coming soon',
    icon: <Images size={22} color={Colors.textTertiary} weight="light" />,
    comingSoon: true,
  },
  {
    format: 'mp4',
    label: 'MP4 Video',
    description: 'Coming soon',
    icon: <FilmStrip size={22} color={Colors.textTertiary} weight="light" />,
    comingSoon: true,
  },
];

export default function ExportSheet({ visible, onSelect, onClose }: ExportSheetProps) {
  const { fonts } = useFont();
  const insets = useSafeAreaInsets();

  function handlePress(option: Option) {
    if (option.comingSoon) {
      haptics.tap();
      Alert.alert('Coming Soon', `${option.label} export is not available yet.`);
      return;
    }
    haptics.tap();
    onSelect(option.format);
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
          <Text style={[styles.title, { fontFamily: fonts.medium }]}>Export</Text>
          <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
            <X size={20} color={Colors.textSecondary} weight="light" />
          </Pressable>
        </View>

        {OPTIONS.map((option) => (
          <Pressable
            key={option.format}
            style={({ pressed }) => [styles.row, option.comingSoon && styles.rowDisabled, pressed && { opacity: 0.7 }]}
            onPress={() => handlePress(option)}
          >
            <View style={styles.iconContainer}>{option.icon}</View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, option.comingSoon && styles.rowLabelDisabled, { fontFamily: fonts.regular }]}>
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
  rowDisabled: {
    opacity: 0.4,
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
  rowLabelDisabled: {
    color: Colors.textSecondary,
  },
  rowDescription: {
    fontFamily: Fonts.mono.regular,
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
