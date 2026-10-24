import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Images, FilmStrip, FolderOpen, DownloadSimple, X } from 'phosphor-react-native';
import BottomSheet from '@/components/ui/BottomSheet';
import { Colors, Fonts } from '@/constants/theme';
import { useFont } from '@/context/FontContext';
import { haptics } from '@/utils/haptics';
import { notify } from '@/utils/notify';

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
    label: 'photo album',
    description: 'save frames to camera roll',
    icon: <FolderOpen size={22} color={Colors.textPrimary} weight="light" />,
  },
  {
    format: 'backup',
    label: 'rewind backup',
    description: 'importable .rewind file',
    icon: <DownloadSimple size={22} color={Colors.textPrimary} weight="light" />,
  },
  {
    format: 'gif',
    label: 'animated gif',
    description: 'coming soon',
    icon: <Images size={22} color={Colors.textTertiary} weight="light" />,
    comingSoon: true,
  },
  {
    format: 'mp4',
    label: 'mp4 video',
    description: 'coming soon',
    icon: <FilmStrip size={22} color={Colors.textTertiary} weight="light" />,
    comingSoon: true,
  },
];

export default function ExportSheet({ visible, onSelect, onClose }: ExportSheetProps) {
  const { fonts } = useFont();

  function handlePress(option: Option) {
    if (option.comingSoon) {
      haptics.tap();
      notify({ title: 'coming soon', message: "this export isn't available yet.", tone: 'info' });
      return;
    }
    haptics.tap();
    onSelect(option.format);
  }

  // Closing taps, like closing the photo viewer.
  const dismiss = () => {
    haptics.tap();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: fonts.medium }]}>export</Text>
        <Pressable
          onPress={dismiss}
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={Colors.textSecondary} weight="light" />
        </Pressable>
      </View>

      {OPTIONS.map((option) => (
        <Pressable
          key={option.format}
          style={({ pressed }) => [styles.row, option.comingSoon && styles.rowDisabled, pressed && { opacity: 0.7 }]}
          onPress={() => handlePress(option)}
          accessibilityRole="button"
          accessibilityLabel={option.comingSoon ? `${option.label}, coming soon` : option.label}
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
