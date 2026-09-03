import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useEffect,useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {useVendorStore} from '@/store/vendorStore';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

//@ts-ignore
import '../global.css';

export default function RootLayout() {
  const { isLoading, isAuthenticated, user, checkAuth } = useAuthStore();
  const { checkVendorStatus } = useVendorStore();
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const init = async () => {
      // Check auth
      await checkAuth();
      
      // If user is authenticated, check vendor status
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        await checkVendorStatus(currentUser.id);
      }
      
      setIsReady(true);
    };
    init();
  }, []);

  if (!fontsLoaded || !isReady || isLoading) {
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