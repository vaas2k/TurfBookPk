import { View, Text, TouchableOpacity, ScrollView, Platform, StatusBar, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';

export default function BookingConfirmation() {
  const params = useLocalSearchParams<{ ground?: string; address?: string; date?: string; startTime?: string; endTime?: string; amount?: string; bookingNumber?: string }>();
  const bookingDetails = {
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
        message: `I've booked ${bookingDetails.ground} on ${bookingDetails.date} at ${bookingDetails.time}! Join me! ⚽`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleAddToCalendar = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      
      if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];
        
        // Parse date and time
        const eventDate = new Date(`${params.date}T${params.startTime}`);
        const eventEndDate = new Date(`${params.date}T${params.endTime}`);
        
        await Calendar.createEventAsync(defaultCalendar.id, {
          title: `Football at ${bookingDetails.ground}`,
          location: bookingDetails.location,//@ts-ignore
          startDate: eventDate.getTime(),//@ts-ignore
          endDate: eventEndDate.getTime(),
          notes: 'Booked via TurfBookPK',
          alarms: [{ relativeOffset: -30 }],
        });
        
        Alert.alert('Success', 'Event added to your calendar!');
      } else {
        Alert.alert('Permission Denied', 'Please allow calendar access to add events.');
      }
    } catch (error) {
      console.log('Calendar error:', error);
      Alert.alert('Error', 'Failed to add event to calendar');
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
          <View className="w-24 h-24 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-4"
            style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 }}>
            <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />
          </View>
          <Text className="text-2xl font-bold text-[#1A1A2E]">YOU'RE BOOKED!</Text>
          <Text className="text-[#737373] text-center mt-1 text-sm">
            A confirmation SMS is on its way to your squad.
          </Text>
        </View>

        {/* Booking Details Card */}
        <View className="bg-white mx-6 mt-6 rounded-2xl p-6"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}>
          <Text className="text-[#1A1A2E] text-lg font-bold">{bookingDetails.ground}</Text>
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
                <Text className="text-[#737373] text-xs">Amount</Text>
                <Text className="text-[#4CAF50] text-sm font-bold">{bookingDetails.amount}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="px-6 mt-6 mb-8 space-y-3">
          <TouchableOpacity
            className="flex-row items-center justify-center bg-[#4CAF50] py-4 rounded-full"
            style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Share with Squad</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-center bg-white py-4 rounded-full border border-[#4CAF50]"
            onPress={handleAddToCalendar}
          >
            <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
            <Text className="text-[#4CAF50] font-semibold ml-2">Add to Calendar</Text>
          </TouchableOpacity>

          <TouchableOpacity
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