import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { COLORS } from '../constants';

export type ToastMessageItem = {
  id: number;
  message: string;
};

type ToastStackProps = {
  messages: ToastMessageItem[];
  onHide: (id: number) => void;
  placement?: 'bottom' | 'top';
};

type ToastItemProps = {
  index: number;
  item: ToastMessageItem;
  onHide: (id: number) => void;
  placement: 'bottom' | 'top';
};

export const ToastStack = ({ messages, onHide, placement = 'top' }: ToastStackProps) => (
  <>
    {messages.map((message, index) => (
      <ToastItem index={index} item={message} key={message.id} onHide={onHide} placement={placement} />
    ))}
  </>
);

const ToastItem = ({ index, item, onHide, placement }: ToastItemProps) => {
  const translateY = useRef(new Animated.Value(placement === 'top' ? -28 : 28)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateY.setValue(placement === 'top' ? -28 : 28);
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
          toValue: placement === 'top' ? -28 : 28,
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

  const stackPosition = placement === 'top' ? { top: 12 + index * 62 } : { bottom: 18 + index * 62 };

  return (
    <Animated.View style={[styles.toast, stackPosition, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.text}>{item.message}</Text>
    </Animated.View>
  );
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
    backgroundColor: COLORS.action,
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  text: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
});
