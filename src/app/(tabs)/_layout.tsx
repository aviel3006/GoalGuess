import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import AdBanner from '../../components/ad-banner';
import BottomNav from '../../components/BottomNav';
export default function TabsLayout() {
  return (
    <Tabs
    // Back (the rules screen's arrow, Android's back button) returns to the tab you came from
    backBehavior="history"
    tabBar={() => (
  <View style={{ backgroundColor: '#000000', paddingBottom: 6 }}>
    <AdBanner />
    <BottomNav />
  </View>
)}
      screenOptions={{
       
        headerShown: false,
        tabBarActiveTintColor: '#58F49A',
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: {
            display: 'none',
  backgroundColor: '#0B1510',
  borderWidth: 1,
  borderColor: '#16834A',
  borderTopWidth: 1,
  borderRadius: 24,
  height: 72,
  marginHorizontal: 16,
  marginBottom: 8,
  paddingBottom: 8,
  paddingTop: 6,
},
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'בית',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="rules"
        options={{
          title: 'חוקים',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'דירוג',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
  name="profile"
  options={{
    title: 'אזור אישי',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="person-outline" size={size} color={color} />
    ),
  }}
/>
    </Tabs>
  );
}