import { View, Text, TouchableOpacity, ScrollView, Platform, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

type BookingStatus = 'upcoming' | 'past' | 'cancelled';

// Mock data - in real app, fetch based on id
const getBookingData = (id: string) => ({
  id,
  ground: 'KICKOFF ARENA',
  type: '5-a-side',
  pitch: 'Pitch 2',
  reference: '#PB-48920',
  date: 'Sat, Oct 12',
  time: '8:00 PM (1 Hour)',
  status: 'upcoming' as BookingStatus,
  checkInCode: 'PB - 48920 - KO',
  amount: 3150,
  breakdown: {
    pitchFee: 3000,
    platformFee: 150,
  },
  groundAddress: 'Plot 42-C, Sector G, Phase 2, DHA, Islamabad',
});

export default function BookingDetail() {
  const { id } = useLocalSearchParams();
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  const booking = getBookingData(id as string);

  const handleCancel = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    setShowCancelModal(false);
    Alert.alert('Booking Cancelled', 'Your booking has been cancelled successfully.');
    router.back();
  };

  const handleKeepBooking = () => {
    setShowCancelModal(false);
  };

  const handleRateGround = () => {
    router.push('/(player)/reviews-write');
  };

  if (booking.status === 'past') {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA]">
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        
        <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">BOOKING DETAILS</Text>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          <View className="mt-6">
            <Text className="text-2xl font-bold font-bold text-[#1A1A2E]">{booking.ground}</Text>
            <Text className="text-[#737373] text-sm font-regular mt-0.5">
              {booking.type} • {booking.pitch}
            </Text>
            <Text className="text-[#737373] text-sm font-regular">Ref: {booking.reference}</Text>
          </View>

          <View className="bg-white rounded-2xl p-4 mt-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
              <Text className="text-[#1A1A2E] text-base font-medium font-medium ml-3">
                {booking.date} • {booking.time}
              </Text>
            </View>
          </View>

          <View className="bg-white rounded-2xl p-4 mt-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">PAYMENT BREAKDOWN</Text>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[#737373] text-sm font-regular">Pitch Booking Fee</Text>
              <Text className="text-[#1A1A2E] text-sm font-medium font-medium">Rs {booking.breakdown.pitchFee}</Text>
            </View>
            <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-[#F5F5F5]">
              <Text className="text-[#737373] text-sm font-regular">Platform Fee</Text>
              <Text className="text-[#1A1A2E] text-sm font-medium font-medium">Rs {booking.breakdown.platformFee}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-[#1A1A2E] text-base font-bold font-bold">Total Paid</Text>
              <Text className="text-[#4CAF50] text-xl font-bold font-bold">Rs {booking.amount}</Text>
            </View>
          </View>

          <TouchableOpacity
            className="bg-[#4CAF50] py-4 rounded-full mt-6 mb-8"
            style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            onPress={handleRateGround}
            activeOpacity={0.7}
          >
            <Text className="text-white text-center font-bold font-bold">Rate this ground</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Upcoming booking view
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">BOOKING DETAILS</Text>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="mt-6">
          <Text className="text-2xl font-bold font-bold text-[#1A1A2E]">{booking.ground}</Text>
          <Text className="text-[#737373] text-sm font-regular mt-0.5">
            {booking.type} • {booking.pitch}
          </Text>
          <Text className="text-[#737373] text-sm font-regular">Ref: {booking.reference}</Text>
        </View>

        {/* Date & Time */}
        <View className="bg-white rounded-2xl p-4 mt-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <View className="flex-row items-center">
            <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
            <Text className="text-[#1A1A2E] text-base font-medium font-medium ml-3">
              {booking.date} • {booking.time}
            </Text>
          </View>
        </View>

        {/* Check-in Code */}
        <View className="bg-[#E8F5E9] rounded-2xl p-4 mt-4 border border-[#4CAF50]">
          <Text className="text-[#737373] text-xs font-regular mb-1">GROUND CHECK-IN CODE</Text>
          <Text className="text-[#4CAF50] text-2xl font-bold font-bold tracking-wider">
            {booking.checkInCode}
          </Text>
        </View>

        {/* Payment Breakdown */}
        <View className="bg-white rounded-2xl p-4 mt-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">PAYMENT BREAKDOWN</Text>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[#737373] text-sm font-regular">Pitch Booking Fee</Text>
            <Text className="text-[#1A1A2E] text-sm font-medium font-medium">Rs {booking.breakdown.pitchFee}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-[#F5F5F5]">
            <Text className="text-[#737373] text-sm font-regular">Platform Fee</Text>
            <Text className="text-[#1A1A2E] text-sm font-medium font-medium">Rs {booking.breakdown.platformFee}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-[#1A1A2E] text-base font-bold font-bold">Total Paid</Text>
            <Text className="text-[#4CAF50] text-xl font-bold font-bold">Rs {booking.amount}</Text>
          </View>
        </View>

        {/* Cancel Button */}
        <TouchableOpacity
          className="bg-[#EF4444] py-4 rounded-full mt-6 mb-8"
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text className="text-white text-center font-bold font-bold">Cancel booking</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cancel Modal Overlay */}
      {showCancelModal && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center px-6">
          <View className="bg-white rounded-3xl p-6 w-full" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }}>
            <View className="items-center">
              <View className="w-16 h-16 rounded-full bg-[#FEE2E2] items-center justify-center mb-4">
                <Ionicons name="alert-circle" size={32} color="#EF4444" />
              </View>
              <Text className="text-[#1A1A2E] text-xl font-bold font-bold text-center">
                CANCEL THIS BOOKING?
              </Text>
              <Text className="text-[#737373] text-center mt-2 text-sm font-regular">
                You'll receive Rs {Math.round(booking.amount * 0.8)} back
              </Text>
              <Text className="text-[#737373] text-center text-sm font-regular">
                80% refund — per the ground's cancellation policy.
              </Text>
            </View>

            <View className="mt-6 space-y-3">
              <TouchableOpacity
                className="bg-[#EF4444] py-4 rounded-full"
                onPress={handleConfirmCancel}
                activeOpacity={0.7}
              >
                <Text className="text-white text-center font-bold font-bold">Confirm cancellation</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                className="py-4 rounded-full"
                onPress={handleKeepBooking}
                activeOpacity={0.7}
              >
                <Text className="text-[#737373] text-center font-medium font-medium">Keep booking</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}