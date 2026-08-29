import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function PaymentEasypaisa() {
  const [phoneNumber, setPhoneNumber] = useState('345 1234567');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timer, setTimer] = useState(600);

  useEffect(() => {
    if (timer > 0 && isSubmitting) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, isSubmitting]);

  const handleSendRequest = () => {
    if (phoneNumber.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);
    setTimer(600);

    setTimeout(() => {
      router.push('/(player)/payment-processing');
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="px-6 pt-4 pb-4 flex-row items-center border-b border-[#E5E5E5] bg-white">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">EASYPAISA PAYMENT</Text>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
      >
        <View className="px-4 pt-6">
          {/* Easypaisa Logo */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 rounded-2xl bg-[#00BCD4] items-center justify-center"
                 style={{ shadowColor: '#00BCD4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}>
              <Text className="text-white text-2xl font-bold font-bold">EP</Text>
            </View>
          </View>

          {/* Phone Input */}
          <View className="bg-white rounded-2xl p-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#1A1A2E] text-base font-semibold font-semibold mb-2">
              MOBILE NUMBER
            </Text>
            <Text className="text-[#737373] text-sm font-regular mb-4">
              Enter your Easypaisa registered mobile number to receive a secure payment request.
            </Text>
            
            <View className="flex-row items-center bg-[#F5F5F5] rounded-xl px-4 border border-[#E5E5E5]">
              <Text className="text-[#1A1A2E] font-medium font-medium py-4">+92</Text>
              <View className="w-px h-6 bg-[#D4D4D4] mx-3" />
              <TextInput
                className="flex-1 py-4 text-[#1A1A2E] text-base font-regular"
                placeholder="345 1234567"
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
          <View className="bg-white rounded-2xl p-6 mt-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[#737373] text-sm font-regular">TOTAL AMOUNT</Text>
              <Text className="text-[#1A1A2E] text-2xl font-bold font-bold">RS 3,150</Text>
            </View>
          </View>

          {/* How it works */}
          <View className="bg-white rounded-2xl p-6 mt-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#1A1A2E] text-base font-semibold font-semibold mb-3">How it works</Text>
            <View className="space-y-3">
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#4CAF50] font-bold font-bold text-xs">1</Text>
                </View>
                <Text className="text-[#737373] text-sm font-regular ml-3 flex-1">
                  Enter your Easypaisa number
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#4CAF50] font-bold font-bold text-xs">2</Text>
                </View>
                <Text className="text-[#737373] text-sm font-regular ml-3 flex-1">
                  You'll receive a payment request on your phone
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#4CAF50] font-bold font-bold text-xs">3</Text>
                </View>
                <Text className="text-[#737373] text-sm font-regular ml-3 flex-1">
                  Approve the payment in your Easypaisa app
                </Text>
              </View>
            </View>
          </View>

          {/* Timer */}
          {isSubmitting && (
            <View className="bg-white rounded-2xl p-4 mt-4 flex-row items-center justify-between"
                 style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                  <Ionicons name="timer-outline" size={18} color="#EF4444" />
                </View>
                <Text className="text-[#737373] text-sm font-regular ml-2">Complete request within</Text>
              </View>
              <Text className="text-[#EF4444] font-bold font-bold">{formatTime(timer)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 pt-4 pb-6">
        <TouchableOpacity
          className={`py-4 rounded-full ${!isSubmitting ? 'bg-[#4CAF50]' : 'bg-[#E5E5E5]'}`}
          style={!isSubmitting ? { shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
          onPress={handleSendRequest}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text className={`text-center font-bold font-bold ${!isSubmitting ? 'text-white' : 'text-[#737373]'}`}>
            {isSubmitting ? 'Requesting...' : 'Send Payment Request'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}