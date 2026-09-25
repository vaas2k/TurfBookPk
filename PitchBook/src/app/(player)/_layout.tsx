import { Stack, usePathname, router } from 'expo-router';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Custom Tab Bar Component
function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  // Define which paths should show the tab bar
  const showTabBar = () => {
    // Main routes - show tab bar
    if (pathname === '/' || 
        pathname === '/(player)' || 
        pathname === '/(player)/index' || 
        pathname === '/(player)/search' || 
        pathname === '/(player)/bookings' || 
        pathname === '/(player)/chat' || 
        pathname === '/(player)/profile') {
      return true;
    }
    // Check if it's a main route without the full path
    if (pathname === '/search' || 
        pathname === '/bookings' || 
        pathname === '/chat' || 
        pathname === '/profile') {
      return true;
    }
    return false;
  };

  if (!showTabBar()) {
    return null;
  }

  const tabs = [
    { 
      name: 'Home', 
      icon: 'home', 
      route: '/(player)' 
    },
    { 
      name: 'Search', 
      icon: 'search', 
      route: '/(player)/search' 
    },
    { 
      name: 'Bookings', 
      icon: 'calendar', 
      route: '/(player)/bookings' 
    },
    { 
      name: 'Profile', 
      icon: 'person', 
      route: '/(player)/profile' 
    },
  ];

  const isActive = (route: string) => {
    const cleanRoute = route.replace('/(player)', '');
    const cleanPath = pathname.replace('/(player)', '');
    
    if (route === '/(player)' && (cleanPath === '' || cleanPath === '/' || cleanPath === '/index')) {
      return true;
    }
    return cleanPath === cleanRoute || cleanPath === cleanRoute + '/';
  };

  const handlePress = (route: string) => {
    if (!isActive(route)) {
      router.replace(route as any);
    }
  };

  return (
    <View 
      className="bg-[#1A1C16] border-t border-[#2A3025] flex-row items-center justify-around px-5 pt-2"
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
      {tabs.map((tab) => {
        const active = isActive(tab.route);
        return (
          <TouchableOpacity
            key={tab.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.name}
            className="items-center justify-center flex-1 min-h-[44px] py-1"
            onPress={() => handlePress(tab.route)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={active ? tab.icon : `${tab.icon}-outline` as any} 
              size={26} 
              color={active ? '#3EAF4C' : '#A1A39D'} 
            />
            <Text 
              style={{ fontFamily: 'SpaceGrotesk_500Medium' }} className={`text-[11px] mt-1 ${
                active ? 'text-[#3EAF4C] font-medium' : 'text-[#A1A39D]'
              }`}
            >
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function PlayerLayout() {
  return (
    <View className="flex-1 bg-[#12130F]">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#12130F' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="search" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="ui-test" />
        <Stack.Screen name="design-lab" />
        <Stack.Screen name="ground/[id]" />
        <Stack.Screen name="payment-method" />
        <Stack.Screen name="payment-jazzcash" />
        <Stack.Screen name="payment-easypaisa" />
        <Stack.Screen name="payment-bank-transfer" />
        <Stack.Screen name="payment-processing" />
        <Stack.Screen name="booking-confirmation" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="help-support" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="reviews-write" />
        <Stack.Screen name="profile-edit" />
      </Stack>
      <BottomTabBar />
    </View>
  );
}
