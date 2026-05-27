import { Platform, Vibration } from 'react-native';

const isWeb = Platform.OS === 'web';

export const triggerSelectionHaptic = (): void => {
  if (isWeb) {
    return;
  }

  Vibration.vibrate(8);
};

export const triggerSuccessHaptic = (): void => {
  if (isWeb) {
    return;
  }

  Vibration.vibrate([0, 12, 36, 16]);
};

export const triggerErrorHaptic = (): void => {
  if (isWeb) {
    return;
  }

  Vibration.vibrate([0, 24, 36, 24]);
};
