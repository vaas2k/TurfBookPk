import { 
  View, Text, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function SignupPhone() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+92');
  const [isLoading, setIsLoading] = useState(false);
  const { sendOTP } = useAuthStore();

  const formatPhoneNumber = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Pakistan phone numbers are 10 digits (without country code)
    // Format: 3XX XXXXXXX (3-7-7 pattern)
    if (cleaned.length <= 3) {
      return cleaned;
    }
    if (cleaned.length <= 7) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    }
    if (cleaned.length <= 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
    }
    // Max 10 digits for Pakistan phone number
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    // Only allow numeric input, max 10 digits (Pakistan phone number length)
    const numericOnly = text.replace(/\D/g, '');
    // if (numericOnly.length <= 10) {
      setPhoneNumber(formatPhoneNumber(numericOnly));
    // }
  };

  const handleContinue = async () => {
    // Remove spaces to get clean number
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    
    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    // Remove + sign from country code for Supabase
    const cleanCountryCode = countryCode.replace('+', '');
    // Combine country code + phone number (without +)
    const fullPhone = `${cleanCountryCode}${cleanPhone}`;
    
    console.log('Sending OTP to:', fullPhone); // Debug log

    setIsLoading(true);
    const { error } = await sendOTP(fullPhone);
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      router.push({
        pathname: '/(auth)/otp-verification',
        params: { phone: fullPhone }
      });
    }
  };

  const handleGoogleSignup = () => {
    Alert.alert('Coming Soon', 'Google signup will be available soon');
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      <TouchableOpacity 
        className="px-6 pt-4"
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#1A1A2E" />
      </TouchableOpacity>

      <KeyboardAvoidingView 
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <View className="flex-1 px-6 pt-8">
          <View className="items-center">
            <View className="w-20 h-20 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
              <Ionicons name="football-outline" size={32} color="#4CAF50" />
            </View>
            <Text className="text-2xl font-bold text-[#1A1A2E]">CREATE YOUR ACCOUNT</Text>
            <Text className="text-[#737373] mt-1 text-center text-base">
              Enter your phone number to get started
            </Text>
          </View>

          <View className="mt-10">
            <Text className="text-[#1A1A2E] font-medium mb-2">MOBILE NUMBER</Text>
            <View className="flex-row items-center bg-[#F5F5F5] rounded-xl px-4 border border-[#E5E5E5]">
              <TouchableOpacity className="py-4">
                <Text className="text-[#1A1A2E] font-medium">{countryCode}</Text>
              </TouchableOpacity>
              <View className="w-px h-6 bg-[#D4D4D4] mx-3" />
              <TextInput
                className="flex-1 py-4 text-[#1A1A2E] text-base"
                placeholder="331 5139044"
                placeholderTextColor="#A3A3A3"
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                // maxLength={13} // 10 digits + 2 spaces
                autoFocus={Platform.OS === 'ios'}
              />
            </View>
          </View>

          <TouchableOpacity
            className="bg-[#4CAF50] py-4 rounded-full mt-8 shadow-lg shadow-[#4CAF50]/30"
            onPress={handleContinue}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">Continue</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center mt-8">
            <View className="flex-1 h-px bg-[#E5E5E5]" />
            <Text className="px-4 text-[#737373] text-sm">or</Text>
            <View className="flex-1 h-px bg-[#E5E5E5]" />
          </View>

          <TouchableOpacity
            className="flex-row items-center justify-center border border-[#E5E5E5] py-4 rounded-full mt-6"
            onPress={handleGoogleSignup}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={24} color="#DB4437" />
            <Text className="text-[#1A1A2E] font-medium ml-3">Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4 py-3"
            onPress={() => {
              router.replace('/(player)');
            }}
          >
            <Text className="text-[#737373] text-center text-base font-medium">Skip for now</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center mt-4">
            <Text className="text-[#737373]">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text className="text-[#4CAF50] font-semibold">Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}