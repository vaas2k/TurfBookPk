import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VendorBookings() {
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-[#1A1A2E]">Bookings</Text>
        <Text className="text-[#737373] mt-2 text-center">View all your ground bookings</Text>
      </View>
    </SafeAreaView>
  );
}