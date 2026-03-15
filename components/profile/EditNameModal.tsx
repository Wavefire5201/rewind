import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface EditNameModalProps {
  visible: boolean;
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

export default function EditNameModal({ visible, currentName, onSave, onClose }: EditNameModalProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (visible) {
      setName(currentName);
    }
  }, [visible, currentName]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.content}>
          <Text style={styles.title}>edit name</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => onSave(name)}
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.buttonOutlined} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.buttonOutlinedText}>cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonFilled} onPress={() => onSave(name)} activeOpacity={0.7}>
              <Text style={styles.buttonFilledText}>save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: 24,
  },
  title: {
    fontFamily: Fonts.mono.regular,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  input: {
    fontFamily: Fonts.mono.regular,
    fontSize: 18,
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderColor: Colors.borderPrimary,
    paddingVertical: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  buttonOutlined: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  buttonOutlinedText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  buttonFilled: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.textPrimary,
  },
  buttonFilledText: {
    fontFamily: Fonts.mono.regular,
    fontSize: 13,
    color: Colors.bgPage,
  },
});
