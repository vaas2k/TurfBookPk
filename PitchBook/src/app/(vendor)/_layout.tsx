import { Stack, usePathname, router } from 'expo-router';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Custom Tab Bar Component for Vendor
function VendorTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  const showTabBar = () => {
    const mainRoutes = [
      '/(vendor)',
      '/(vendor)/index',
      '/(vendor)/grounds',
      '/(vendor)/bookings',
      '/(vendor)/earnings',
      '/(vendor)/profile',
    ];
    return mainRoutes.includes(pathname) || pathname === '/(vendor)';
  };

  if (!showTabBar()) return null;

  const tabs = [
    { name: 'Overview', icon: 'grid', route: '/(vendor)' },
    { name: 'Grounds', icon: 'business', route: '/(vendor)/grounds' },
    { name: 'Schedule', icon: 'calendar', route: '/(vendor)/bookings' },
    { name: 'Money', icon: 'wallet', route: '/(vendor)/earnings' },
    { name: 'Profile', icon: 'person', route: '/(vendor)/profile' },
  ];

  const isActive = (route: string) => {
    const cleanRoute = route.replace('/(vendor)', '');
    const cleanPath = pathname.replace('/(vendor)', '');
    
    if (route === '/(vendor)' && (cleanPath === '' || cleanPath === '/' || cleanPath === '/index')) {
      return true;
    }
    return cleanPath === cleanRoute;
  };

  const handlePress = (route: string) => {
    if (!isActive(route)) {
      router.replace(route as any);
    }
  };

  return (
    <View 
      className="bg-white border-t border-[#E5E5E5]"
      style={{ 
        paddingBottom: bottomPadding,
        minHeight: 64 + bottomPadding,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: Platform.OS === 'ios' ? 0.06 : 0.12,
        shadowRadius: 8,
        elevation: 10,
      }}
    >
      <View className="flex-row items-center justify-around px-2 pt-2">
        {tabs.map((tab) => {
          const active = isActive(tab.route);
          return (
            <TouchableOpacity
              key={tab.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.name}
              className={`items-center justify-center flex-1 min-h-[44px] rounded-2xl py-1 ${active ? 'bg-[#E8F5E9]' : ''}`}
              onPress={() => handlePress(tab.route)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={active ? tab.icon : `${tab.icon}-outline` as any} 
                size={24} 
                color={active ? '#4CAF50' : '#737373'} 
              />
              <Text 
                className={`text-[11px] mt-0.5 ${
                  active ? 'text-[#4CAF50] font-medium' : 'text-[#737373]'
                }`}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function VendorLayout() {
  return (
    <View className="flex-1 bg-[#F8F9FA]">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8F9FA' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="grounds" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="add-ground" />
        <Stack.Screen name="ground-slots" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="edit-profile" />
      </Stack>
      <VendorTabBar />
    </View>
  );
}
