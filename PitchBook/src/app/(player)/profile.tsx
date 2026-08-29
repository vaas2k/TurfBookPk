import { View, Text, TouchableOpacity, ScrollView, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

interface MenuItem {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    console.log('LOGOUT BUTTON PRESSED - Alert should show now');
    
    if (isLoggingOut) {
      console.log('Already logging out, ignoring press');
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => console.log('User cancelled logout')
        },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            console.log('User confirmed logout');
            setIsLoggingOut(true);
            
            try {
              await signOut();
              console.log('SignOut completed, navigating to login...');
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout. Please try again.');
            } finally {
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  };

  const menuItems: MenuItem[] = [
    {
      id: 'wallet',
      title: 'My Wallet & Payments',
      icon: 'wallet-outline',
      onPress: () => {
        console.log('Wallet pressed');
        router.push('/(player)/wallet');
      },
    },
    {
      id: 'phone',
      title: 'Change Mobile Number',
      icon: 'phone-portrait-outline',
      onPress: () => {
        console.log('Change phone pressed');
        Alert.alert('Coming Soon', 'This feature will be available soon');
      },
    },
    {
      id: 'notifications',
      title: 'Notification Alerts',
      icon: 'notifications-outline',
      onPress: () => {
        console.log('Notifications pressed');
        router.push('/(player)/notifications');
      },
    },
    {
      id: 'language',
      title: 'App Language',
      icon: 'globe-outline',
      onPress: () => {
        console.log('Language pressed');
        Alert.alert('Coming Soon', 'Language settings coming soon');
      },
    },
    {
      id: 'help',
      title: 'Help Center & Support',
      icon: 'help-circle-outline',
      onPress: () => {
        console.log('Help pressed');
        router.push('/(player)/help-support');
      },
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5]">
        <Text className="text-2xl font-bold font-bold text-[#1A1A2E]">PROFILE</Text>
      </View>
    
<TouchableOpacity
  className="bg-red-500 mx-4 mt-4 p-4 rounded-xl"
  onPress={() => {
    console.log('TEST BUTTON PRESSED');
    Alert.alert('Test', 'This is a test alert');
  }}
>
  <Text className="text-white text-center font-bold">TEST BUTTON - CLICK ME</Text>
</TouchableOpacity>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="bg-white mx-4 mt-4 rounded-2xl p-6 items-center" 
             style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <View className="w-24 h-24 rounded-full bg-[#4CAF50] items-center justify-center">
            <Text className="text-4xl font-bold font-bold text-white">
              {profile?.full_name?.charAt(0) || 'A'}
            </Text>
          </View>
          <Text className="text-[#1A1A2E] text-xl font-bold font-bold mt-4">
            {profile?.full_name || 'Zayn Ahmed'}
          </Text>
          <Text className="text-[#737373] text-sm font-regular mt-0.5">
            {profile?.phone || '0300 1234567'}
          </Text>
          <TouchableOpacity
            className="mt-4 border border-[#4CAF50] px-6 py-2 rounded-full"
            onPress={() => {
              console.log('Edit Profile pressed');
              router.push('/(player)/profile-edit');
            }}
          >
            <Text className="text-[#4CAF50] font-medium font-medium">Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-4 mx-4">
          <Text className="text-[#737373] text-sm font-medium font-medium uppercase tracking-wider mb-2 px-1">
            ACCOUNT
          </Text>
          <View className="bg-white rounded-2xl overflow-hidden" 
               style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            {menuItems.slice(0, 2).map((item, index) => (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center px-4 py-4 ${index < 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={22} color="#1A1A2E" />
                <Text className="text-[#1A1A2E] text-base font-regular ml-3 flex-1">
                  {item.title}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#D4D4D4" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mt-6 mx-4">
          <Text className="text-[#737373] text-sm font-medium font-medium uppercase tracking-wider mb-2 px-1">
            PREFERENCES
          </Text>
          <View className="bg-white rounded-2xl overflow-hidden" 
               style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            {menuItems.slice(2, 4).map((item, index) => (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center px-4 py-4 ${index < 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={22} color="#1A1A2E" />
                <Text className="text-[#1A1A2E] text-base font-regular ml-3 flex-1">
                  {item.title}
                </Text>
                {item.id === 'language' && (
                  <Text className="text-[#737373] text-sm font-regular mr-2">English</Text>
                )}
                <Ionicons name="chevron-forward" size={20} color="#D4D4D4" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mt-6 mx-4">
          <Text className="text-[#737373] text-sm font-medium font-medium uppercase tracking-wider mb-2 px-1">
            SUPPORT
          </Text>
          <View className="bg-white rounded-2xl overflow-hidden" 
               style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            {menuItems.slice(4).map((item, index) => (
              <TouchableOpacity
                key={item.id}
                className={`flex-row items-center px-4 py-4 ${index < 1 ? 'border-b border-[#F5F5F5]' : ''}`}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={22} color="#1A1A2E" />
                <Text className="text-[#1A1A2E] text-base font-regular ml-3 flex-1">
                  {item.title}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#D4D4D4" />
              </TouchableOpacity>
            ))}
            
            {/* LOGOUT BUTTON - Separate with its own styling */}
            <TouchableOpacity
              className="flex-row items-center px-4 py-4 border-t border-[#F5F5F5]"
              onPress={() => {
                console.log('LOGOUT BUTTON TAPPED DIRECTLY');
                handleLogout();
              }}
              activeOpacity={0.7}
            >
              {isLoggingOut ? (
                <>
                  <ActivityIndicator size="small" color="#EF4444" />
                  <Text className="text-[#EF4444] text-base font-regular ml-3 flex-1">
                    Logging out...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={22} color="#EF4444" />
                  <Text className="text-[#EF4444] text-base font-regular ml-3 flex-1">
                    Log Out
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#D4D4D4" />
                </>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-row items-center px-4 py-4"
              onPress={() => {
                console.log('Delete Account pressed');
                Alert.alert('Delete Account', 'Are you sure you want to delete your account? This action cannot be undone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive' },
                ]);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
              <Text className="text-[#EF4444] text-base font-regular ml-3 flex-1">
                Delete Account
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#D4D4D4" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-6 items-center">
          <Text className="text-[#737373] text-xs font-regular">Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}