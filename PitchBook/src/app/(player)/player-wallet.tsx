import { View, Text, TouchableOpacity, ScrollView, FlatList, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface PaymentMethod {
  id: string;
  type: string;
  name: string;
  number: string;
  isDefault?: boolean;
  icon: string;
  color: string;
}

interface Transaction {
  id: string;
  title: string;
  date: string;
  amount: number;
  type: 'paid' | 'credited';
  method: string;
}

const paymentMethods: PaymentMethod[] = [
  {
    id: '1',
    type: 'jazzcash',
    name: 'JazzCash Mobile Wallet',
    number: '0300 •••• 567',
    isDefault: true,
    icon: '📱',
    color: '#E91E63',
  },
  {
    id: '2',
    type: 'easypaisa',
    name: 'Easypaisa Mobile Wallet',
    number: '0312 •••• 981',
    icon: '📱',
    color: '#00BCD4',
  },
  {
    id: '3',
    type: 'visa',
    name: 'Visa Card',
    number: '••••••••••••4821',
    icon: '💳',
    color: '#1A1A2E',
  },
];

const transactions: Transaction[] = [
  {
    id: '1',
    title: 'Booking – Askari Turf',
    date: 'Oct 10, 2026 • JazzCash',
    amount: -4500,
    type: 'paid',
    method: 'JazzCash',
  },
  {
    id: '2',
    title: 'Refund – Green Valley',
    date: 'Oct 08, 2026 • Wallet',
    amount: 3000,
    type: 'credited',
    method: 'Wallet',
  },
];

export default function WalletScreen() {
  const renderPaymentMethod = ({ item }: { item: PaymentMethod }) => (
    <TouchableOpacity
      className="flex-row items-center p-4 bg-white rounded-2xl mb-3 border border-[#E5E5E5]"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
      activeOpacity={0.7}
    >
      <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
        <Text className="text-2xl">{item.icon}</Text>
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[#1A1A2E] text-sm font-semibold font-semibold">{item.name}</Text>
        <Text className="text-[#737373] text-xs font-regular">{item.number}</Text>
      </View>
      {item.isDefault && (
        <View className="bg-[#E8F5E9] px-2 py-1 rounded-full">
          <Text className="text-[#4CAF50] text-[10px] font-bold font-bold">DEFAULT</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View className="flex-row items-center py-3 border-b border-[#F5F5F5]">
      <View className={`w-10 h-10 rounded-full items-center justify-center ${item.type === 'paid' ? 'bg-red-50' : 'bg-green-50'}`}>
        <Ionicons 
          name={item.type === 'paid' ? 'arrow-up' : 'arrow-down'} 
          size={20} 
          color={item.type === 'paid' ? '#EF4444' : '#4CAF50'} 
        />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[#1A1A2E] text-sm font-medium font-medium">{item.title}</Text>
        <Text className="text-[#737373] text-xs font-regular">{item.date}</Text>
      </View>
      <Text className={`font-bold font-bold ${item.type === 'paid' ? 'text-[#EF4444]' : 'text-[#4CAF50]'}`}>
        {item.type === 'paid' ? '- ' : '+ '}Rs {Math.abs(item.amount).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">PAYMENTS</Text>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Balance */}
        <View className="bg-[#4CAF50] rounded-2xl p-6 mt-4" 
             style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 }}>
          <Text className="text-white/80 text-sm font-regular">Available Balance</Text>
          <Text className="text-white text-3xl font-bold font-bold mt-1">Rs 12,500</Text>
        </View>

        {/* Payment Methods */}
        <View className="mt-6">
          <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">SAVED PAYMENT METHODS</Text>
          <FlatList
            data={paymentMethods}
            renderItem={renderPaymentMethod}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
          
          <TouchableOpacity
            className="flex-row items-center justify-center bg-white rounded-2xl p-4 border border-dashed border-[#4CAF50]"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={24} color="#4CAF50" />
            <Text className="text-[#4CAF50] font-medium font-medium ml-2">Add payment method</Text>
          </TouchableOpacity>
        </View>

        {/* Transaction History */}
        <View className="mt-6 pb-8">
          <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">TRANSACTION HISTORY</Text>
          <View className="bg-white rounded-2xl p-4" 
               style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <FlatList
              data={transactions}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}