import { 
  View, Text, TouchableOpacity, ActivityIndicator, 
  TextInput, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { appDialog } from '@/components/ui/app-dialog';
import { goBackOrReplace } from '@/lib/navigation';

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
      appDialog.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    if (!phone) {
      appDialog.alert('Error', 'Phone number not found');
      return;
    }


    setIsVerifying(true);
    const { error: verifyError } = await verifyOTP(`92${phone}`, code);
    setIsVerifying(false);

    if (verifyError) {
      appDialog.alert('Verification Failed', verifyError.message);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } else {
      // Check if user needs profile setup
      const { isNewUser: isNew, lastMode } = useAuthStore.getState();
      
      if (isNew) {
        // New user - go to profile setup
        router.replace('/(auth)/profile-setup');
      } else {
        // Existing user - go to home
        router.replace(lastMode === 'vendor' ? '/(vendor)' : '/(player)');
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
      appDialog.alert('Error', resendError.message);
    } else {
      setTimer(60);
      setCanResend(false);
      appDialog.alert('Code Sent', 'A new verification code has been sent to your phone');
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
  };

  const isComplete = otp.every(d => d !== '');

  return (
    <SafeAreaView className="flex-1 bg-[#12130F]">
      <StatusBar style="light" />
      
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="ml-4 mt-2 h-11 w-11 items-center justify-center rounded-full bg-[#1A1C16] border border-[#34382E]"
        onPress={() => goBackOrReplace('/(auth)/phone-input')}
        activeOpacity={0.7}
      >
        <Ionicons name="arrow-back" size={24} color="#F5F5F0" />
      </TouchableOpacity>

      <View className="flex-1 px-6 pt-10">
        <View className="items-center">
          <View className="w-16 h-16 rounded-2xl bg-[#1A1C16] border border-[#34382E] items-center justify-center mb-4">
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="#3EAF4C" />
          </View>
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 27, letterSpacing: .2 }} className="text-[#F5F5F0] uppercase">Enter code</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_400Regular' }} className="text-[#A1A39D] text-center mt-2 text-base">
            We sent a 6-digit code to +92{phone}
          </Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit phone number" onPress={() => goBackOrReplace('/(auth)/phone-input')} activeOpacity={0.7} className="mt-2 px-3 py-2">
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#3EAF4C]">Edit number</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-10">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputs.current[index] = ref;
              }}
              className={`w-11 h-[52px] bg-[#1A1C16] rounded-xl text-center text-xl font-bold text-[#F5F5F0] border mx-1 ${
                otp[index] ? 'border-[#3EAF4C]' : 'border-[#34382E]'
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
        <Text className="text-[#A1A39D]">Resend in </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0]">
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
          className={`py-4 rounded-full mt-6 ${isComplete ? 'bg-[#3EAF4C]' : 'bg-[#34382E]'}`}
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
