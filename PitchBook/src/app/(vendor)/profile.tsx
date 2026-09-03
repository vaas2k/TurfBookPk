import { View, Text, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { Ionicons } from '@expo/vector-icons';

export default function VendorProfile() {
  const { profile, signOut, switchToPlayer } = useAuthStore();
  const { vendorProfile } = useVendorStore();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const handleSwitchToPlayer = () => {
    Alert.alert(
      'Switch to Player Mode',
      'You will switch back to player view. You can switch back to vendor anytime from the player home screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: async () => {
            await switchToPlayer();
            router.replace('/(player)');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-[#E5E5E5]">
        <Text className="text-2xl font-bold text-[#1A1A2E]">Vendor Profile</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View className="mx-4 mt-4 bg-white rounded-2xl p-6 items-center"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          
          <View className="w-24 h-24 rounded-full bg-[#4CAF50] items-center justify-center">
            <Text className="text-4xl font-bold text-white">
              {vendorProfile?.business_name?.charAt(0) || profile?.full_name?.charAt(0) || 'V'}
            </Text>
          </View>
          
          <Text className="text-xl font-bold text-[#1A1A2E] mt-4">
            {vendorProfile?.business_name || profile?.full_name || 'Vendor'}
          </Text>
          
          <Text className="text-[#737373] text-sm mt-0.5">
            {vendorProfile?.business_phone || profile?.phone || 'No phone'}
          </Text>
          
          <View className="flex-row items-center mt-2">
            <View className="bg-[#E8F5E9] px-3 py-1 rounded-full">
              <Text className="text-[#4CAF50] text-xs font-medium">Vendor</Text>
            </View>
            {vendorProfile?.is_verified === false && (
              <View className="bg-[#FEF3C7] px-3 py-1 rounded-full ml-2">
                <Text className="text-[#F59E0B] text-xs font-medium">Pending Verification</Text>
              </View>
            )}
          </View>

          {vendorProfile?.business_city && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="location-outline" size={16} color="#737373" />
              <Text className="text-[#737373] text-sm ml-1">{vendorProfile.business_city}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View className="mx-4 mt-4 flex-row space-x-3">
          <View className="flex-1 bg-white rounded-2xl p-4 items-center"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#737373] text-xs">Total Earnings</Text>
            <Text className="text-[#4CAF50] text-xl font-bold mt-1">
              Rs {vendorProfile?.total_earnings || 0}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 items-center"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#737373] text-xs">Rating</Text>
            <View className="flex-row items-center mt-1">
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text className="text-xl font-bold text-[#1A1A2E] ml-1">
                {vendorProfile?.rating || 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Switch to Player Button */}
        <View className="mx-4 mt-6">
          <TouchableOpacity
            className="flex-row items-center justify-center bg-[#E8F5E9] py-4 rounded-xl border border-[#4CAF50]"
            onPress={handleSwitchToPlayer}
          >
            <Ionicons name="person-outline" size={20} color="#4CAF50" />
            <Text className="text-[#4CAF50] font-semibold ml-2">Switch to Player Mode</Text>
          </TouchableOpacity>
          <Text className="text-[#737373] text-xs text-center mt-2">
            Switch back to player view to book grounds
          </Text>
        </View>

        {/* Logout Button */}
        <View className="mx-4 mt-6 mb-8">
          <TouchableOpacity
            className="bg-red-500 py-4 rounded-full"
            style={{ shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            onPress={handleLogout}
          >
            <Text className="text-white text-center font-semibold">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}