import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '@/store/authStore';

export default function SplashScreen() {
  const { isAuthenticated, isNewUser, isLoading ,cleanEvrything  } = useAuthStore();

  useEffect(() => {

    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated) {
        if (isNewUser) {
          // New user needs to complete profile
          router.replace('/(auth)/profile-setup');
        } else {
          // Existing user goes to home
          router.replace('/(player)');
        }
      } else {
        // Not authenticated - show phone input
        router.replace('/(auth)/phone-input');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isNewUser, isLoading]);

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