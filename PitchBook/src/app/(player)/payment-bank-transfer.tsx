import { View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

export default function PaymentBankTransfer() {
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [isLoading] = useState(false);
  const [copied, setCopied] = useState('');

  const bankDetails = {
    bankName: 'Meezan Bank',
    accountTitle: 'TurfBookpk Pvt. Ltd.',
    accountNumber: '0102 0304 0506 0708',
    iban: 'PK36 MEZN 0001 0200 3040 5060',
  };

  const handleCopy = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleTransferComplete = () => {
    Alert.alert(
      'Bank Transfer Verification Notice',
      'Automated IBFT slip verification is scheduled for an upcoming release. Please use standard checkout to confirm your active booking immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Checkout', onPress: () => router.back() }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />

      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-[#1A1A2E] ml-3">BANK TRANSFER</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4">
          {/* Demo Mode Notice */}
          <View className="bg-[#FFF8E1] border border-[#FDE68A] rounded-2xl p-4 mb-4 flex-row items-start">
            <Ionicons name="information-circle" size={22} color="#B45309" />
            <View className="ml-3 flex-1">
              <Text className="text-[#92400E] font-bold text-sm">Preview / Sandbox Screen</Text>
              <Text className="text-[#92400E] text-xs mt-1 leading-4">
                Manual bank transfer verification will be available soon. To lock in your turf slot immediately, please use the standard checkout flow.
              </Text>
            </View>
          </View>

          {/* Bank Account Info Card */}
          <View className="bg-white rounded-2xl p-6 border border-[#E5E5E5]">
            <Text className="text-[#1A1A2E] text-base font-bold mb-4">Official TurfBookPK Account</Text>

            <View className="space-y-3">
              <View className="flex-row justify-between items-center py-2 border-b border-[#F5F5F5]">
                <Text className="text-[#737373] text-sm">Bank Name</Text>
                <Text className="text-[#1A1A2E] font-semibold">{bankDetails.bankName}</Text>
              </View>

              <View className="flex-row justify-between items-center py-2 border-b border-[#F5F5F5]">
                <Text className="text-[#737373] text-sm">Account Title</Text>
                <Text className="text-[#1A1A2E] font-semibold">{bankDetails.accountTitle}</Text>
              </View>

              <View className="flex-row justify-between items-center py-2 border-b border-[#F5F5F5]">
                <View>
                  <Text className="text-[#737373] text-xs">Account Number</Text>
                  <Text className="text-[#1A1A2E] font-mono font-bold mt-0.5">{bankDetails.accountNumber}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopy(bankDetails.accountNumber, 'Account Number')}
                  className="bg-[#F5F5F5] px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-[#4CAF50] text-xs font-bold">
                    {copied === 'Account Number' ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row justify-between items-center py-2">
                <View className="flex-1 mr-2">
                  <Text className="text-[#737373] text-xs">IBAN</Text>
                  <Text className="text-[#1A1A2E] font-mono font-bold text-xs mt-0.5">{bankDetails.iban}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleCopy(bankDetails.iban, 'IBAN')}
                  className="bg-[#F5F5F5] px-3 py-1.5 rounded-lg"
                >
                  <Text className="text-[#4CAF50] text-xs font-bold">
                    {copied === 'IBAN' ? 'Copied!' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Sender details */}
          <View className="bg-white rounded-2xl p-6 mt-4 border border-[#E5E5E5]">
            <Text className="text-[#1A1A2E] text-base font-bold mb-3">Your Transfer Details</Text>

            <Text className="text-[#737373] text-xs mb-1">Sender Account Holder Name</Text>
            <TextInput
              className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-[#1A1A2E] text-sm mb-4 border border-[#E5E5E5]"
              placeholder="e.g. Muhammad Ali"
              placeholderTextColor="#A3A3A3"
              value={accountHolder}
              onChangeText={setAccountHolder}
            />

            <Text className="text-[#737373] text-xs mb-1">Sender Account / IBAN</Text>
            <TextInput
              className="bg-[#F5F5F5] rounded-xl px-4 py-3 text-[#1A1A2E] text-sm border border-[#E5E5E5]"
              placeholder="Account or IBAN used for transfer"
              placeholderTextColor="#A3A3A3"
              value={accountNumber}
              onChangeText={setAccountNumber}
            />
          </View>
        </View>

        <View className="h-28" />
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 pt-4 pb-6">
        <TouchableOpacity
          accessibilityRole="button"
          className="py-4 rounded-full bg-[#4CAF50]"
          style={{
            shadowColor: '#4CAF50',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
          onPress={handleTransferComplete}
          disabled={isLoading}
        >
          <Text className="text-center font-bold text-base text-white">
            Confirm Bank Transfer
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
