import { Ionicons } from '@expo/vector-icons';
import { Animated, StyleSheet, Text, TextInput, View } from 'react-native';

import { COLORS, THEME } from '../../constants';
import { AppButton } from '../ui/AppButton';
import { SurfacePanel } from '../ui/SurfacePanel';

type ProfileSharingPanelProps = {
  importCode: string;
  importSpin: Animated.Value;
  isImporting: boolean;
  isSharing: boolean;
  onImport: () => void;
  onImportCodeChange: (value: string) => void;
  onPublish: () => void;
  shareCode: string | null;
  shareSpin: Animated.Value;
};

export const ProfileSharingPanel = ({
  importCode,
  importSpin,
  isImporting,
  isSharing,
  onImport,
  onImportCodeChange,
  onPublish,
  shareCode,
  shareSpin,
}: ProfileSharingPanelProps) => (
  <SurfacePanel>
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>Challenge sharing</Text>
        <Text style={styles.text}>Share a read-only code or import another user for comparison.</Text>
      </View>
      <Ionicons color={COLORS.challenge} name="people-outline" size={22} />
    </View>

    {shareCode === null ? null : (
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Your share code</Text>
        <Text style={styles.codeValue}>{shareCode}</Text>
      </View>
    )}

    <AppButton
      accessibilityLabel="Create or refresh share code"
      busy={isSharing}
      label={shareCode === null ? 'Create share code' : 'Refresh shared data'}
      onPress={onPublish}
      variant="warning"
    >
      <Animated.View style={{ transform: [{ rotate: shareSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Ionicons color={COLORS.surface} name={isSharing ? 'sync-outline' : 'share-social-outline'} size={18} />
      </Animated.View>
      <Text style={styles.buttonText}>{isSharing ? 'Publishing...' : shareCode === null ? 'Create share code' : 'Refresh shared data'}</Text>
    </AppButton>

    <View style={styles.importGroup}>
      <Text style={styles.importLabel}>Import someone else</Text>
      <TextInput
        autoCapitalize="characters"
        autoCorrect={false}
        onChangeText={onImportCodeChange}
        placeholder="Import code"
        placeholderTextColor={COLORS.mutedText}
        style={styles.importInput}
        textAlign="center"
        value={importCode}
      />
      <AppButton
        accessibilityLabel="Import share code"
        busy={isImporting}
        label="Import"
        onPress={onImport}
      >
        <Animated.View style={{ transform: [{ rotate: importSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
          <Ionicons color={COLORS.surface} name={isImporting ? 'sync-outline' : 'download-outline'} size={18} />
        </Animated.View>
        <Text style={styles.buttonText}>{isImporting ? 'Importing...' : 'Import'}</Text>
      </AppButton>
    </View>
  </SurfacePanel>
);

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
  },
  text: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 3,
  },
  codeBox: {
    backgroundColor: COLORS.challengeSoft,
    borderColor: COLORS.challenge,
    borderRadius: THEME.radius.panel,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  codeLabel: {
    color: COLORS.challenge,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  codeValue: {
    color: COLORS.challenge,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  buttonText: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '900',
  },
  importGroup: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.panel,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  importLabel: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '900',
  },
  importInput: {
    includeFontPadding: false,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: THEME.radius.control,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    height: 64,
    lineHeight: 28,
    paddingHorizontal: 12,
    paddingVertical: 16,
    textAlignVertical: 'center',
  },
});
