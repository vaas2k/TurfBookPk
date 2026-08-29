import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileSetup() {
  const [fullName, setFullName] = useState('Zain Malik');
  const [city, setCity] = useState('');
  const [position, setPosition] = useState('');
  const [preferredFoot, setPreferredFoot] = useState<string>('');

  const handleComplete = () => {
    router.replace('/(player)');
  };

  const handleSkip = () => {
    router.replace('/(player)');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          className="px-6 pt-4"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>

        <View className="px-6 pt-4 pb-8">
          <Text className="text-2xl font-bold text-[#1A1A2E] text-center">SET UP YOUR PROFILE</Text>
          <Text className="text-[#737373] text-center mt-1">Tell us a bit about yourself</Text>

          <TouchableOpacity className="items-center mt-8">
            <View className="w-24 h-24 rounded-full bg-[#F5F5F5] items-center justify-center border-2 border-[#E5E5E5] border-dashed">
              <Ionicons name="camera-outline" size={32} color="#4CAF50" />
            </View>
            <Text className="text-[#4CAF50] font-medium mt-2">Add photo</Text>
          </TouchableOpacity>

          <View className="mt-8 space-y-5">
            <View>
              <Text className="text-[#1A1A2E] font-medium mb-2">FULL NAME</Text>
              <TextInput
                className="bg-[#F5F5F5] rounded-xl px-4 py-4 text-[#1A1A2E] text-base border border-[#E5E5E5]"
                placeholder="Enter your full name"
                placeholderTextColor="#A3A3A3"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View>
              <Text className="text-[#1A1A2E] font-medium mb-2">CITY</Text>
              <TouchableOpacity className="bg-[#F5F5F5] rounded-xl px-4 py-4 flex-row items-center justify-between border border-[#E5E5E5]">
                <Text className={`text-base ${city ? 'text-[#1A1A2E]' : 'text-[#A3A3A3]'}`}>
                  {city || 'Select your city'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#737373" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-[#1A1A2E] font-medium mb-2">PREFERRED POSITION</Text>
              <TextInput
                className="bg-[#F5F5F5] rounded-xl px-4 py-4 text-[#1A1A2E] text-base border border-[#E5E5E5]"
                placeholder="Striker, Midfielder, etc."
                placeholderTextColor="#A3A3A3"
                value={position}
                onChangeText={setPosition}
              />
            </View>

            <View>
              <Text className="text-[#1A1A2E] font-medium mb-2">Preferred Foot</Text>
              <View className="flex-row space-x-3">
                {['Left', 'Right', 'Both'].map((foot) => (
                  <TouchableOpacity
                    key={foot}
                    className={`flex-1 py-3 rounded-xl border ${
                      preferredFoot === foot 
                        ? 'bg-[#E8F5E9] border-[#4CAF50]' 
                        : 'bg-[#F5F5F5] border-[#E5E5E5]'
                    }`}
                    onPress={() => setPreferredFoot(foot)}
                  >
                    <Text className={`text-center font-medium ${
                      preferredFoot === foot ? 'text-[#4CAF50]' : 'text-[#737373]'
                    }`}>
                      {foot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="bg-[#4CAF50] py-4 rounded-full mt-8 shadow-lg shadow-[#4CAF50]/30"
            onPress={handleComplete}
          >
            <Text className="text-white text-center text-base font-semibold">Complete signup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4 py-3"
            onPress={handleSkip}
          >
            <Text className="text-[#737373] text-center text-base font-medium">Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}