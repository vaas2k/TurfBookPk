import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

type Role = 'player' | 'vendor' | null;

export default function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const { updateProfile } = useAuthStore();

  const handleContinue = async () => {
    if (!selectedRole) return;

    // Update user role in database
    const error  = await updateProfile({ role: selectedRole });
    
    if (error) {
      console.error('Error updating role:', error);
    }

    // Navigate based on role
    if (selectedRole === 'player') {
      router.replace('/(player)');
    } else if (selectedRole === 'vendor') {
      router.replace('/(vendor)');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      <TouchableOpacity 
        className="px-6 pt-4"
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
      </TouchableOpacity>

      <View className="flex-1 px-6 pt-8">
        <View className="items-center">
          <View className="w-20 h-20 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
            <Ionicons name="people-outline" size={32} color="#4CAF50" />
          </View>
          <Text className="text-2xl font-bold text-[#1A1A2E]">Choose Your Role</Text>
          <Text className="text-[#737373] mt-1 text-center text-base">
            How will you use KickOff?
          </Text>
        </View>

        <View className="mt-10 space-y-4">
          <TouchableOpacity
            className={`border-2 rounded-2xl p-6 ${
              selectedRole === 'player' 
                ? 'border-[#4CAF50] bg-[#E8F5E9]' 
                : 'border-[#E5E5E5]'
            }`}
            onPress={() => setSelectedRole('player')}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <View className="w-14 h-14 rounded-full bg-[#E8F5E9] items-center justify-center">
                <Ionicons name="person-outline" size={28} color="#4CAF50" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-lg font-bold text-[#1A1A2E]">Player</Text>
                <Text className="text-[#737373]">Find and book football grounds</Text>
              </View>
              {selectedRole === 'player' && (
                <View className="w-6 h-6 rounded-full bg-[#4CAF50] items-center justify-center">
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className={`border-2 rounded-2xl p-6 ${
              selectedRole === 'vendor' 
                ? 'border-[#4CAF50] bg-[#E8F5E9]' 
                : 'border-[#E5E5E5]'
            }`}
            onPress={() => setSelectedRole('vendor')}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <View className="w-14 h-14 rounded-full bg-[#E8F5E9] items-center justify-center">
                <Ionicons name="business-outline" size={28} color="#4CAF50" />
              </View>
              <View className="ml-4 flex-1">
                <Text className="text-lg font-bold text-[#1A1A2E]">Ground Vendor</Text>
                <Text className="text-[#737373]">List and manage your grounds</Text>
              </View>
              {selectedRole === 'vendor' && (
                <View className="w-6 h-6 rounded-full bg-[#4CAF50] items-center justify-center">
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View className="mt-10">
          <TouchableOpacity
            className={`py-4 rounded-full ${
              selectedRole ? 'bg-[#4CAF50] shadow-lg shadow-[#4CAF50]/30' : 'bg-[#E5E5E5]'
            }`}
            onPress={handleContinue}
            disabled={!selectedRole}
            activeOpacity={0.7}
          >
            <Text className={`text-center text-base font-semibold ${
              selectedRole ? 'text-white' : 'text-[#737373]'
            }`}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}