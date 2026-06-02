import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from './AuthContext';
import { COLORS } from '../constants';
import { BackgroundGradient } from '../components/layout/BackgroundGradient';
import { missingFirebaseConfigKeys } from '../firebase/config';
import { triggerSelectionHaptic } from '../utils/haptics';

export const LoginScreen = () => {
  const { isConfigured, registerWithEmail, signInWithEmail } = useAuth();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailSubmit = async (): Promise<void> => {
    if (isRegistering && name.trim().length < 2) {
      setError('Enter your name so your account feels like yours.');
      return;
    }

    if (email.trim().length === 0 || password.length < 6) {
      setError('Enter an email and a password with at least 6 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      if (isRegistering) {
        await registerWithEmail(name, email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (authError) {
      logAuthError(authError);
      setError(getFriendlyAuthError(authError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (): Promise<void> => {
    if (email.trim().length === 0) {
      setError('Enter the email address for your account to receive reset instructions.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await sendPasswordReset(email.trim());
      Alert.alert('Password reset', 'If that email is registered, you will receive instructions to reset your password.');
    } catch (err) {
      logAuthError(err);
      setError(getFriendlyAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackgroundGradient />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.appName}>StepCounter</Text>
          <Text style={styles.subtitle}>Sync your daily progress across devices.</Text>
        </View>

        <View style={styles.form}>
          {!isConfigured ? (
            <View style={styles.warning}>
              <Text style={styles.warningTitle}>Firebase is not configured</Text>
              <Text style={styles.warningBody}>Create a local .env file from .env.example and restart Expo.</Text>
              {__DEV__ && missingFirebaseConfigKeys.length > 0 ? (
                <Text style={styles.warningMeta}>{`Missing: ${missingFirebaseConfigKeys.join(', ')}`}</Text>
              ) : null}
            </View>
          ) : null}

          {isRegistering ? (
            <TextInput
              autoCapitalize="words"
              autoComplete="name"
              editable={!isSubmitting && isConfigured}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={COLORS.mutedText}
              style={styles.input}
              value={name}
            />
          ) : null}

          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            editable={!isSubmitting && isConfigured}
            inputMode="email"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={COLORS.mutedText}
            style={styles.input}
            value={email}
          />
          <TextInput
            editable={!isSubmitting && isConfigured}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={COLORS.mutedText}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {error !== null ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={isSubmitting || !isConfigured}
            onPress={() => {
              void handleEmailSubmit();
            }}
            onPressIn={triggerSelectionHaptic}
            style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null, !isConfigured ? styles.disabled : null]}
          >
            {isSubmitting ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.primaryButtonText}>{isRegistering ? 'Create account' : 'Sign in'}</Text>}
          </Pressable>

          <Pressable
            disabled={isSubmitting}
            onPress={() => {
              void handlePasswordReset();
            }}
            onPressIn={triggerSelectionHaptic}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>

          <View style={[styles.googleButton, styles.disabled]}>
            <Text style={styles.googleButtonText}>Google sign-in coming next</Text>
          </View>

          <Pressable
            disabled={isSubmitting}
            onPress={() => {
              setIsRegistering((value) => !value);
              setError(null);
            }}
            onPressIn={triggerSelectionHaptic}
            style={styles.switchMode}
          >
            <Text style={styles.switchModeText}>
              {isRegistering ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const getFriendlyAuthError = (error: unknown): string => {
  const code = getAuthErrorCode(error);
  if (error instanceof Error) {
    const message = error.message.replace('Firebase: ', '').replace(/\s*\(auth\/.*\)\.?$/, '.');
    return code === null ? message : `${message} (${code})`;
  }

  return 'Something went wrong. Please try again.';
};

const getAuthErrorCode = (error: unknown): string | null => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }

  return null;
};

const logAuthError = (error: unknown): void => {
  if (!__DEV__) {
    return;
  }

  if (error instanceof Error) {
    console.error('Firebase auth failed', {
      code: getAuthErrorCode(error),
      message: error.message,
      name: error.name,
    });
    return;
  }

  console.error('Firebase auth failed', error);
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 28,
  },
  header: {
    gap: 8,
  },
  appName: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: '900',
  },
  subtitle: {
    maxWidth: 300,
    color: COLORS.mutedText,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  form: {
    gap: 12,
  },
  input: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 14,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.button,
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  googleButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  googleButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchModeText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  forgotPassword: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  error: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  warning: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
    backgroundColor: COLORS.surface,
    padding: 14,
    gap: 4,
  },
  warningTitle: {
    color: COLORS.warning,
    fontSize: 14,
    fontWeight: '900',
  },
  warningBody: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  warningMeta: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
});
