import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { THEME } from '../../constants';

import { BackgroundGradient } from './BackgroundGradient';

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type AppScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  overlays?: ReactNode;
};

export const AppScreen = ({ children, contentStyle, overlays }: AppScreenProps) => (
  <SafeAreaView style={styles.safeArea}>
    <BackgroundGradient />
    <StatusBar style="light" />
    <ScrollView contentContainerStyle={[styles.content, contentStyle]} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
    {overlays}
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: THEME.color.appBackground,
    flex: 1,
  },
  content: {
    gap: THEME.spacing.sectionGap,
    paddingBottom: THEME.spacing.screenBottom,
    paddingHorizontal: THEME.spacing.screenHorizontal,
    paddingTop: THEME.spacing.screenTop,
  },
});
