import { View, Text, TouchableOpacity, ScrollView, StatusBar, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { appDialog } from '@/components/ui/app-dialog';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

function SettingRow({ label, onPress, destructive = false, last = false }: { label: string; onPress: () => void; destructive?: boolean; last?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className={`min-h-[51px] px-4 flex-row items-center justify-between ${last ? "" : "border-b border-[#30372B]"}`}><Text className={`text-[15px] ${destructive ? "text-[#FF4668]" : "text-[#E5E7E1]"}`}>{label}</Text><Ionicons name="chevron-forward" size={18} color={destructive ? "#FF4668" : "#8C9289"} /></TouchableOpacity>;
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
    <StatusBar barStyle="light-content" backgroundColor="#10120F" />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 38 }}>
      <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 15 }} className="text-[#8E948B]">SETTINGS & CONTROL</Text>
      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[25px] text-[#F5F5F0] mt-1">Profile</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Edit business profile" onPress={() => router.push('/(vendor)/edit-profile')} className="bg-[#1B1F19] border border-[#30372B] rounded-[18px] mt-3 px-5 py-5 flex-row items-center">
        <View className="h-[60px] w-[60px] rounded-full bg-[#42B84F] items-center justify-center"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#102110] text-[25px]">{businessName.charAt(0).toUpperCase()}</Text></View>
        <View className="flex-1 ml-4"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0] text-[17px]" numberOfLines={1}>{businessName}</Text><Text className="text-[#92978F] text-[13px] mt-1" numberOfLines={1}>{vendorProfile?.business_city || 'Business profile'} · {phone}</Text></View><Ionicons name="chevron-forward" size={21} color="#9BA097" />
      </TouchableOpacity>
      <Section title="ACCOUNT"><SettingRow label="Payout account" onPress={() => unavailable('Payout account')} /><SettingRow label="Change phone number" onPress={() => unavailable('Change phone number')} last /></Section>
      <Section title="PREFERENCES"><View className="min-h-[55px] px-4 flex-row items-center justify-between border-b border-[#30372B]"><Text className="text-[#E5E7E1] text-[15px]">Notification settings</Text><Switch accessibilityLabel="Toggle notification settings" value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ false: '#4A5047', true: '#42B84F' }} thumbColor="#F8FAF5" /></View><SettingRow label="Language" onPress={() => unavailable('Language')} last /></Section>
      <Section title="SUPPORT"><SettingRow label="Help centre" onPress={() => appDialog.alert('Help centre', 'For booking, ground, or account help, contact TurfBookPK support.')} /><SettingRow label="Contact support" onPress={() => Linking.openURL('mailto:support@turfbookpk.com?subject=TurfBookPK%20vendor%20support').catch(() => appDialog.alert('Contact support', 'Email support@turfbookpk.com for help.'))} last /></Section>
      <View className="mt-6 overflow-hidden rounded-xl border border-[#30372B] bg-[#1B1F19]"><SettingRow label="Switch to player mode" onPress={handleSwitchToPlayer} /><SettingRow label="Log out" onPress={handleLogout} /><SettingRow label="Delete account" destructive onPress={() => appDialog.alert('Delete account', 'Account deletion is not available in this MVP. Please contact support.')} last /></View>
    </ScrollView>
  </SafeAreaView>;
}
