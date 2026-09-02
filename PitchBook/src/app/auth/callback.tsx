import { useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/Supabase/supabase';

export default function AuthCallback() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[Callback] Processing callback...');
        console.log('[Callback] Platform:', Platform.OS);
        
        // For web, we need to handle the callback differently
        if (Platform.OS === 'web') {
          // Get the session
          const { data, error } = await supabase.auth.getSession();
          
          console.log('[Callback] Session data:', data);
          console.log('[Callback] Session error:', error);

          if (error) {
            console.error('[Callback] Session error:', error);
            router.replace('/(auth)/phone-input');
            return;
          }

          if (data.session) {
            console.log('[Callback] Session found!');
            await checkAuth();
            
            const { isAuthenticated, isNewUser } = useAuthStore.getState();
            console.log('[Callback] Auth state:', { isAuthenticated, isNewUser });
            
            if (isAuthenticated) {
              if (isNewUser) {
                router.replace('/(auth)/profile-setup');
              } else {
                router.replace('/(player)');
              }
            } else {
              router.replace('/(auth)/phone-input');
            }
          } else {
            console.log('[Callback] No session found');
            router.replace('/(auth)/phone-input');
          }
          return;
        }

        // Mobile platforms - existing code...
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Callback] Session error:', error);
          router.replace('/(auth)/phone-input');
          return;
        }

        if (data.session) {
          await checkAuth();
          
          const { isAuthenticated, isNewUser } = useAuthStore.getState();
          
          if (isAuthenticated) {
            if (isNewUser) {
              router.replace('/(auth)/profile-setup');
            } else {
              router.replace('/(player)');
            }
          } else {
            router.replace('/(auth)/phone-input');
          }
        } else {
          console.log('[Callback] No session found');
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