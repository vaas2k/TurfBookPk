import { View, Text, TouchableOpacity, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';

type ProcessingStatus = 'processing' | 'success' | 'failed';

export default function PaymentProcessing() {
  const [status, setStatus] = useState<ProcessingStatus>('processing');
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    // Simulate processing
    const timeout = setTimeout(() => {
      // Random success/failure for demo
      const success = Math.random() > 0.3;
      setStatus(success ? 'success' : 'failed');
      if (success) {
        setTimer(5); // Start countdown to confirmation
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (status === 'success' && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    if (status === 'success' && timer === 0) {
      // Navigate to confirmation
      router.replace('/(player)/booking-confirmation');
    }
  }, [timer, status]);

  const handleTryAgain = () => {
    router.back();
  };

  const handleDifferentMethod = () => {
    router.push('/(player)/payment-method');
  };

  if (status === 'processing') {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA]">
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-6">
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
          
          <Text className="text-2xl font-bold font-bold text-[#1A1A2E] text-center">
            PROCESSING PAYMENT
          </Text>
          <Text className="text-[#737373] text-center mt-3 text-sm font-regular leading-5">
            Verifying transaction status with JazzCash securely. Please do not close or minimize the app.
          </Text>
          <Text className="text-[#737373] text-center mt-4 text-xs font-regular">
            This usually takes a few seconds...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'failed') {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA]">
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        
        <View className="flex-1 px-6">
          <View className="flex-1 items-center justify-center">
            <View className="w-24 h-24 rounded-full bg-red-50 items-center justify-center mb-6">
              <Ionicons name="close-circle" size={56} color="#EF4444" />
            </View>
            
            <Text className="text-2xl font-bold font-bold text-[#1A1A2E] text-center">
              PAYMENT FAILED
            </Text>
            <Text className="text-[#737373] text-center mt-2 text-sm font-regular">
              The transaction could not be authorized. Your booking is not secured.
            </Text>

            <View className="w-full bg-white rounded-2xl p-6 mt-8" 
                 style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
              <Text className="text-[#1A1A2E] text-sm font-semibold font-semibold mb-2">ERROR REASON</Text>
              <Text className="text-[#737373] text-sm font-regular leading-5">
                Transaction Timed Out — The payment request was not approved on your JazzCash app within the required 10-minute window.
              </Text>
            </View>

            <View className="w-full bg-[#F5F5F5] rounded-xl p-4 mt-4">
              <Text className="text-[#737373] text-sm font-regular text-center">
                Your selected slot at <Text className="text-[#1A1A2E] font-medium font-medium">Green Valley</Text> remains available for 5 minutes.
              </Text>
            </View>
          </View>

          <View className="pb-8 space-y-3">
            <TouchableOpacity
              className="py-4 rounded-full bg-[#4CAF50]"
              style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
              onPress={handleTryAgain}
              activeOpacity={0.7}
            >
              <Text className="text-white text-center font-bold font-bold">Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="py-4 rounded-full bg-white border border-[#E5E5E5]"
              onPress={handleDifferentMethod}
              activeOpacity={0.7}
            >
              <Text className="text-[#1A1A2E] text-center font-medium font-medium">Choose Different Method</Text>
            </TouchableOpacity>

            <TouchableOpacity className="py-2">
              <Text className="text-[#4CAF50] text-center font-medium font-medium">Contact Support {'>'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Success state - transitioning to confirmation
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-24 h-24 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-6">
          <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />
        </View>
        
        <Text className="text-2xl font-bold font-bold text-[#1A1A2E] text-center">
          PAYMENT SUCCESSFUL!
        </Text>
        <Text className="text-[#737373] text-center mt-2 text-sm font-regular">
          Your booking is confirmed. Redirecting to confirmation...
        </Text>
        <Text className="text-[#4CAF50] text-center mt-4 font-bold font-bold">{timer}s</Text>
      </View>
    </SafeAreaView>
  );
}