import { View, Text, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function PaymentBankTransfer() {
  const bankDetails = {
    bankName: 'Meezan Bank',
    accountTitle: 'KickOff Pvt. Ltd.',
    accountNumber: '0102 0304 0506 0708',
    iban: 'PK36 MEZN 0001 0200 3040 5060',
    reference: 'PB-8847',
    amount: 'Rs 3,150',
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    // Show toast or alert
  };

  const handleTransferComplete = () => {
    router.push('/(player)/payment-processing');
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
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">BANK TRANSFER</Text>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 120 : 100 }}
      >
        <View className="px-4 pt-4">
          <View className="bg-white rounded-2xl p-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Text className="text-[#737373] text-sm font-regular mb-4">
              Transfer the exact amount to the account below and include the reference code.
            </Text>

            {/* Bank Details */}
            <View className="space-y-4">
              <View>
                <Text className="text-[#737373] text-xs font-regular mb-1">Bank Name</Text>
                <Text className="text-[#1A1A2E] text-base font-semibold font-semibold">{bankDetails.bankName}</Text>
              </View>

              <View>
                <Text className="text-[#737373] text-xs font-regular mb-1">Account Title</Text>
                <Text className="text-[#1A1A2E] text-base font-semibold font-semibold">{bankDetails.accountTitle}</Text>
              </View>

              <View>
                <Text className="text-[#737373] text-xs font-regular mb-1">Account Number</Text>
                <View className="flex-row items-center justify-between bg-[#F5F5F5] rounded-xl px-4 py-3 border border-[#E5E5E5]">
                  <Text className="text-[#1A1A2E] text-base font-medium font-medium">{bankDetails.accountNumber}</Text>
                  <TouchableOpacity onPress={() => handleCopy(bankDetails.accountNumber)}>
                    <Ionicons name="copy-outline" size={20} color="#4CAF50" />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-[#737373] text-xs font-regular mb-1">IBAN</Text>
                <View className="flex-row items-center justify-between bg-[#F5F5F5] rounded-xl px-4 py-3 border border-[#E5E5E5]">
                  <Text className="text-[#1A1A2E] text-base font-medium font-medium">{bankDetails.iban}</Text>
                  <TouchableOpacity onPress={() => handleCopy(bankDetails.iban)}>
                    <Ionicons name="copy-outline" size={20} color="#4CAF50" />
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-[#737373] text-xs font-regular mb-1">INCLUDE THIS REFERENCE</Text>
                <View className="bg-[#E8F5E9] rounded-xl px-4 py-3 border border-[#4CAF50]">
                  <Text className="text-[#4CAF50] text-base font-bold font-bold text-center">{bankDetails.reference}</Text>
                </View>
              </View>

              <View>
                <Text className="text-[#737373] text-xs font-regular mb-1">AMOUNT TO TRANSFER</Text>
                <Text className="text-[#1A1A2E] text-2xl font-bold font-bold text-[#4CAF50]">{bankDetails.amount}</Text>
              </View>
            </View>

            <View className="mt-6 p-4 bg-[#F5F5F5] rounded-xl">
              <Text className="text-[#737373] text-sm font-regular text-center">
                Verification takes 5–15 minutes. We'll notify you once confirmed.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 pt-4 pb-6">
        <TouchableOpacity
          className="py-4 rounded-full bg-[#4CAF50]"
          style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          onPress={handleTransferComplete}
          activeOpacity={0.7}
        >
          <Text className="text-white text-center font-bold font-bold">I've made the transfer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}