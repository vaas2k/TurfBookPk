import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {useVendorStore} from '@/store/vendorStore';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { getApiConfigurationError } from '@/lib/api/client';

//@ts-ignore
import '../global.css';

export default function RootLayout() {
  const configurationError = getApiConfigurationError();
  const { checkAuth } = useAuthStore();
  const { checkVendorStatus } = useVendorStore();
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (configurationError) {
      setIsReady(true);
      return;
    }
    const init = async () => {
      try {
        await checkAuth();
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          await checkVendorStatus(currentUser.id);
        }
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, [checkAuth, checkVendorStatus, configurationError]);

  if (configurationError) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 items-center justify-center bg-white px-8" accessibilityRole="alert">
          <Text className="text-xl font-bold text-[#1A1A2E] text-center">App configuration required</Text>
          <Text className="text-[#737373] text-center mt-3 leading-6">{configurationError}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!fontsLoaded || !isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Slot />
    </SafeAreaProvider>
  );
}
