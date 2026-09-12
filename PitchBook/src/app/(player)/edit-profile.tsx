import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { updateProfile } from '@/lib/api/auth';
import { useAuthStore } from '@/store/authStore';
import { Toast } from '@/components/ui/toast';

const input = 'bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]';

export default function EditPlayerProfile() {
  const profile = useAuthStore((state) => state.profile);
  const [name, setName] = useState(''); const [city, setCity] = useState(''); const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false); const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setName(profile?.full_name || ''); setCity(profile?.city || ''); setBio(profile?.bio || ''); }, [profile]);
  const save = async () => {
    if (name.trim().length < 2) return setToast('Full name must have at least 2 characters.');
    setSaving(true);
    try { const result = await updateProfile({ full_name: name.trim(), city: city.trim() || null, bio: bio.trim() || null }); useAuthStore.setState({ user: result.user, profile: result.profile }); router.back(); }
    catch (error: any) { setToast(error?.message || 'Unable to update profile.'); } finally { setSaving(false); }
  };
  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><ScrollView className="px-6" contentContainerStyle={{ paddingBottom: 32 }}><View className="flex-row items-center justify-between py-5"><TouchableOpacity onPress={() => router.back()}><Text className="text-[#4CAF50] font-semibold">Cancel</Text></TouchableOpacity><Text className="text-xl font-bold text-[#1A1A2E]">Edit Profile</Text><View className="w-12" /></View><Text className="text-[#1A1A2E] font-medium mb-2">Full name</Text><TextInput value={name} onChangeText={setName} className={input} /><Text className="text-[#1A1A2E] font-medium mt-4 mb-2">City</Text><TextInput value={city} onChangeText={setCity} className={input} /><Text className="text-[#1A1A2E] font-medium mt-4 mb-2">Bio</Text><TextInput value={bio} onChangeText={setBio} className={input} multiline /><Text className="text-[#737373] text-xs mt-4">Avatar upload will be available after cloud storage is configured.</Text><TouchableOpacity disabled={saving} onPress={save} className="bg-[#4CAF50] rounded-xl py-4 items-center mt-6">{saving ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Save Changes</Text>}</TouchableOpacity></ScrollView><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
