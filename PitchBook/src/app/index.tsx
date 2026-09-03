import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';

export default function SplashScreen() {
  const { isAuthenticated, isNewUser, isLoading, user, checkAuth, role } = useAuthStore();
  const { checkVendorStatus, isVendor } = useVendorStore();

  useEffect(() => {
    const init = async () => {
      // Check auth status
      await checkAuth();
      
      // If user is authenticated, check vendor status
      const currentUser = useAuthStore.getState().user;
      const currentRole = useAuthStore.getState().role;
      
      if (currentUser) {
        // Check vendor status (this updates the vendor store)
        await checkVendorStatus(currentUser.id);
      }
    };
    
    init();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated && user) {
        // Get the latest role and vendor status
        const currentRole = useAuthStore.getState().role;
        const isUserVendor = useVendorStore.getState().isVendor;
        
        console.log('[Splash] Current role:', currentRole);
        console.log('[Splash] Is vendor:', isUserVendor);
        
        // If role is 'player', go to player mode even if vendor record exists
        if (currentRole === 'vendor' && isUserVendor) {
          // Only go to vendor if role is explicitly 'vendor'
          router.replace('/(vendor)');
        } else if (isNewUser) {
          // New user needs to complete profile
          router.replace('/(auth)/profile-setup');
        } else {
          // Default to player
          router.replace('/(player)');
        }
      } else {
        // Not authenticated - show phone input
        router.replace('/(auth)/phone-input');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isNewUser, isLoading, user]);

  return (
    <View className="flex-1 items-center justify-center bg-[#1A1A2E]">
      <StatusBar style="light" />
      <View className="items-center">
        <View className="w-24 h-24 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-6">
          <Text className="text-5xl">⚽</Text>
        </View>
        <Text className="text-white text-5xl font-bold tracking-wider">KICKOFF</Text>
        <View className="w-16 h-1 bg-[#4CAF50] rounded-full mt-4" />
      </View>
      <View className="absolute bottom-20 items-center">
        <Text className="text-white/70 text-base">Find your ground. Book your game.</Text>
      </View>
    </View>
  );
}