import { View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function PaymentBankTransfer() {
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState('');

  const bankDetails = {
    bankName: 'Meezan Bank',
    accountTitle: 'TurfBookpk Pvt. Ltd.',
    accountNumber: '0102 0304 0506 0708',
    iban: 'PK36 MEZN 0001 0200 3040 5060',
    reference: 'PB-8847',
    amount: 'Rs 3,150',
  };

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleTransferComplete = () => {
    if (!accountNumber.trim() || !accountHolder.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push('/(player)/payment-processing');
    }, 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-[#1A1A2E] ml-3">BANK TRANSFER</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4">
          <View className="bg-white rounded-2xl p-6"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            
            <Text className="text-[#737373] text-sm mb-4">
              Transfer the exact amount to the account below and include the reference code.
            </Text>

            {/* Bank Details */}
            <View className="space-y-4">
              <View className="flex-row justify-between">
                <Text className="text-[#737373] text-xs">Bank Name</Text>
                <Text className="text-[#1A1A2E] text-sm font-semibold">{bankDetails.bankName}</Text>
              </View>

              <View className="flex-row justify-between">
                <Text className="text-[#737373] text-xs">Account Title</Text>
                <Text className="text-[#1A1A2E] text-sm font-semibold">{bankDetails.accountTitle}</Text>
              </View>

              <View>
                <Text className="text-[#737373] text-xs mb-1">Account Number</Text>
                <View className="flex-row items-center justify-between bg-[#F5F5F5] rounded-xl px-4 py-3 border border-[#E5E5E5]">
                  <Text className="text-[#1A1A2E] text-base font-medium">{bankDetails.accountNumber}</Text>
                  <TouchableOpacity onPress={() => handleCopy(bankDetails.accountNumber, 'Account')}>
                    <View className="flex-row items-center">
                      <Text className={`text-xs mr-1 ${copied === 'Account' ? 'text-[#4CAF50]' : 'text-[#737373]'}`}>
                        {copied === 'Account' ? 'Copied!' : 'Copy'}
                      </Text>
                      <Ionicons name="copy-outline" size={18} color={copied === 'Account' ? '#4CAF50' : '#737373'} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-[#737373] text-xs mb-1">IBAN</Text>
                <View className="flex-row items-center justify-between bg-[#F5F5F5] rounded-xl px-4 py-3 border border-[#E5E5E5]">
                  <Text className="text-[#1A1A2E] text-base font-medium">{bankDetails.iban}</Text>
                  <TouchableOpacity onPress={() => handleCopy(bankDetails.iban, 'IBAN')}>
                    <View className="flex-row items-center">
                      <Text className={`text-xs mr-1 ${copied === 'IBAN' ? 'text-[#4CAF50]' : 'text-[#737373]'}`}>
                        {copied === 'IBAN' ? 'Copied!' : 'Copy'}
                      </Text>
                      <Ionicons name="copy-outline" size={18} color={copied === 'IBAN' ? '#4CAF50' : '#737373'} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text className="text-[#737373] text-xs mb-1">INCLUDE THIS REFERENCE</Text>
                <View className="bg-[#E8F5E9] rounded-xl px-4 py-3 border border-[#4CAF50]">
                  <Text className="text-[#4CAF50] text-base font-bold text-center">{bankDetails.reference}</Text>
                </View>
              </View>

              <View>
                <Text className="text-[#737373] text-xs mb-1">AMOUNT TO TRANSFER</Text>
                <Text className="text-[#1A1A2E] text-2xl font-bold text-[#4CAF50]">{bankDetails.amount}</Text>
              </View>
            </View>

            {/* User Input Fields */}
            <View className="mt-6 pt-6 border-t border-[#F5F5F5]">
              <Text className="text-[#1A1A2E] font-bold text-base mb-4">Confirm Transfer Details</Text>
              
              <View className="mb-4">
                <Text className="text-[#737373] text-xs mb-1">Account Number (Sender)</Text>
                <TextInput
                  className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-[#1A1A2E] text-base border border-[#E5E5E5]"
                  placeholder="Enter your account number"
                  placeholderTextColor="#A3A3A3"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="numeric"
                />
              </View>

              <View>
                <Text className="text-[#737373] text-xs mb-1">Account Holder Name</Text>
                <TextInput
                  className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-[#1A1A2E] text-base border border-[#E5E5E5]"
                  placeholder="Enter your full name"
                  placeholderTextColor="#A3A3A3"
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                />
              </View>
            </View>

            <View className="mt-6 p-4 bg-[#F5F5F5] rounded-xl">
              <Text className="text-[#737373] text-sm text-center">
                Verification takes 5–15 minutes. We'll notify you once confirmed.
              </Text>
            </View>
          </View>

          <View className="h-8" />
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 pt-4 pb-6">
        <TouchableOpacity
          className={`py-4 rounded-full ${isLoading ? 'bg-[#E5E5E5]' : 'bg-[#4CAF50]'}`}
          style={!isLoading ? { 
            shadowColor: '#4CAF50', 
            shadowOffset: { width: 0, height: 4 }, 
            shadowOpacity: 0.3, 
            shadowRadius: 8, 
            elevation: 4 
          } : {}}
          onPress={handleTransferComplete}
          disabled={isLoading}
        >
          <Text className={`text-center font-bold text-base ${isLoading ? 'text-[#737373]' : 'text-white'}`}>
            {isLoading ? 'Processing...' : "I've made the transfer"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}