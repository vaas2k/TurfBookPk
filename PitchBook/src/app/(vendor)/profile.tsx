import { View, Text, TouchableOpacity, ScrollView, StatusBar, Switch, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { appDialog } from '@/components/ui/app-dialog';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

function SettingRow({ label, subtitle, icon, onPress, destructive = false, last = false }: { label: string; subtitle?: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; destructive?: boolean; last?: boolean }) {
  const color = destructive ? '#FF6B6B' : '#62D06D';
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={`min-h-[66px] px-4 flex-row items-center ${last ? "" : "border-b border-[#30372B]"}`}><View className={`h-10 w-10 rounded-xl items-center justify-center ${destructive ? 'bg-[#351D1D]' : 'bg-[#253326]'}`}><Ionicons name={icon} size={20} color={color} /></View><View className="flex-1 ml-3"><Text className={`text-[15px] font-semibold ${destructive ? "text-[#FF7470]" : "text-[#E5E7E1]"}`}>{label}</Text>{subtitle && <Text className="text-[#858C82] text-xs mt-0.5" numberOfLines={1}>{subtitle}</Text>}</View><Ionicons name="chevron-forward" size={18} color={destructive ? "#FF6B6B" : "#8C9289"} /></TouchableOpacity>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View className="mt-6"><Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 15 }} className="text-[#8E948B] mb-2">{title}</Text><View className="overflow-hidden rounded-xl border border-[#30372B] bg-[#1B1F19]">{children}</View></View>;
}

export default function VendorProfile() {
  const { profile, signOut, switchToPlayer } = useAuthStore();
  const { vendorProfile } = useVendorStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const businessName = vendorProfile?.business_name || profile?.full_name || 'Your business';
  const phone = vendorProfile?.business_phone || profile?.phone || 'No phone added';
  const unavailable = (label: string) => appDialog.alert(label, 'This setting will be available when vendor payouts and account controls are connected.');

  const handleLogout = async () => {
    appDialog.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/phone-input');
          }
        }
      ]
    );
  };

  const handleSwitchToPlayer = () => {
    appDialog.alert(
      'Switch to Player Mode',
      'You will switch back to player view. You can switch back to vendor anytime from the player home screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Switch', 
          onPress: async () => {
            const { error } = await switchToPlayer();
            if (error) appDialog.alert('Unable to switch modes', error.message);
            else router.replace('/(player)');
          }
        }
      ]
    );
  };

  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
    <StatusBar barStyle="light-content" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 38 }}>
      <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 15 }} className="text-[#8E948B]">SETTINGS & CONTROL</Text>
      <View className="flex-row items-end justify-between"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[26px] text-[#F5F5F0] mt-1">Business profile</Text><View className={`rounded-full border px-3 py-1 ${vendorProfile?.is_active ? 'border-[#397E41] bg-[#17301B]' : 'border-[#705B2C] bg-[#2C2517]'}`}><Text className={`text-xs font-bold ${vendorProfile?.is_active ? 'text-[#75D67E]' : 'text-[#F4B844]'}`}>{vendorProfile?.is_active ? 'ACTIVE' : 'PAUSED'}</Text></View></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit business profile" onPress={() => router.push('/(vendor)/edit-profile')} className="bg-[#1B1F19] border border-[#30372B] rounded-[22px] mt-4 overflow-hidden">
        <View className="h-24 bg-[#172319] overflow-hidden">{vendorProfile?.business_cover_image ? <Image source={{ uri: vendorProfile.business_cover_image }} className="h-full w-full" resizeMode="cover" /> : <View className="flex-1 items-center justify-center"><Ionicons name="image-outline" size={26} color="#4F6B52" /></View>}</View>
        <View className="px-5 pb-5 flex-row items-center"><View className="h-[68px] w-[68px] -mt-5 rounded-2xl border-[3px] border-[#1B1F19] bg-[#42B84F] items-center justify-center overflow-hidden">{vendorProfile?.business_logo ? <Image source={{ uri: vendorProfile.business_logo }} className="h-full w-full" resizeMode="cover" /> : <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#102110] text-[25px]">{businessName.charAt(0).toUpperCase()}</Text>}</View>
        <View className="flex-1 ml-4 mt-3"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0] text-[17px]" numberOfLines={1}>{businessName}</Text><Text className="text-[#92978F] text-[13px] mt-1" numberOfLines={1}>{vendorProfile?.business_city || 'Business profile'} · {phone}</Text></View><View className="h-10 w-10 rounded-xl bg-[#252A22] items-center justify-center mt-3"><Ionicons name="create-outline" size={20} color="#75D67E" /></View></View>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open vendor help and tutorials" onPress={() => router.push('/(vendor)/vendor-guide')} className="rounded-[20px] border border-[#315536] bg-[#172319] p-4 mt-5 flex-row items-center"><View className="h-12 w-12 rounded-2xl bg-[#42B84F] items-center justify-center"><Ionicons name="school-outline" size={24} color="#102110" /></View><View className="flex-1 ml-3"><Text className="text-[#F5F5F0] font-bold text-base">Help & tutorials</Text><Text className="text-[#A8B2A6] text-xs mt-1">Learn grounds, slots, bookings and earnings</Text></View><Ionicons name="arrow-forward" size={21} color="#75D67E" /></TouchableOpacity>
      <Section title="ACCOUNT"><SettingRow icon="scan-outline" label="Scan player check-in" subtitle="Confirm a player's arrival" onPress={() => router.push('/(player)/manager-scan')} /><SettingRow icon="people-outline" label="Ground managers" subtitle="Assign and remove manager access" onPress={() => router.push('/(vendor)/managers')} /><SettingRow icon="card-outline" label="Payout account" subtitle="Bank and payout information" onPress={() => unavailable('Payout account')} /><SettingRow icon="call-outline" label="Change phone number" subtitle="Update your verified contact number" onPress={() => unavailable('Change phone number')} last /></Section>
      <Section title="PREFERENCES"><View className="min-h-[66px] px-4 flex-row items-center border-b border-[#30372B]"><View className="h-10 w-10 rounded-xl bg-[#253326] items-center justify-center"><Ionicons name="notifications-outline" size={20} color="#62D06D" /></View><Text className="text-[#E5E7E1] text-[15px] font-semibold flex-1 ml-3">Notification settings</Text><Switch accessibilityLabel="Toggle notification settings" value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: '#4A5047', true: '#42B84F' }} thumbColor="#F8FAF5" /></View><SettingRow icon="language-outline" label="Language" subtitle="English" onPress={() => unavailable('Language')} last /></Section>
      <Section title="SUPPORT"><SettingRow icon="help-circle-outline" label="Help centre" subtitle="Answers and operational guidance" onPress={() => router.push('/(vendor)/vendor-guide')} /><SettingRow icon="mail-outline" label="Contact support" subtitle="Email the TurfBookPK team" onPress={() => Linking.openURL('mailto:support@turfbookpk.com?subject=TurfBookPK%20vendor%20support').catch(() => appDialog.alert('Contact support', 'Email support@turfbookpk.com for help.'))} last /></Section>
      <View className="mt-6 overflow-hidden rounded-xl border border-[#30372B] bg-[#1B1F19]"><SettingRow icon="football-outline" label="Switch to player mode" subtitle="Book another vendor's ground" onPress={handleSwitchToPlayer} /><SettingRow icon="log-out-outline" label="Log out" onPress={handleLogout} /><SettingRow icon="trash-outline" label="Delete account" destructive onPress={() => appDialog.alert('Delete account', 'Account deletion is not available in this MVP. Please contact support.')} last /></View>
    </ScrollView>
  </SafeAreaView>;
}
