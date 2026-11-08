import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getVendorGrounds, Ground } from '@/lib/api/vendors';
import { addManager, listManagers, ManagerAssignment, revokeManager } from '@/lib/api/managers';
import { appDialog } from '@/components/ui/app-dialog';

export default function ManagersScreen() {
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [managers, setManagers] = useState<ManagerAssignment[]>([]);
  const [groundId, setGroundId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { const [groundList, managerList] = await Promise.all([getVendorGrounds(1, 100), listManagers()]); setGrounds(groundList.grounds); setManagers(managerList); setGroundId((current) => current || groundList.grounds[0]?.id || ''); setError(''); } catch (caught: any) { setError(caught?.message || 'Unable to load managers.'); } }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => { setBusy(true); try { await addManager({ name, phone, ground_id: groundId }); setName(''); setPhone(''); await load(); } catch (caught: any) { setError(caught?.message || 'Unable to add manager.'); } finally { setBusy(false); } };
  const remove = (item: ManagerAssignment) => appDialog.alert('Remove manager access?', `${item.name} will immediately lose access to ${item.ground_title}.`, [{ text: 'Keep', style: 'cancel' }, { text: 'Remove access', style: 'destructive', onPress: async () => { try { await revokeManager(item.id); await load(); } catch (caught: any) { setError(caught?.message || 'Unable to remove access.'); } } }]);
  return <SafeAreaView className="flex-1 bg-[#10120F]" edges={['top', 'bottom', 'left', 'right']}><KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View className="flex-row items-center px-5 pt-3"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="w-11 h-11 justify-center"><Ionicons name="arrow-back" size={24} color="#F5F5F0" /></TouchableOpacity><Text className="text-[#F5F5F0] text-xl font-bold ml-2">Ground managers</Text></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
    <Text className="text-[#A6ACA3] text-sm">Managers sign in with their own phone number. Give access only to grounds they manage.</Text>
    <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-5"><Text className="text-[#F5F5F0] font-bold">Add a manager</Text><TextInput accessibilityLabel="Manager name" placeholder="Full name" placeholderTextColor="#8E948B" value={name} onChangeText={setName} className="bg-[#10120F] border border-[#30372B] rounded-xl px-4 py-3 text-[#F5F5F0] mt-4" /><TextInput accessibilityLabel="Manager phone number" placeholder="03XXXXXXXXX" placeholderTextColor="#8E948B" keyboardType="phone-pad" value={phone} onChangeText={setPhone} className="bg-[#10120F] border border-[#30372B] rounded-xl px-4 py-3 text-[#F5F5F0] mt-3" /><Text className="text-[#A6ACA3] text-xs mt-4">Assign to a ground</Text><View className="flex-row flex-wrap mt-2">{grounds.map((ground) => <TouchableOpacity accessibilityRole="button" accessibilityState={{ selected: ground.id === groundId }} key={ground.id} onPress={() => setGroundId(ground.id)} className={`border rounded-full px-4 py-2 mr-2 mb-2 ${ground.id === groundId ? 'border-[#42B84F] bg-[#17301B]' : 'border-[#4A5047]'}`}><Text className={ground.id === groundId ? 'text-[#75D67E]' : 'text-[#A6ACA3]'}>{ground.title}</Text></TouchableOpacity>)}</View><TouchableOpacity accessibilityRole="button" disabled={busy || !groundId} onPress={() => void save()} className="bg-[#42B84F] rounded-full py-4 items-center mt-4">{busy ? <ActivityIndicator color="#102110" /> : <Text className="text-[#102110] font-bold">Add manager</Text>}</TouchableOpacity></View>
    {error ? <Text className="text-[#F4B844] mt-4">{error}</Text> : null}
    <Text className="text-[#F5F5F0] font-bold text-lg mt-8">Assigned managers</Text>{managers.filter((item) => !item.revoked_at).map((item) => <View key={item.id} className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-3"><Text className="text-[#F5F5F0] font-bold">{item.name}</Text><Text className="text-[#A6ACA3] text-sm mt-1">{item.phone} · {item.ground_title}</Text><Text className={item.accepted_at ? 'text-[#75D67E] text-xs mt-2' : 'text-[#F4B844] text-xs mt-2'}>{item.accepted_at ? 'Active' : 'Awaiting acceptance'}</Text><TouchableOpacity accessibilityRole="button" onPress={() => remove(item)} className="mt-3"><Text className="text-[#F26666] font-bold">Remove access</Text></TouchableOpacity></View>)}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
