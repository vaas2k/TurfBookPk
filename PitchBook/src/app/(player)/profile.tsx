import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)/phone-input');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <View className="bg-white px-6 py-4 border-b border-[#E5E5E5]">
        <Text className="text-2xl font-bold text-[#1A1A2E]">Profile</Text>
      </View>

      <View className="flex-1 px-6 pt-6">
        <View className="bg-white rounded-2xl p-6 items-center">
          <View className="w-24 h-24 rounded-full bg-[#4CAF50] items-center justify-center">
            <Text className="text-4xl font-bold text-white">{profile?.full_name?.charAt(0) || 'U'}</Text>
          </View>
          <Text className="text-xl font-bold text-[#1A1A2E] mt-4">{profile?.full_name || 'User'}</Text>
          <Text className="text-[#737373] text-sm">{profile?.phone || 'No phone'}</Text>
        </View>

        <TouchableOpacity
          className="bg-red-500 py-4 rounded-full mt-6"
          onPress={handleLogout}
        >
          <Text className="text-white text-center font-semibold">Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}