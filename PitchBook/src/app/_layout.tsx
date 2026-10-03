import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import {useVendorStore} from '@/store/vendorStore';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { BigShouldersDisplay_700Bold, BigShouldersDisplay_800ExtraBold } from '@expo-google-fonts/big-shoulders-display';
import { getApiConfigurationError } from '@/lib/api/client';
import { AppDialogHost } from '@/components/ui/app-dialog';
import { useAppearanceStore } from '@/store/appearanceStore';
import { colorScheme } from 'nativewind';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { listenForNotificationResponses, registerForPushNotifications } from '@/lib/notifications';
import { registerPushToken } from '@/lib/api/notifications';

//@ts-ignore
import '../global.css';

const TextWithDefaults = Text as typeof Text & { defaultProps?: { style?: unknown } };
TextWithDefaults.defaultProps = {
  ...TextWithDefaults.defaultProps,
  style: [{ fontFamily: 'SpaceGrotesk_400Regular' }, TextWithDefaults.defaultProps?.style],
};

export default function RootLayout() {
  const configurationError = getApiConfigurationError();
  const { checkAuth } = useAuthStore();
  const currentUser = useAuthStore((state) => state.user);
  const currentRole = useAuthStore((state) => state.role);
  const router = useRouter();
  const { checkVendorStatus } = useVendorStore();
  const [isReady, setIsReady] = useState(false);
  const appearance = useAppearanceStore((state) => state.appearance);

  useEffect(() => {
    colorScheme.set(appearance);
  }, [appearance]);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    BigShouldersDisplay_700Bold,
    BigShouldersDisplay_800ExtraBold,
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

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    void registerForPushNotifications().then(async (token) => {
      if (active && token) await registerPushToken(token, Platform.OS);
    }).catch(() => undefined);
    return listenForNotificationResponses((data) => {
      if (data.destination === 'vendor_verification') {
        router.push('/(player)/profile?openVendorVerification=1' as never);
        return;
      }
      if (data.destination === 'ground_verification') {
        router.push({ pathname: '/(vendor)/ground-verification', params: { id: data.groundId || data.ground_id || '' } } as never);
        return;
      }
      const bookingId = data.bookingId;
      if (!bookingId) return;
      const group = currentRole === 'vendor' ? 'vendor' : 'player';
      router.push(`/(${group})/booking/${bookingId}` as never);
    });
  }, [currentRole, currentUser, router]);

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
      <StatusBar style={appearance === 'dark' ? 'light' : 'dark'} />
      <Slot />
      <AppDialogHost />
    </SafeAreaProvider>
  );
}
