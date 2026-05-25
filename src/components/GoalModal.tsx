import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS, MAX_GOAL, MIN_GOAL } from '../constants';

type GoalModalProps = {
  currentGoal: number;
  helperText?: string;
  isVisible: boolean;
  onClose: () => void;
  onSave: (goal: number) => void;
  title?: string;
};

export const GoalModal = ({
  currentGoal,
  helperText = 'Choose a goal from 1 to 100000 steps.',
  isVisible,
  onClose,
  onSave,
  title = 'Daily goal',
}: GoalModalProps) => {
  const [value, setValue] = useState(String(currentGoal));

  useEffect(() => {
    if (isVisible) {
      setValue(String(currentGoal));
    }
  }, [currentGoal, isVisible]);

  const parsedGoal = Number(value);
  const canSave = Number.isFinite(parsedGoal) && parsedGoal >= MIN_GOAL && parsedGoal <= MAX_GOAL;

  const handleSave = (): void => {
    if (canSave) {
      onSave(Math.floor(parsedGoal));
    }
  };

  return (
    <Modal animationType="fade" transparent visible={isVisible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={setValue}
            placeholder="10000"
            returnKeyType="done"
            style={styles.input}
            value={value}
          />
          <Text style={styles.helper}>{helperText}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.button, styles.secondaryButton]}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canSave}
              onPress={handleSave}
              style={[styles.button, canSave ? styles.primaryButton : styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.modalBackdrop,
  },
  dialog: {
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    padding: 22,
    gap: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  helper: {
    color: COLORS.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    minHeight: 44,
    minWidth: 92,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButton: {
    backgroundColor: COLORS.stoppedSoft,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  disabledButton: {
    backgroundColor: COLORS.stopped,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButtonText: {
    color: COLORS.surface,
    fontSize: 16,
    fontWeight: '800',
  },
});
