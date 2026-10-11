import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export default function BottomNav() {
  const pathname = usePathname();

  const items = [
    { label: 'אזור אישי', icon: 'person-outline', path: '/profile' },
    { label: 'חוקים', icon: 'document-text-outline', path: '/rules' },
    { label: 'טבלה', icon: 'trophy-outline', path: '/leaderboard' },
    { label: 'בית', icon: 'home-outline', path: '/' },
  ] as const;

  return (
    <View
      style={{
        height: 60,
        marginHorizontal: 18,
        marginBottom: 6,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: '#1E6B3A',
        backgroundColor: '#101312',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {items.map((item) => {
        const active = pathname === item.path;

        return (
          <TouchableOpacity
            key={item.path}
            onPress={() => router.replace(item.path as Href)}
            style={{
              flex: 1,
              height: 48,
              marginHorizontal: 5,
              borderRadius: 16,
              backgroundColor: active ? '#073D20' : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={active && item.path === '/' ? 'home' : item.icon}
              size={23}
              color={active ? '#00E676' : '#888888'}
            />
            <Text
              style={{
                color: active ? '#00E676' : '#AAAAAA',
                fontSize: 10,
                fontWeight: active ? '900' : '400',
                marginTop: 2,
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}