import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentJazzCash() {
  const [phoneNumber, setPhoneNumber] = useState('300 1234567');
  const [isLoading, setIsLoading] = useState(false);
  const [timer] = useState(600);

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    if (cleaned.length <= 10) {
      if (cleaned.length > 4) {
        setPhoneNumber(`${cleaned.slice(0, 3)} ${cleaned.slice(3)}`);
      } else {
        setPhoneNumber(cleaned);
      }
    }
  };

  const handleSendRequest = () => {
    if (phoneNumber.replace(/\s/g, '').length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      setIsLoading(false);
      router.push('/(player)/payment-processing');
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-[#1A1A2E] ml-3">JAZZCASH PAYMENT</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-6">
          {/* Icon */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 rounded-2xl bg-[#E91E63] items-center justify-center"
              style={{ shadowColor: '#E91E63', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
              <Text className="text-white text-2xl font-bold">JC</Text>
            </View>
          </View>

          {/* Phone Input */}
          <View className="bg-white rounded-2xl p-6"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#1A1A2E] text-base font-semibold mb-2">MOBILE NUMBER</Text>
            <Text className="text-[#737373] text-sm mb-4">
              Enter your JazzCash registered mobile number to receive a secure payment request.
            </Text>
            
            <View className="flex-row items-center bg-[#F5F5F5] rounded-xl px-4 border border-[#E5E5E5]">
              <Text className="text-[#1A1A2E] font-medium py-4">+92</Text>
              <View className="w-px h-6 bg-[#D4D4D4] mx-3" />
              <TextInput
                className="flex-1 py-4 text-[#1A1A2E] text-base"
                placeholder="300 1234567"
                placeholderTextColor="#A3A3A3"
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={11}
                autoFocus={Platform.OS === 'ios'}
              />
            </View>
          </View>

          {/* Amount */}
          <View className="bg-white rounded-2xl p-6 mt-4"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[#737373] text-sm">TOTAL AMOUNT</Text>
              <Text className="text-[#1A1A2E] text-2xl font-bold">RS 3,150</Text>
            </View>
          </View>

          {/* How it works */}
          <View className="bg-white rounded-2xl p-6 mt-4"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#1A1A2E] text-base font-semibold mb-3">How it works</Text>
            <View className="space-y-3">
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#4CAF50] font-bold text-xs">1</Text>
                </View>
                <Text className="text-[#737373] text-sm ml-3 flex-1">
                  Submit your JazzCash mobile number above.
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#4CAF50] font-bold text-xs">2</Text>
                </View>
                <Text className="text-[#737373] text-sm ml-3 flex-1">
                  You will receive a direct push-popup payment prompt.
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#4CAF50] font-bold text-xs">3</Text>
                </View>
                <Text className="text-[#737373] text-sm ml-3 flex-1">
                  Enter your JazzCash MPIN to approve the transaction.
                </Text>
              </View>
            </View>
          </View>

          {/* Timer */}
          <View className="bg-white rounded-2xl p-4 mt-4 flex-row items-center justify-between"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                <Ionicons name="timer-outline" size={18} color="#EF4444" />
              </View>
              <Text className="text-[#737373] text-sm ml-2">Complete request within</Text>
            </View>
            <Text className="text-[#EF4444] font-bold">{formatTime(timer)}</Text>
          </View>
        </View>

        <View className="h-8" />
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 pt-4 pb-6">
        <TouchableOpacity
          className={`py-4 rounded-full ${isLoading ? 'bg-[#E5E5E5]' : 'bg-[#4CAF50]'}`}
          style={!isLoading ? { 
            shadowColor: '#4CAF50', 
            shadowOffset: { width: 0, height: 4 }, 
            shadowOpacity: 0.3, 
            shadowRadius: 8, 
            elevation: 4 
          } : {}}
          onPress={handleSendRequest}
          disabled={isLoading}
        >
          <Text className={`text-center font-bold text-base ${isLoading ? 'text-[#737373]' : 'text-white'}`}>
            {isLoading ? 'Processing...' : 'Send Payment Request'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}