import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateVendorProfile } from '@/lib/api/vendors';
import { useVendorStore } from '@/store/vendorStore';
import { Toast } from '@/components/ui/toast';

const input = 'bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]';
export default function EditVendorProfile() {
  const vendorProfile = useVendorStore((state) => state.vendorProfile);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [city, setCity] = useState(''); const [description, setDescription] = useState(''); const [saving, setSaving] = useState(false); const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setName(vendorProfile?.business_name || ''); setPhone(vendorProfile?.business_phone || ''); setCity(vendorProfile?.business_city || ''); setDescription(vendorProfile?.business_description || ''); }, [vendorProfile]);
  const save = async () => { if (!name.trim() || !phone.trim() || !city.trim()) return setToast('Business name, phone, and city are required.'); setSaving(true); try { const profile = await updateVendorProfile({ business_name: name.trim(), business_phone: phone.trim(), business_city: city.trim(), business_description: description.trim() || null }); useVendorStore.setState({ vendorProfile: profile }); router.back(); } catch (error: any) { setToast(error?.message || 'Unable to update business profile.'); } finally { setSaving(false); } };
  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><ScrollView className="px-6" contentContainerStyle={{ paddingBottom: 32 }}><View className="flex-row items-center py-4"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} className="w-11 h-11 rounded-full bg-white border border-[#E5E5E5] items-center justify-center mr-3"><Text className="text-[#1A1A2E] text-xl">‹</Text></TouchableOpacity><Text className="text-xl font-bold text-[#1A1A2E] flex-1">Edit Business</Text></View>{([['Business name', name, setName], ['Business phone', phone, setPhone], ['City', city, setCity], ['Description', description, setDescription]] as const).map(([label, value, setter]) => <View key={label} className="mt-4"><Text className="text-[#1A1A2E] font-medium mb-2">{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={setter} className={input} multiline={label === 'Description'} /></View>)}<Text className="text-[#737373] text-xs mt-4">Logo and cover uploads will be available after cloud storage is configured.</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Save business changes" disabled={saving} onPress={save} className={`rounded-xl py-4 items-center mt-6 ${saving ? 'bg-[#9CA3AF]' : 'bg-[#4CAF50]'}`}>{saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Save Changes</Text>}</TouchableOpacity></ScrollView><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
