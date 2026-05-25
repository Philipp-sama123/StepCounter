import { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { THEME } from '../../constants';

type AppScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  overlays?: ReactNode;
};

export const AppScreen = ({ children, contentStyle, overlays }: AppScreenProps) => (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar style="dark" />
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
