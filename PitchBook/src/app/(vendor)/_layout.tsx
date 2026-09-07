import { Stack, usePathname, router } from 'expo-router';
import { View, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';

// Custom Tab Bar Component for Vendor
function VendorTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { switchToPlayer, profile } = useAuthStore();
  const { vendorProfile } = useVendorStore();

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
    { name: 'Home', icon: 'grid', route: '/(vendor)' },
    { name: 'Grounds', icon: 'business', route: '/(vendor)/grounds' },
    { name: 'Bookings', icon: 'calendar', route: '/(vendor)/bookings' },
    { name: 'Earnings', icon: 'wallet', route: '/(vendor)/earnings' },
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
    const path = route.replace('/(vendor)', '');
    router.push(path || '/');
  };

  const handleSwitchToPlayer = async () => {
    Alert.alert(
      'Switch to Player Mode',
      'You will switch back to player view. You can switch back to vendor anytime from the player home screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: async () => {
            const { error } = await switchToPlayer();
            if (error) Alert.alert('Unable to switch modes', error.message);
            else router.replace('/(player)');
          }
        }
      ]
    );
  };

  return (
    <View 
      className="bg-white border-t border-[#E5E5E5]"
      style={{ 
        paddingBottom: Platform.OS === 'ios' ? insets.bottom || 8 : 8,
      }}
    >
      <View className="flex-row items-center justify-around px-2 pt-1">
        {tabs.map((tab) => {
          const active = isActive(tab.route);
          return (
            <TouchableOpacity
              key={tab.name}
              className="items-center justify-center flex-1 py-1"
              onPress={() => handlePress(tab.route)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={active ? tab.icon : `${tab.icon}-outline` as any} 
                size={24} 
                color={active ? '#4CAF50' : '#737373'} 
              />
              <Text 
                className={`text-xs mt-0.5 ${
                  active ? 'text-[#4CAF50] font-medium' : 'text-[#737373]'
                }`}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      
      {/* Switch to Player Button */}
      <TouchableOpacity
        className="flex-row items-center justify-center py-2 mx-4 mt-1 bg-[#F5F5F5] rounded-full border border-[#E5E5E5]"
        onPress={handleSwitchToPlayer}
      >
        <Ionicons name="person-outline" size={16} color="#4CAF50" />
        <Text className="text-[#4CAF50] text-xs font-medium ml-1">Switch to Player</Text>
      </TouchableOpacity>
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
      </Stack>
      <VendorTabBar />
    </View>
  );
}
