import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-bold text-[#1A1A2E]">Chat</Text>
        <Text className="text-[#737373] mt-2">Your messages will appear here</Text>
      </View>
    </SafeAreaView>
  );
}