import { View, Text, TouchableOpacity, ScrollView, StatusBar, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { appDialog } from '@/components/ui/app-dialog';

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
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F] justify-center items-center px-6">
        <StatusBar barStyle="light-content" backgroundColor="#10120F" />
        <View className="w-20 h-20 rounded-full bg-[#20251D] items-center justify-center mb-4">
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        </View>
        <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 30 }} className="text-[#F8F7F0] text-center">
          No Booking Details Found
        </Text>
        <Text className="text-[#AFAFA9] text-center mt-2 text-sm leading-5">
          We could not find an active confirmed booking for this session. You can check all your active and past reservations in your bookings tab.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.replace('/(player)/bookings')}
          className="mt-6 bg-[#3DB54A] rounded-full px-8 py-3.5"
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

        appDialog.alert('Success', 'Event added to your calendar!');
      } else {
        appDialog.alert('Permission Denied', 'Please allow calendar access in settings to add events.');
      }
    } catch {
      appDialog.alert('Error', 'Failed to add event to calendar.');
    }
  };

  const handleBackHome = () => {
    router.replace('/(player)');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View className="items-center pt-16 px-6">
          <View
            className="w-28 h-28 rounded-full border-[3px] border-[#3DB54A] bg-[#142017] items-center justify-center mb-8"
            style={{ shadowColor: '#3DB54A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 4 }}
          >
            <Ionicons name="checkmark-circle" size={58} color="#3DB54A" />
          </View>
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 30, letterSpacing: 0.3 }} className="text-[#F8F7F0]">YOU'RE BOOKED!</Text>
          <Text className="text-[#AFAFA9] text-center mt-3 text-[15px]">
            A confirmation SMS is on its way to your squad.
          </Text>
        </View>

        {/* Booking Details Card */}
        <View
          className="bg-[#181C16] mx-6 mt-2 rounded-[26px] p-5 border border-[#244A29]"
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-[18px]">{bookingDetails.ground}</Text>
          <Text className="text-[#AFAFA9] text-base mt-1">{bookingDetails.location} • {bookingDetails.type}</Text>

          <View className="mt-5 pt-5 border-t border-[#30372C] space-y-3">
            <View className="flex-row"><Text className="text-[#AFAFA9] text-base w-20">Date</Text><Text className="text-[#F8F7F0] text-base font-bold flex-1">{bookingDetails.date}</Text></View>
            <View className="flex-row"><Text className="text-[#AFAFA9] text-base w-20">Time</Text><Text className="text-[#F8F7F0] text-base font-bold flex-1">{bookingDetails.time}</Text></View>
            <View className="flex-row"><Text className="text-[#AFAFA9] text-base w-20">Type</Text><Text className="text-[#3DB54A] text-base font-bold flex-1">5-a-side</Text></View>
            <View className="flex-row"><Text className="text-[#AFAFA9] text-base w-20">Amount</Text><Text className="text-[#F5A623] text-base font-bold flex-1">{bookingDetails.amount}</Text></View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="px-6 mt-12 mb-8">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Share booking with squad"
            className="flex-row items-center justify-center bg-[#3DB54A] py-5 rounded-full mb-4"
            style={{ shadowColor: '#3DB54A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 }}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={20} color="white" />
            <Text className="text-white font-bold text-xl ml-2">Share with Squad</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add booking to calendar"
            className="flex-row items-center justify-center py-4 rounded-full border-2 border-[#F5A623] mb-3"
            onPress={handleAddToCalendar}
          >
            <Ionicons name="calendar-outline" size={20} color="#F5A623" />
            <Text className="text-[#F5A623] font-bold text-xl ml-2">Add to Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            className="flex-row items-center justify-center py-4 rounded-full"
            onPress={handleBackHome}
          >
            <Text className="text-[#AFAFA9] font-medium text-lg">Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
