import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function PhoneInputScreen() {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { sendOTP, signInWithGoogle, error, clearError } = useAuthStore();

  // Clear errors when phone changes
  useEffect(() => {
    if (error) clearError();
  }, [phone]);

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    if (cleaned.length <= 10) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
    }
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const numericOnly = text.replace(/\D/g, '');
    if (numericOnly.length <= 10) {
      setPhone(formatPhone(numericOnly));
    }
  };

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/\s/g, '');

    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number');
      return;
    }


    setIsLoading(true);
    const { error: sendError } = await sendOTP(`92${cleanPhone}`);
    setIsLoading(false);

    if (sendError) {
      Alert.alert('Error', sendError.message);

    } else {
      router.push({
        pathname: '/(auth)/otp-verification',
        params: { phone: cleanPhone }
      });
    }
  };

  const handleGoogleSignIn = async () => {
  setIsGoogleLoading(true);
  
  const { error } = await signInWithGoogle();
  
  setIsGoogleLoading(false);

  if (error && error.code !== 'redirect') {
    Alert.alert('Error', error.message);
  } else {
    // For web, the page will redirect - we don't need to navigate
    if (Platform.OS !== 'web') {
      // Check if the user is already authenticated
      const { isAuthenticated, isNewUser } = useAuthStore.getState();
      if (isAuthenticated) {
        if (isNewUser) {
          router.replace('/(auth)/profile-setup');
        } else {
          router.replace('/(player)');
        }
      }
    }
  }
};

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />

      <View className="flex-1 px-6 pt-20">
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
            <Ionicons name="football-outline" size={32} color="#4CAF50" />
          </View>
          <Text className="text-2xl font-bold text-[#1A1A2E]">Welcome to KickOff</Text>
          <Text className="text-[#737373] text-center mt-2 text-base">
            Enter your phone number or continue with Google
          </Text>
        </View>

        {/* Phone Input */}
        <View>
          <Text className="text-[#1A1A2E] font-medium mb-2">Phone Number</Text>
          <View className="flex-row items-center bg-[#F5F5F5] rounded-xl px-4 border border-[#E5E5E5]">
            <Text className="text-[#1A1A2E] font-medium py-4">+92</Text>
            <View className="w-px h-6 bg-[#D4D4D4] mx-3" />
            <TextInput
              className="flex-1 py-4 text-[#1A1A2E] text-base"
              placeholder="331 5139044"
              placeholderTextColor="#A3A3A3"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={13}
              autoFocus={Platform.OS === 'ios'}
              editable={!isLoading}
            />
          </View>
        </View>

        <TouchableOpacity
          className="bg-[#4CAF50] py-4 rounded-full mt-6"
          style={{
            shadowColor: '#4CAF50',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4
          }}
          onPress={handleSendCode}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-semibold text-base">
              Continue with Phone
            </Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View className="flex-row items-center mt-6">
          <View className="flex-1 h-px bg-[#E5E5E5]" />
          <Text className="px-4 text-[#737373] text-sm">or</Text>
          <View className="flex-1 h-px bg-[#E5E5E5]" />
        </View>

        {/* Google Sign In Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center bg-white border border-[#E5E5E5] py-4 rounded-full mt-6"
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading}
          activeOpacity={0.7}
        >
          {isGoogleLoading ? (
            <ActivityIndicator color="#DB4437" />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color="#DB4437" />
              <Text className="text-[#1A1A2E] font-medium ml-3 text-base">
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Error Display */}
        {error && (
          <View className="mt-4 bg-red-50 rounded-xl p-3 border border-red-200">
            <Text className="text-red-500 text-center text-sm">{error.message}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
