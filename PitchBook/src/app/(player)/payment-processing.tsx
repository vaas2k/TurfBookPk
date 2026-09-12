import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

type ProcessingStatus = 'processing' | 'success';

export default function PaymentProcessing() {
  const [status, setStatus] = useState<ProcessingStatus>('processing');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStatus('success');
    }, 2500);

    return () => clearTimeout(timeout);
  }, []);

  const handleDone = () => {
    router.replace('/(player)/bookings');
  };

  const handleBack = () => {
    goBackOrReplace('/(player)/payment-method');
  };

  if (status === 'processing') {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA]">
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-6">
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>

          <Text className="text-2xl font-bold text-[#1A1A2E] text-center">
            PROCESSING DEMO PAYMENT
          </Text>
          <Text className="text-[#737373] text-center mt-3 text-sm leading-5">
            Connecting to test payment network. Please do not close the app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      <View className="flex-1 px-6 justify-center items-center">
        <View className="w-24 h-24 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />
        </View>

        <Text className="text-2xl font-bold text-[#1A1A2E] text-center">
          DEMO TRANSACTION FINISHED
        </Text>
        <Text className="text-[#737373] text-center mt-2 text-sm max-w-xs">
          This payment simulator is designed for interface preview. Active bookings must be confirmed via standard checkout.
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleDone}
          className="w-full bg-[#4CAF50] py-4 rounded-full mt-8 items-center"
        >
          <Text className="text-white font-bold text-base">View My Bookings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleBack}
          className="w-full py-3 mt-3 items-center"
        >
          <Text className="text-[#737373] font-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
