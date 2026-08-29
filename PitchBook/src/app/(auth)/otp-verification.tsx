import { 
  View, Text, TextInput, TouchableOpacity, 
  Alert, ActivityIndicator, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function OTPVerification() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const { verifyOTP, sendOTP } = useAuthStore();

  useEffect(() => {
    inputRefs.current = Array(6).fill(null);
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleOtpChange = (text: string, index: number) => {
    // Only allow single digit
    const digit = text.replace(/\D/g, '');
    
    // If user pastes multiple digits, handle it
    if (digit.length > 1) {
      // Handle paste: distribute digits across inputs
      const digits = digit.split('').slice(0, 6 - index);
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) {
          newOtp[index + i] = d;
        }
      });
      setOtp(newOtp);
      
      // Focus on the next empty input or last filled
      const lastFilledIndex = Math.min(index + digits.length - 1, 5);
      if (lastFilledIndex < 5) {
        inputRefs.current[lastFilledIndex + 1]?.focus();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input if digit entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace to go to previous input
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
      } else if (otp[index]) {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length < 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    if (!phone) {
      Alert.alert('Error', 'Phone number not found');
      return;
    }

    setIsLoading(true);
    const { error } = await verifyOTP(phone, otpString);
    setIsLoading(false);

    if (error) {
      Alert.alert('Verification Failed', error);
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } else {
      router.replace('/(auth)/role-selection');
    }
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;

    setIsLoading(true);
    const { error } = await sendOTP(phone);
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      setTimer(60);
      setCanResend(false);
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone');
    }
  };

  const handleEditPhone = () => {
    router.back();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

      <View className="flex-1 px-6 pt-12">
        <View className="items-center">
          <View className="w-20 h-20 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="#4CAF50" />
          </View>
          <Text className="text-2xl font-bold text-[#1A1A2E]">ENTER YOUR CODE</Text>
          <Text className="text-[#737373] mt-2 text-center text-base">
            We sent a 6-digit code to {phone}
          </Text>
          <TouchableOpacity onPress={handleEditPhone}>
            <Text className="text-[#4CAF50] font-medium mt-1">Edit</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-10">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              className={`w-12 h-14 bg-[#F5F5F5] rounded-xl text-center text-2xl font-bold text-[#1A1A2E] border ${
                otp[index] ? 'border-[#4CAF50]' : 'border-[#E5E5E5]'
              } mx-1.5`}
              maxLength={6}
              keyboardType="number-pad"
              value={otp[index]}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              autoFocus={index === 0 && Platform.OS === 'ios'}
              textContentType="oneTimeCode"
            />
          ))}
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="text-[#737373]">Resend code in </Text>
          <Text className="text-[#1A1A2E] font-medium">
            {formatTime(timer)}
          </Text>
        </View>

        {canResend && (
          <TouchableOpacity 
            className="mt-2"
            onPress={handleResend}
            disabled={isLoading}
          >
            <Text className="text-[#4CAF50] font-medium text-center">
              Resend Code
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className={`py-4 rounded-full mt-10 ${
            otp.every((digit) => digit !== '') 
              ? 'bg-[#4CAF50] shadow-lg shadow-[#4CAF50]/30' 
              : 'bg-[#E5E5E5]'
          }`}
          onPress={handleVerify}
          disabled={!otp.every((digit) => digit !== '') || isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`text-center text-base font-semibold ${
              otp.every((digit) => digit !== '') ? 'text-white' : 'text-[#737373]'
            }`}>
              Verify
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}