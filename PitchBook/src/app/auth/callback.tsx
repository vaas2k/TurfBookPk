import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function AuthCallback() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await checkAuth();
        const { isAuthenticated, isNewUser } = useAuthStore.getState();
        if (isAuthenticated) {
          router.replace(isNewUser ? '/(auth)/profile-setup' : '/(player)');
        } else {
          router.replace('/(auth)/phone-input');
        }
      } catch (error) {
        console.error('[Callback] Error:', error);
        router.replace('/(auth)/phone-input');
      }
    };

    handleCallback();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#4CAF50" />
      <Text className="mt-4 text-[#737373]">Completing sign in...</Text>
    </View>
  );
}