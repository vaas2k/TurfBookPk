import { View, Text, TouchableOpacity, ScrollView, Image, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

type PaymentMethod = 'jazzcash' | 'easypaisa' | 'bank' | null;

export default function PaymentMethodSelection() {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);

  const paymentMethods = [
    {
      id: 'jazzcash',
      name: 'JazzCash',
      icon: '📱',
      description: 'Mobile Wallet',
      color: '#E91E63',
    },
    {
      id: 'easypaisa',
      name: 'Easypaisa',
      icon: '📱',
      description: 'Mobile Wallet',
      color: '#00BCD4',
    },
    {
      id: 'bank',
      name: 'Bank Transfer',
      icon: '🏦',
      description: 'Direct bank payment',
      color: '#4CAF50',
    },
  ];

  const bookingDetails = {
    ground: 'GREEN VALLEY SPORTS',
    pitch: 'Pitch 1',
    date: '14 June 2026',
    time: '4:00 PM – 5:00 PM (1 Hour)',
    type: '5-a-side • Artificial Turf',
    slotFee: 3000,
    platformFee: 150,
  };

  const handlePay = () => {
    if (!selectedMethod) return;

    switch (selectedMethod) {
      case 'jazzcash':
        router.push('/(player)/payment-jazzcash');
        break;
      case 'easypaisa':
        router.push('/(player)/payment-easypaisa');
        break;
      case 'bank':
        router.push('/(player)/payment-bank-transfer');
        break;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View className="px-6 pt-4 pb-4 flex-row items-center border-b border-[#E5E5E5] bg-white">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">PAYMENT METHOD</Text>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
      >
        {/* Booking Summary */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="text-[#1A1A2E] text-base font-bold font-bold">{bookingDetails.ground}</Text>
          <Text className="text-[#737373] text-sm font-regular mt-0.5">{bookingDetails.pitch}</Text>
          
          <View className="mt-3 pt-3 border-t border-[#F5F5F5]">
            <View className="flex-row items-center mb-1.5">
              <View className="w-6 h-6 rounded-full bg-red-50 items-center justify-center">
                <Text className="text-red-500 text-sm">🔴</Text>
              </View>
              <Text className="text-[#1A1A2E] text-sm font-medium font-medium ml-2">{bookingDetails.date}</Text>
            </View>
            <View className="flex-row items-center mb-1.5">
              <View className="w-6 h-6 rounded-full bg-green-50 items-center justify-center">
                <Text className="text-green-500 text-sm">⚽</Text>
              </View>
              <Text className="text-[#1A1A2E] text-sm font-medium font-medium ml-2">{bookingDetails.time}</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-6 h-6 rounded-full bg-blue-50 items-center justify-center">
                <Text className="text-blue-500 text-sm">🏀</Text>
              </View>
              <Text className="text-[#1A1A2E] text-sm font-medium font-medium ml-2">{bookingDetails.type}</Text>
            </View>
          </View>
        </View>

        {/* Payment Methods */}
        <View className="mt-6 px-4">
          <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">SELECT PAYMENT METHOD</Text>
          
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              className={`flex-row items-center p-4 rounded-2xl mb-3 bg-white border-2 ${
                selectedMethod === method.id ? 'border-[#4CAF50]' : 'border-transparent'
              }`}
              style={{ 
                shadowColor: '#000', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.04, 
                shadowRadius: 8, 
                elevation: 2 
              }}
              onPress={() => setSelectedMethod(method.id as PaymentMethod)}
              activeOpacity={0.7}
            >
              <View 
                className="w-12 h-12 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${method.color}15` }}
              >
                <Text className="text-2xl">{method.icon}</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[#1A1A2E] text-base font-semibold font-semibold">{method.name}</Text>
                <Text className="text-[#737373] text-sm font-regular">{method.description}</Text>
              </View>
              {selectedMethod === method.id && (
                <View className="w-6 h-6 rounded-full bg-[#4CAF50] items-center justify-center">
                  <Ionicons name="checkmark" size={16} color="white" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Price Breakdown */}
        <View className="bg-white mx-4 mt-4 rounded-2xl p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">PRICE BREAKDOWN</Text>
          
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[#737373] text-sm font-regular">Slot Fee</Text>
            <Text className="text-[#1A1A2E] text-sm font-medium font-medium">Rs {bookingDetails.slotFee}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-[#F5F5F5]">
            <Text className="text-[#737373] text-sm font-regular">Platform Fee</Text>
            <Text className="text-[#1A1A2E] text-sm font-medium font-medium">Rs {bookingDetails.platformFee}</Text>
          </View>
          
          <View className="flex-row items-center justify-between">
            <Text className="text-[#1A1A2E] text-base font-bold font-bold">Total Amount</Text>
            <Text className="text-[#1A1A2E] text-xl font-bold font-bold text-[#4CAF50]">
              RS {bookingDetails.slotFee + bookingDetails.platformFee}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 pt-4 pb-6">
        <TouchableOpacity
          className={`py-4 rounded-full ${selectedMethod ? 'bg-[#4CAF50]' : 'bg-[#E5E5E5]'}`}
          style={selectedMethod ? { 
            shadowColor: '#4CAF50', 
            shadowOffset: { width: 0, height: 4 }, 
            shadowOpacity: 0.3, 
            shadowRadius: 8, 
            elevation: 4 
          } : {}}
          onPress={handlePay}
          disabled={!selectedMethod}
          activeOpacity={0.7}
        >
          <Text className={`text-center font-bold font-bold ${
            selectedMethod ? 'text-white' : 'text-[#737373]'
          }`}>
            Pay Rs {bookingDetails.slotFee + bookingDetails.platformFee}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}