import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { Ionicons } from '@expo/vector-icons';

export default function PlayerHome() {
  const { profile, signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/phone-input');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-4">
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-[#737373] text-sm">Welcome back,</Text>
            <Text className="text-2xl font-bold text-[#1A1A2E]">
              {profile?.full_name || 'Player'}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center">
          <Text className="text-2xl font-bold text-[#1A1A2E]">Welcome to KickOff!</Text>
          <Text className="text-[#737373] mt-2 text-center">
            Find and book football grounds near you
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}