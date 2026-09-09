import { 
  View, Text, TouchableOpacity, ActivityIndicator, 
  Alert, TextInput, Keyboard 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function OTPVerificationScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { verifyOTP, sendOTP, clearError, error, isNewUser, checkAuth } = useAuthStore();

  useEffect(() => {
    inputs.current = Array(6).fill(null);
    setTimeout(() => inputs.current[0]?.focus(), 300);
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  // Clear errors when OTP changes
  useEffect(() => {
    if (error) clearError();
  }, [otp]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '');
    if (digit.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    if (!phone) {
      Alert.alert('Error', 'Phone number not found');
      return;
    }


    setIsVerifying(true);
    const { error: verifyError } = await verifyOTP(`92${phone}`, code);
    setIsVerifying(false);

    if (verifyError) {
      Alert.alert('Verification Failed', verifyError.message);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } else {
      // Check if user needs profile setup
      const isNew = useAuthStore.getState().isNewUser;
      
      if (isNew) {
        // New user - go to profile setup
        router.replace('/(auth)/profile-setup');
      } else {
        // Existing user - go to home
        router.replace('/(player)');
      }
    }
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;

    setIsLoading(true);
    const { error: resendError } = await sendOTP(phone);
    setIsLoading(false);

    if (resendError) {
      // console.log('[OTPVerification] Error resending OTP:', resendError);
      Alert.alert('Error', resendError.message);
    } else {
      setTimer(60);
      setCanResend(false);
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
  };

  const isComplete = otp.every(d => d !== '');

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

      <View className="flex-1 px-6 pt-10">
        <View className="items-center">
          <View className="w-20 h-20 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="#4CAF50" />
          </View>
          <Text className="text-2xl font-bold text-[#1A1A2E]">Enter Code</Text>
          <Text className="text-[#737373] text-center mt-2 text-base">
            We sent a 6-digit code to +92{phone}
          </Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text className="text-[#4CAF50] font-medium mt-1">Edit Number</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-10">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputs.current[index] = ref;
              }}
              className={`w-12 h-14 bg-[#F5F5F5] rounded-xl text-center text-2xl font-bold text-[#1A1A2E] border mx-1.5 ${
                otp[index] ? 'border-[#4CAF50]' : 'border-[#E5E5E5]'
              }`}
              maxLength={1}
              keyboardType="number-pad"
              value={otp[index]}
              onChangeText={text => handleChange(text, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              selectionColor="#4CAF50"
              editable={!isVerifying}
            />
          ))}
        </View>

        <View className="flex-row justify-center mt-6">
          <Text className="text-[#737373]">Resend in </Text>
          <Text className="text-[#1A1A2E] font-medium">
            {String(Math.floor(timer / 60)).padStart(2, '0')}:{String(timer % 60).padStart(2, '0')}
          </Text>
        </View>

        {canResend && (
          <TouchableOpacity 
            className="mt-2" 
            onPress={handleResend}
            disabled={isLoading || isVerifying}
            activeOpacity={0.7}
          >
            <Text className="text-[#4CAF50] text-center font-medium">Resend Code</Text>
          </TouchableOpacity>
        )}

        {error && (
          <View className="mt-4 bg-red-50 rounded-xl p-3 border border-red-200">
            <Text className="text-red-500 text-center text-sm">{error.message}</Text>
          </View>
        )}

        <TouchableOpacity
          className={`py-4 rounded-full mt-6 ${isComplete ? 'bg-[#4CAF50]' : 'bg-[#E5E5E5]'}`}
          style={isComplete ? { 
            shadowColor: '#4CAF50', 
            shadowOffset: { width: 0, height: 4 }, 
            shadowOpacity: 0.3, 
            shadowRadius: 8, 
            elevation: 4 
          } : {}}
          onPress={handleVerify}
          disabled={!isComplete || isVerifying}
          activeOpacity={0.7}
        >
          {isVerifying ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className={`text-center font-semibold text-base ${isComplete ? 'text-white' : 'text-[#737373]'}`}>
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
