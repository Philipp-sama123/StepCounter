import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { LoginScreen } from '../src/auth/LoginScreen';
import { COLORS, THEME } from '../src/constants';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const RootNavigator = () => {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (user === null) {
    return <LoginScreen />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.color.tabActive,
        tabBarInactiveTintColor: THEME.color.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '900',
        },
        tabBarStyle: {
          backgroundColor: THEME.color.tabBackground,
          borderTopColor: THEME.color.tabBackground,
          minHeight: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="analytics-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          title: 'Challenge',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="walk-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="calendar-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: 'Shared',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="people-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          title: 'Debug',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="bug-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="challenge-history"
        options={{
          title: 'Sessions',
          href: null,
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="list-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons color={color} name="person-circle-outline" size={size} />,
        }}
      />
    </Tabs>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.color.appBackground,
  },
});
