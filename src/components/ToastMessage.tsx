import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { COLORS } from '../constants';

export type ToastMessageItem = {
  id: number;
  message: string;
  variant?: 'error' | 'standard' | 'success';
};

type ToastStackProps = {
  messages: ToastMessageItem[];
  onHide: (id: number) => void;
  placement?: 'bottom' | 'center' | 'top';
};

type ToastItemProps = {
  index: number;
  item: ToastMessageItem;
  onHide: (id: number) => void;
  placement: 'bottom' | 'center' | 'top';
};

export const ToastStack = ({ messages, onHide, placement = 'top' }: ToastStackProps) => (
  <>
    {messages.map((message, index) => (
      <ToastItem index={index} item={message} key={message.id} onHide={onHide} placement={placement} />
    ))}
  </>
);

const ToastItem = ({ index, item, onHide, placement }: ToastItemProps) => {
  const translateY = useRef(new Animated.Value(getInitialOffset(placement))).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateY.setValue(getInitialOffset(placement));
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        damping: 16,
        stiffness: 180,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 180,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();

    const hideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          duration: 220,
          toValue: getInitialOffset(placement),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 220,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start(() => onHide(item.id));
    }, 5000);

    return () => {
      clearTimeout(hideTimer);
    };
  }, [item.id, onHide, opacity, placement, translateY]);

  const stackPosition = getStackPosition(placement, index);

  return (
    <Animated.View style={[styles.toast, styles[item.variant ?? 'success'], stackPosition, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{item.message}</Text>
    </Animated.View>
  );
};

const getInitialOffset = (placement: 'bottom' | 'center' | 'top'): number => {
  if (placement === 'top') {
    return -28;
  }

  if (placement === 'bottom') {
    return 28;
  }

  return 0;
};

const getStackPosition = (placement: 'bottom' | 'center' | 'top', index: number) => {
  if (placement === 'top') {
    return { top: 12 + index * 62 };
  }

  if (placement === 'bottom') {
    return { bottom: 18 + index * 62 };
  }

  return { top: '44%' as const, marginTop: index * 62 };
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  error: {
    backgroundColor: COLORS.danger,
  },
  standard: {
    backgroundColor: COLORS.stopped,
  },
  success: {
    backgroundColor: COLORS.action,
  },
  text: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
