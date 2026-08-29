import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator,Text } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import '../global.css'

export default function RootLayout() {
  const { isLoading, isAuthenticated,profile, user, checkAuth } = useAuthStore();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  if (!fontsLoaded || isLoading) {
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
              <Text className="text-white/70 text-base text-center">
                Find your ground. Book your game.
              </Text>
            </View>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated === false ? (
          <SafeAreaProvider>
              <Stack.Screen name="auth" />
              {/* <Stack.Screen name="index" /> */}
            </SafeAreaProvider>
        ) : (
          <Stack.Screen name="/(player)" />
        )}
      </Stack>
    </SafeAreaProvider>
  );
}