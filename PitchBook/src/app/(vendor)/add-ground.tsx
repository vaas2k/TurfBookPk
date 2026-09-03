import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddGround() {
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-2xl font-bold text-[#1A1A2E]">Add Ground</Text>
        <Text className="text-[#737373] mt-2 text-center">This screen will be built next!</Text>
      </View>
    </SafeAreaView>
  );
}