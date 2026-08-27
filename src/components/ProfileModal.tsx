import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '../constants';
import { getBmi } from '../storage/profileStorage';
import { triggerSelectionHaptic } from '../utils/haptics';

import type { UserBodyProfile } from '../features/profile/domain/models';

type ProfileModalProps = {
  isVisible: boolean;
  onClose: () => void;
  onSave: (profile: UserBodyProfile) => void;
  profile: UserBodyProfile | null;
};

export const ProfileModal = ({ isVisible, onClose, onSave, profile }: ProfileModalProps) => {
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [weightTrackingEnabled, setWeightTrackingEnabled] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    setHeightCm(profile?.heightCm ? String(profile.heightCm) : '');
    setWeightKg(profile?.currentWeightKg ? String(profile.currentWeightKg) : '');
    setWeightTrackingEnabled(profile?.weightTrackingEnabled === true);
  }, [isVisible, profile]);

  const parsedHeight = Number(heightCm.replace(',', '.'));
  const parsedWeight = Number(weightKg.replace(',', '.'));
  const canSave = parsedHeight > 0 && parsedHeight <= 260 && parsedWeight > 0 && parsedWeight <= 400;
  const bmi = canSave ? getBmi(parsedHeight, parsedWeight) : 0;

  const handleSave = (): void => {
    if (!canSave) {
      return;
    }

    onSave({
      currentWeightKg: Math.round(parsedWeight * 10) / 10,
      heightCm: Math.round(parsedHeight * 10) / 10,
      updatedAt: new Date().toISOString(),
      weightTrackingEnabled,
    });
  };

  return (
    <Modal animationType="fade" transparent visible={isVisible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.dialog}>
          <View>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Body data helps make pace and progress stats more useful.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Height</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setHeightCm}
              placeholder="178"
              returnKeyType="done"
              style={styles.input}
              value={heightCm}
            />
            <Text style={styles.unit}>cm</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setWeightKg}
              placeholder="74.5"
              returnKeyType="done"
              style={styles.input}
              value={weightKg}
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          <View style={styles.trackingRow}>
            <View style={styles.trackingCopy}>
              <Text style={styles.trackingTitle}>Weight tracking</Text>
              <Text style={styles.trackingText}>Save each weight entry with its timestamp.</Text>
            </View>
            <Switch
              onValueChange={(value) => {
                triggerSelectionHaptic();
                setWeightTrackingEnabled(value);
              }}
              thumbColor={weightTrackingEnabled ? COLORS.surface : COLORS.stopped}
              trackColor={{ false: COLORS.stoppedSoft, true: COLORS.action }}
              value={weightTrackingEnabled}
            />
          </View>

          <View style={styles.bmiPreview}>
            <Text style={styles.bmiLabel}>BMI</Text>
            <Text style={styles.bmiValue}>{bmi > 0 ? bmi.toFixed(1) : '-'}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              onPressIn={triggerSelectionHaptic}
              style={[styles.button, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canSave}
              onPress={handleSave}
              onPressIn={triggerSelectionHaptic}
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
    fontWeight: '900',
  },
  subtitle: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  inputGroup: {
    gap: 7,
  },
  label: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 21,
    fontWeight: '800',
  },
  unit: {
    position: 'absolute',
    right: 14,
    bottom: 16,
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '900',
  },
  trackingRow: {
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  trackingCopy: {
    flex: 1,
    paddingRight: 12,
  },
  trackingTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  trackingText: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  bmiPreview: {
    alignItems: 'center',
    backgroundColor: COLORS.stoppedSoft,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  bmiLabel: {
    color: COLORS.mutedText,
    fontSize: 13,
    fontWeight: '900',
  },
  bmiValue: {
    color: COLORS.action,
    fontSize: 22,
    fontWeight: '900',
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
    backgroundColor: COLORS.button,
  },
  disabledButton: {
    backgroundColor: COLORS.stopped,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
});
