import { View, Text, TouchableOpacity, ScrollView, StatusBar, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';

export default function BookingConfirmation() {
  const params = useLocalSearchParams<{
    bookingId?: string;
    ground?: string;
    address?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    amount?: string;
    bookingNumber?: string;
  }>();

  const hasValidBooking = Boolean(params.bookingId || params.bookingNumber);

  if (!hasValidBooking) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA] justify-center items-center px-6">
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        </View>
        <Text className="text-xl font-bold text-[#1A1A2E] text-center">
          No Booking Details Found
        </Text>
        <Text className="text-[#737373] text-center mt-2 text-sm leading-5">
          We could not find an active confirmed booking for this session. You can check all your active and past reservations in your bookings tab.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace('/(player)/bookings')}
          className="mt-6 bg-[#4CAF50] rounded-full px-8 py-3.5"
        >
          <Text className="text-white font-bold">Go to My Bookings</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const bookingDetails = {
    bookingNumber: params.bookingNumber || 'N/A',
    ground: params.ground || 'Ground',
    location: params.address || 'Address unavailable',
    date: params.date || 'Date unavailable',
    time: `${params.startTime || ''} - ${params.endTime || ''}`,
    type: 'Ground slot',
    amount: `PKR ${params.amount || '0'}`,
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I've booked ${bookingDetails.ground} on ${bookingDetails.date} at ${bookingDetails.time}! Join me! ⚽ (Booking #${bookingDetails.bookingNumber})`,
      });
    } catch {
      // Ignore user dismissal
    }
  };

  const handleAddToCalendar = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();

      if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];

        const eventDate = new Date(`${params.date}T${params.startTime}`);
        const eventEndDate = new Date(`${params.date}T${params.endTime}`);

        await Calendar.createEventAsync(defaultCalendar.id, {
          title: `Football at ${bookingDetails.ground}`,
          location: bookingDetails.location,
          startDate: eventDate,
          endDate: eventEndDate,
          notes: `Booked via TurfBookPK. Booking Number: ${bookingDetails.bookingNumber}`,
          alarms: [{ relativeOffset: -30 }],
        });

        Alert.alert('Success', 'Event added to your calendar!');
      } else {
        Alert.alert('Permission Denied', 'Please allow calendar access in settings to add events.');
      }
    } catch {
      Alert.alert('Error', 'Failed to add event to calendar.');
    }
  };

  const handleBackHome = () => {
    router.replace('/(player)');
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View className="items-center pt-8 px-6">
          <View
            className="w-24 h-24 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-4"
            style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 }}
          >
            <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />
          </View>
          <Text className="text-2xl font-bold text-[#1A1A2E]">YOU'RE BOOKED!</Text>
          <Text className="text-[#737373] text-center mt-1 text-sm">
            Your slot has been secured. See you on the pitch!
          </Text>
        </View>

        {/* Booking Details Card */}
        <View
          className="bg-white mx-6 mt-6 rounded-2xl p-6 border border-[#E5E5E5]"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 }}
        >
          <View className="flex-row items-center justify-between pb-3 border-b border-[#F5F5F5]">
            <Text className="text-[#737373] text-xs uppercase tracking-wider font-semibold">Booking ID</Text>
            <Text className="text-[#1A1A2E] text-xs font-mono font-bold">{bookingDetails.bookingNumber}</Text>
          </View>

          <Text className="text-[#1A1A2E] text-xl font-bold mt-4">{bookingDetails.ground}</Text>
          <Text className="text-[#737373] text-sm mt-0.5">{bookingDetails.location}</Text>

          <View className="mt-4 pt-4 border-t border-[#F5F5F5]">
            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 rounded-full bg-[#F5F5F5] items-center justify-center">
                <Ionicons name="calendar-outline" size={18} color="#737373" />
              </View>
              <View className="ml-3">
                <Text className="text-[#737373] text-xs">Date</Text>
                <Text className="text-[#1A1A2E] text-sm font-semibold">{bookingDetails.date}</Text>
              </View>
            </View>

            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 rounded-full bg-[#F5F5F5] items-center justify-center">
                <Ionicons name="time-outline" size={18} color="#737373" />
              </View>
              <View className="ml-3">
                <Text className="text-[#737373] text-xs">Time</Text>
                <Text className="text-[#1A1A2E] text-sm font-semibold">{bookingDetails.time}</Text>
              </View>
            </View>

            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 rounded-full bg-[#F5F5F5] items-center justify-center">
                <Ionicons name="football-outline" size={18} color="#737373" />
              </View>
              <View className="ml-3">
                <Text className="text-[#737373] text-xs">Type</Text>
                <Text className="text-[#1A1A2E] text-sm font-semibold">{bookingDetails.type}</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-[#F5F5F5] items-center justify-center">
                <Ionicons name="cash-outline" size={18} color="#737373" />
              </View>
              <View className="ml-3">
                <Text className="text-[#737373] text-xs">Amount Paid</Text>
                <Text className="text-[#4CAF50] text-sm font-bold">{bookingDetails.amount}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="px-6 mt-6 mb-8">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Share booking with squad"
            className="flex-row items-center justify-center bg-[#4CAF50] py-4 rounded-full mb-3"
            style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 }}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={20} color="white" />
            <Text className="text-white font-bold ml-2">Share with Squad</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add booking to calendar"
            className="flex-row items-center justify-center bg-white py-4 rounded-full border border-[#4CAF50] mb-3"
            onPress={handleAddToCalendar}
          >
            <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
            <Text className="text-[#4CAF50] font-bold ml-2">Add to Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            className="flex-row items-center justify-center py-4 rounded-full"
            onPress={handleBackHome}
          >
            <Text className="text-[#737373] font-medium">Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
