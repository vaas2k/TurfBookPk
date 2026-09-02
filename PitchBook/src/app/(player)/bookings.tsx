import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BookingsScreen() {
  const bookings = [
    {
      id: '1',
      ground: 'Arena 11 Sports',
      date: 'Sat, 16 Aug 2026',
      time: '7:00 PM - 8:00 PM',
      status: 'confirmed',
      type: '5-a-side',
    },
    {
      id: '2',
      ground: 'Total Football',
      date: 'Mon, 18 Aug 2026',
      time: '9:00 PM - 10:00 PM',
      status: 'pending',
      type: '5-a-side',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-[#4CAF50] bg-[#E8F5E9]';
      case 'pending': return 'text-[#F59E0B] bg-[#FEF3C7]';
      case 'completed': return 'text-[#3B82F6] bg-[#EFF6FF]';
      case 'cancelled': return 'text-[#EF4444] bg-[#FEE2E2]';
      default: return 'text-[#737373] bg-[#F5F5F5]';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5]">
        <Text className="text-2xl font-bold text-[#1A1A2E]">MY BOOKINGS</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
        {bookings.length > 0 ? (
          bookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              className="bg-white rounded-2xl p-4 mb-3"
              style={{ 
                shadowColor: '#000', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.04, 
                shadowRadius: 8, 
                elevation: 2 
              }}
              onPress={() => router.push(`/booking/${booking.id}`)}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-[#1A1A2E] text-base font-bold">{booking.ground}</Text>
                  <Text className="text-[#737373] text-sm mt-0.5">{booking.type}</Text>
                  <Text className="text-[#1A1A2E] text-sm mt-2">
                    {booking.date} • {booking.time}
                  </Text>
                </View>
                <View className={`px-3 py-1.5 rounded-full ${getStatusColor(booking.status)}`}>
                  <Text className={`text-xs font-medium uppercase ${getStatusColor(booking.status).split(' ')[0]}`}>
                    {booking.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View className="flex-1 items-center justify-center py-12">
            <Ionicons name="calendar-outline" size={64} color="#D4D4D4" />
            <Text className="text-[#1A1A2E] text-xl font-bold mt-4">No Bookings Yet</Text>
            <Text className="text-[#737373] text-center mt-2">
              Find a ground and book your first match
            </Text>
            <TouchableOpacity 
              className="mt-6 bg-[#4CAF50] px-6 py-3 rounded-full"
              onPress={() => router.push('/(player)')}
            >
              <Text className="text-white font-medium">Discover grounds</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}