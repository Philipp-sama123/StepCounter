import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { COLORS } from '../../constants';

export const BackgroundGradient = () => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg height="100%" width="100%">
      <Defs>
        <LinearGradient id="appBackground" x1="0" x2="1" y1="0" y2="1">
          <Stop offset="0" stopColor={COLORS.backgroundGradientStart} />
          <Stop offset="0.48" stopColor={COLORS.backgroundGradientMiddle} />
          <Stop offset="1" stopColor={COLORS.backgroundGradientEnd} />
        </LinearGradient>
      </Defs>
      <Rect fill="url(#appBackground)" height="100%" width="100%" x="0" y="0" />
    </Svg>
  </View>
);
