import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, THEME } from '../constants';

import { AnimatedPressable } from './AnimatedPressable';

import type { StyleProp, ViewStyle } from 'react-native';

export type SegmentedTabOption<T extends string> = {
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value: T;
};

type SegmentedTabsProps<T extends string> = {
  disabled?: boolean;
  onChange: (value: T) => void;
  options: SegmentedTabOption<T>[];
  style?: StyleProp<ViewStyle>;
  value: T;
};

export const SegmentedTabs = <T extends string>({
  disabled = false,
  onChange,
  options,
  style,
  value,
}: SegmentedTabsProps<T>) => (
  <View style={[styles.track, disabled ? styles.disabled : null, style]}>
    {options.map((option) => {
      const isSelected = option.value === value;

      return (
        <AnimatedPressable
          accessibilityLabel={`Select ${option.label}`}
          accessibilityRole="tab"
          disabled={disabled}
          key={option.value}
          onPress={() => {
            if (option.value !== value) {
              onChange(option.value);
            }
          }}
          style={[styles.tab, isSelected ? styles.selectedTab : null]}
        >
          {option.icon ? (
            <Ionicons
              color={isSelected ? THEME.color.tabSelectedText : THEME.color.tabText}
              name={option.icon}
              size={16}
            />
          ) : null}
          <View style={styles.copy}>
            <Text style={[styles.label, isSelected ? styles.selectedLabel : null]}>{option.label}</Text>
            {option.description ? (
              <Text style={[styles.description, isSelected ? styles.selectedDescription : null]} numberOfLines={1}>
                {option.description}
              </Text>
            ) : null}
          </View>
        </AnimatedPressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  track: {
    backgroundColor: THEME.color.tabBackground,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 4,
    minHeight: 48,
    padding: 4,
    width: '100%',
  },
  disabled: {
    opacity: 0.72,
  },
  tab: {
    alignItems: 'center',
    borderRadius: 6,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  selectedTab: {
    backgroundColor: COLORS.progressOverflowStart,
  },
  copy: {
    flexShrink: 1,
  },
  label: {
    color: THEME.color.tabText,
    fontSize: 12,
    fontWeight: '900',
  },
  selectedLabel: {
    color: THEME.color.tabSelectedText,
  },
  description: {
    color: THEME.color.tabInactive,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  selectedDescription: {
    color: THEME.color.tabSelectedText,
  },
});
