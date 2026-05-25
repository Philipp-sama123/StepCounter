import { StyleProp, ViewStyle } from 'react-native';

import { StepTrackingMode } from '../../health/types';
import { SegmentedTabOption, SegmentedTabs } from '../SegmentedTabs';

export type ChallengeTrackingMode = Extract<StepTrackingMode, 'live' | 'system'>;

const challengeSourceOptions: Array<SegmentedTabOption<ChallengeTrackingMode>> = [
  {
    description: 'Real-time',
    icon: 'walk-outline',
    label: 'Live sensor',
    value: 'live',
  },
  {
    description: 'System total',
    icon: 'fitness-outline',
    label: 'Health data',
    value: 'system',
  },
];

type ChallengeSourceTabsProps = {
  disabled?: boolean;
  onChange: (mode: ChallengeTrackingMode) => void;
  style?: StyleProp<ViewStyle>;
  value: ChallengeTrackingMode;
};

export const ChallengeSourceTabs = ({
  disabled = false,
  onChange,
  style,
  value,
}: ChallengeSourceTabsProps) => (
  <SegmentedTabs
    disabled={disabled}
    onChange={onChange}
    options={challengeSourceOptions}
    style={style}
    value={value}
  />
);
