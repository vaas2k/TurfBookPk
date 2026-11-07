import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { goBackOrReplace } from '@/lib/navigation';
import { appDialog } from '@/components/ui/app-dialog';

const guides = [
  { icon: 'storefront-outline', title: 'Set up your business', detail: 'Profile, verification and payout details', lessons: ['Complete vendor verification', 'Update business information', 'Understand approval status'] },
  { icon: 'football-outline', title: 'Add and manage grounds', detail: 'Ground details, pitches, photos and approval', lessons: ['Create a ground', 'Add independent or combined pitches', 'Submit a ground for verification'] },
  { icon: 'calendar-outline', title: 'Create booking times', detail: 'Schedules, prices, changeover and closures', lessons: ['Build a repeating schedule', 'Set peak pricing', 'Block or reserve a date'] },
  { icon: 'people-outline', title: 'Handle bookings', detail: 'Confirmed, reserved and live matches', lessons: ['Read booking statuses', 'Manage match day', 'Respond to a player dispute'] },
  { icon: 'wallet-outline', title: 'Earnings and payouts', detail: 'Balances, refunds and payout records', lessons: ['Understand available earnings', 'Track deductions and refunds', 'Review payout history'] },
  { icon: 'help-buoy-outline', title: 'Get help', detail: 'Common fixes and TurfBookPK support', lessons: ['Fix common ground issues', 'Contact the operations team', 'Report an urgent problem'] },
] as const;

export default function VendorGuide() {
  const comingSoon = (lesson: string) => appDialog.alert('Tutorial coming soon', `The “${lesson}” written guide and video link will be added here.`);
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-[#10120F]">
    <StatusBar barStyle="light-content" />
    <View className="px-5 pt-3 pb-4 flex-row items-center border-b border-[#262C24]">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => goBackOrReplace('/(vendor)/profile')} className="h-11 w-11 rounded-xl border border-[#30372B] bg-[#1B1F19] items-center justify-center">
        <Ionicons name="arrow-back" size={23} color="#F5F5F0" />
      </TouchableOpacity>
      <View className="flex-1 ml-3"><Text className="text-[#F5F5F0] text-xl font-bold">Vendor guide</Text><Text className="text-[#92978F] text-xs mt-0.5">Learn TurfBookPK step by step</Text></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 44 }}>
      <View className="rounded-[24px] border border-[#315536] bg-[#172319] p-5">
        <View className="h-12 w-12 rounded-2xl bg-[#42B84F] items-center justify-center"><Ionicons name="school-outline" size={25} color="#102110" /></View>
        <Text className="text-[#F5F5F0] text-[22px] font-bold mt-4">Everything you need to run your grounds</Text>
        <Text className="text-[#A8B2A6] text-sm leading-6 mt-2">This learning area is ready for short written steps, screenshots and video tutorial links. The full lessons will be added later.</Text>
        <View className="self-start rounded-full border border-[#4A7650] px-3 py-1.5 mt-4"><Text className="text-[#75D67E] text-xs font-bold">TUTORIAL LIBRARY · COMING SOON</Text></View>
      </View>
      <Text className="text-[#8E948B] text-xs font-bold tracking-widest mt-7 mb-3">GUIDE CATEGORIES</Text>
      {guides.map((guide) => <View key={guide.title} className="rounded-[20px] border border-[#30372B] bg-[#1B1F19] p-4 mb-4">
        <View className="flex-row items-center"><View className="h-11 w-11 rounded-xl bg-[#253326] items-center justify-center"><Ionicons name={guide.icon} size={22} color="#62D06D" /></View><View className="flex-1 ml-3"><Text className="text-[#F5F5F0] text-base font-bold">{guide.title}</Text><Text className="text-[#92978F] text-xs mt-1">{guide.detail}</Text></View></View>
        <View className="mt-4 pt-2 border-t border-[#2B3028]">{guide.lessons.map((lesson, index) => <TouchableOpacity key={lesson} accessibilityRole="button" accessibilityLabel={`${lesson}, tutorial coming soon`} onPress={() => comingSoon(lesson)} className={`min-h-[48px] flex-row items-center ${index < guide.lessons.length - 1 ? 'border-b border-[#282D26]' : ''}`}><Ionicons name="play-circle-outline" size={19} color="#7D847A" /><Text className="text-[#D9DBD5] text-sm flex-1 ml-3">{lesson}</Text><Text className="text-[#737A70] text-[10px] font-bold mr-2">SOON</Text><Ionicons name="chevron-forward" size={17} color="#737A70" /></TouchableOpacity>)}</View>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
