import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { appDialog } from '@/components/ui/app-dialog';
import { goBackOrReplace } from '@/lib/navigation';

export default function PaymentJazzCash() {
  const [phoneNumber, setPhoneNumber] = useState('300 1234567');
  const [isLoading] = useState(false);
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
      appDialog.alert('Invalid Number', 'Please enter a valid phone number');
      return;
    }

    appDialog.alert(
      'JazzCash Gateway Notice',
      'Direct JazzCash merchant gateway integration is currently in sandbox development. Please use standard checkout to confirm your booking.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Checkout', onPress: () => goBackOrReplace('/(player)/payment-method') }
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />

      <View className="px-6 pt-4 pb-5 flex-row items-center">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="w-10 h-10 rounded-full border border-[#30372B] items-center justify-center"
          onPress={() => goBackOrReplace('/(player)/payment-method')}
        >
          <Ionicons name="arrow-back" size={22} color="#F8F7F0" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 29 }} className="text-[#F8F7F0] ml-4">JAZZCASH PAYMENT</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-8">
          {/* Demo Mode Notice */}
          <View className="hidden">
            <Ionicons name="information-circle" size={22} color="#B45309" />
            <View className="ml-3 flex-1">
              <Text className="text-[#92400E] font-bold text-sm">Preview / Sandbox Screen</Text>
              <Text className="text-[#92400E] text-xs mt-1 leading-4">
                Automated JazzCash mobile payments are scheduled for an upcoming release. To book turf slots right now, please use the standard checkout flow.
              </Text>
            </View>
          </View>

          {/* Icon */}
          <View className="hidden">
            <View
              className="w-20 h-20 rounded-2xl bg-[#E91E63] items-center justify-center"
              style={{ shadowColor: '#E91E63', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
            >
              <Text className="text-white text-2xl font-bold">JC</Text>
            </View>
          </View>

          {/* Phone Input */}
          <View>
            <Text className="text-[#BFC1B9] text-[18px] leading-7 mb-12">
              Enter your JazzCash registered mobile number to receive a secure payment request.
            </Text>

            <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 20 }} className="text-[#BFC1B9] mb-4">MOBILE NUMBER</Text>
            <View className="flex-row items-center bg-[#181C16] rounded-[22px] px-5 border-2 border-[#3DB54A]">
              <View className="w-7 h-7 bg-[#0A8F46] rounded-sm mr-4" /><Text className="text-[#F8F7F0] font-bold text-[20px]">+92</Text>
              <View className="w-px h-10 bg-[#30372B] mx-4" />
              <TextInput
                className="flex-1 py-5 text-[#F8F7F0] text-[20px]"
                placeholder="300 1234567"
                placeholderTextColor="#8C9188"
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={11}
                autoFocus={Platform.OS === 'ios'}
              />
            </View>
          </View>

          {/* How it works */}
          <View className="items-center mt-16"><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 20 }} className="text-[#BFC1B9]">TOTAL AMOUNT</Text><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#3DB54A] text-[44px] mt-2">RS 3,150</Text></View>
          <View className="bg-[#1B1F19] rounded-[24px] p-5 mt-16">
            <View className="flex-row items-center mb-4"><Ionicons name="information-circle-outline" size={26} color="#F5A623" /><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-[19px] ml-3">How it works</Text></View>
            <View className="space-y-3">
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#BFC1B9] font-bold text-sm">1.</Text>
                </View>
                <Text className="text-[#BFC1B9] text-base ml-3 flex-1">
                  Submit your JazzCash mobile number above.
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#BFC1B9] font-bold text-sm">2.</Text>
                </View>
                <Text className="text-[#BFC1B9] text-base ml-3 flex-1">
                  You will receive a direct push-popup payment prompt on your phone.
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="w-6 h-6 rounded-full bg-[#4CAF50]/20 items-center justify-center mt-0.5">
                  <Text className="text-[#BFC1B9] font-bold text-sm">3.</Text>
                </View>
                <Text className="text-[#BFC1B9] text-base ml-3 flex-1">
                  Enter your JazzCash MPIN to approve the transaction securely.
                </Text>
              </View>
            </View>
          </View>

          {/* Timer */}
          <View className="hidden">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center">
                <Ionicons name="timer-outline" size={18} color="#EF4444" />
              </View>
              <Text className="text-[#737373] text-sm ml-2">Complete request within</Text>
            </View>
            <Text className="text-[#EF4444] font-bold">{formatTime(timer)}</Text>
          </View>
        </View>

        <View className="h-28" />
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-[#171B15] border-t border-[#30372B] px-6 pt-5 pb-6">
        <TouchableOpacity
          accessibilityRole="button"
          className="py-5 rounded-full bg-[#3DB54A]"
          style={{
            shadowColor: '#3DB54A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
          onPress={handleSendRequest}
          disabled={isLoading}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-center text-xl text-white">
            Send Payment Request
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
