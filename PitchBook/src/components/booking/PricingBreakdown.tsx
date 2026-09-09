import { View, Text } from 'react-native';

interface PricingBreakdownProps {
  slotPrice: number;
  platformFee?: number;
  totalAmount?: number;
}

export function PricingBreakdown({ slotPrice, platformFee = 0, totalAmount }: PricingBreakdownProps) {
  const finalTotal = totalAmount ?? (slotPrice + platformFee);

  return (
    <View className="bg-white rounded-2xl p-5 border border-[#E5E5E5]">
      <Text className="text-[#1A1A2E] text-base font-bold mb-3">Price details</Text>
      
      <View className="flex-row justify-between items-center py-1.5">
        <Text className="text-[#737373] text-sm">Slot fee</Text>
        <Text className="text-[#1A1A2E] text-sm font-medium">PKR {slotPrice.toLocaleString()}</Text>
      </View>

      <View className="flex-row justify-between items-center py-1.5">
        <Text className="text-[#737373] text-sm">Platform fee</Text>
        <Text className="text-[#1A1A2E] text-sm font-medium">
          {platformFee > 0 ? `PKR ${platformFee.toLocaleString()}` : 'Free'}
        </Text>
      </View>

      <View className="h-px bg-[#F0F0F0] my-2.5" />

      <View className="flex-row justify-between items-center pt-1">
        <Text className="text-[#1A1A2E] text-base font-bold">Total amount</Text>
        <Text className="text-[#4CAF50] text-xl font-bold">PKR {finalTotal.toLocaleString()}</Text>
      </View>
    </View>
  );
}

