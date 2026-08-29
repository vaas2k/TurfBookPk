import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingBooking() {
  const [selectedDate, setSelectedDate] = useState(25);
  const [selectedSlot, setSelectedSlot] = useState<string | null>('09:00 PM - 10:00 PM');

  const dates = [
    { day: 'Fri', date: 24 },
    { day: 'Sat', date: 25 },
    { day: 'Sun', date: 26 },
  ];

  const slots = [
    { time: '09:00 PM - 10:00 PM', price: 'PKR 4,500', booked: false },
    { time: '10:00 PM - 11:00 PM', price: 'PKR 4,500', booked: true },
  ];

  const handleNext = () => {
    router.push('/(auth)/onboarding-community');
  };

  const handleSkip = () => {
    router.push('/(auth)/signup-phone');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      <View className="flex-row items-center justify-between px-6 pt-2">
        <Text className="text-2xl font-bold text-[#1A1A2E]">KICKOFF</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text className="text-[#737373] text-base font-medium">Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="mt-6 mx-6 bg-[#F5F5F5] rounded-2xl p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-lg font-bold text-[#1A1A2E]">Total Football Arena</Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="location-outline" size={14} color="#737373" />
                <Text className="text-[#737373] text-sm ml-1">Lahore • Pitch 2</Text>
              </View>
              <View className="bg-[#E8F5E9] px-3 py-1 rounded-full mt-2 self-start">
                <Text className="text-[#4CAF50] text-xs font-medium">5-A-Side</Text>
              </View>
            </View>
            <TouchableOpacity>
              <Ionicons name="heart-outline" size={24} color="#737373" />
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-between mt-4">
            {dates.map((item) => (
              <TouchableOpacity
                key={item.date}
                className={`py-3 px-6 rounded-xl ${
                  selectedDate === item.date ? 'bg-[#4CAF50]' : 'bg-white'
                }`}
                onPress={() => setSelectedDate(item.date)}
              >
                <Text className={`text-center ${selectedDate === item.date ? 'text-white' : 'text-[#1A1A2E]'}`}>
                  {item.day}
                </Text>
                <Text className={`text-center font-bold ${selectedDate === item.date ? 'text-white' : 'text-[#1A1A2E]'}`}>
                  {item.date}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mt-4 space-y-3">
            {slots.map((slot, index) => (
              <TouchableOpacity
                key={index}
                className={`flex-row items-center justify-between p-4 rounded-xl ${
                  slot.booked ? 'bg-[#F5F5F5]' : 
                  selectedSlot === slot.time ? 'bg-[#E8F5E9] border-2 border-[#4CAF50]' : 'bg-white'
                }`}
                onPress={() => !slot.booked && setSelectedSlot(slot.time)}
                disabled={slot.booked}
              >
                <View className="flex-row items-center">
                  <Ionicons 
                    name={slot.booked ? 'lock-closed' : 'time-outline'} 
                    size={20} 
                    color={slot.booked ? '#D4D4D4' : '#4CAF50'} 
                  />
                  <Text className={`ml-3 font-medium ${
                    slot.booked ? 'text-[#D4D4D4]' : 'text-[#1A1A2E]'
                  }`}>
                    {slot.time}
                  </Text>
                </View>
                <Text className={`font-bold ${
                  slot.booked ? 'text-[#D4D4D4]' : 'text-[#1A1A2E]'
                }`}>
                  {slot.booked ? 'Booked' : slot.price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mt-4 bg-white rounded-xl p-4">
            <Text className="text-[#737373] text-sm mb-2">Pay Instantly via:</Text>
            <View className="flex-row space-x-3">
              <View className="bg-[#F5F5F5] px-4 py-2 rounded-lg">
                <Text className="font-medium text-[#1A1A2E]">JazzCash</Text>
              </View>
              <View className="bg-[#F5F5F5] px-4 py-2 rounded-lg">
                <Text className="font-medium text-[#1A1A2E]">Easypaisa</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-8 px-6 items-center">
          <Text className="text-2xl font-bold text-[#1A1A2E] text-center">
            BOOK IN SECONDS
          </Text>
          <Text className="text-[#737373] text-center mt-3 text-base leading-6">
            Pick your ground, choose a slot, pay via JazzCash or Easypaisa — done.
          </Text>
        </View>
      </ScrollView>

      <View className="px-6 pb-8">
        <TouchableOpacity
          className="bg-[#4CAF50] py-4 rounded-full shadow-lg shadow-[#4CAF50]/30"
          onPress={handleNext}
        >
          <Text className="text-white text-center text-base font-semibold">Next </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}