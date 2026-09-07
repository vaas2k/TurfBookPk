import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { createGroundSlot, deleteGroundSlot, listGroundSlots, Slot, updateGroundSlot } from '@/lib/api/vendors';
import { Ionicons } from '@expo/vector-icons';
import { Toast } from '@/components/ui/toast';

const fieldClass = 'bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]';

export default function GroundSlots() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), start_time: '18:00', end_time: '19:00', price: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Slot | null>(null);

  const load = useCallback(async () => {
    if (typeof id !== 'string') return;
    setLoading(true);
    try { setSlots(await listGroundSlots(id)); } catch (error: any) { setToast(error?.message || 'Unable to load slots.'); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.start_time) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.end_time) || form.start_time >= form.end_time || !Number.isInteger(Number(form.price)) || Number(form.price) <= 0) { setToast('Use a valid date, 24-hour times, and a positive whole-number price.'); return; }
    try { await createGroundSlot(id, { ...form, price: Number(form.price) }); setForm({ ...form, start_time: form.end_time, end_time: '', price: '' }); await load(); setToast('Slot added.'); } catch (error: any) { setToast(error?.message || 'Unable to add slot.'); }
  };

  const toggleBlocked = async (slot: Slot) => {
    if (!id || slot.is_booked) return;
    try { await updateGroundSlot(id, slot.id, { is_blocked: !slot.is_blocked }); await load(); setToast(slot.is_blocked ? 'Slot unblocked.' : 'Slot blocked.'); } catch (error: any) { setToast(error?.message || 'Unable to update slot.'); }
  };

  const remove = async () => {
    if (!id || !pendingRemove) return;
    try { await deleteGroundSlot(id, pendingRemove.id); setPendingRemove(null); await load(); setToast('Slot removed.'); } catch (error: any) { setPendingRemove(null); setToast(error?.message || 'Unable to remove slot.'); }
  };

  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
    <View className="flex-row items-center py-4"><TouchableOpacity className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3 border border-[#E5E5E5]" onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color="#1A1A2E" /></TouchableOpacity><View className="flex-1"><Text className="text-xl font-bold text-[#1A1A2E]" numberOfLines={1}>{title || 'Ground slots'}</Text><Text className="text-[#737373] text-sm mt-1">Availability and schedule</Text></View></View>
    <View className="flex-row mb-5"><View className="flex-1 bg-white rounded-xl p-3 mr-2 border border-[#E5E5E5]"><Text className="text-[#737373] text-xs">Available</Text><Text className="text-[#4CAF50] text-xl font-bold mt-1">{slots.filter((slot) => !slot.is_booked && !slot.is_blocked).length}</Text></View><View className="flex-1 bg-white rounded-xl p-3 mr-2 border border-[#E5E5E5]"><Text className="text-[#737373] text-xs">Blocked</Text><Text className="text-[#F59E0B] text-xl font-bold mt-1">{slots.filter((slot) => slot.is_blocked).length}</Text></View><View className="flex-1 bg-white rounded-xl p-3 border border-[#E5E5E5]"><Text className="text-[#737373] text-xs">Booked</Text><Text className="text-[#DC2626] text-xl font-bold mt-1">{slots.filter((slot) => slot.is_booked).length}</Text></View></View>
    <View className="bg-white rounded-2xl p-4 border border-[#E5E5E5] mb-5"><Text className="text-lg font-bold text-[#1A1A2E] mb-3">Add slot</Text>{([['date', 'Date (YYYY-MM-DD)'], ['start_time', 'Start time (HH:MM)'], ['end_time', 'End time (HH:MM)'], ['price', 'Price']] as const).map(([key, label]) => <View key={key} className="mb-3"><Text className="text-[#1A1A2E] mb-1">{label}</Text><TextInput className={fieldClass} value={form[key]} onChangeText={(value) => setForm({ ...form, [key]: value })} keyboardType={key === 'price' ? 'numeric' : 'default'} /></View>)}<TouchableOpacity onPress={add} className="bg-[#4CAF50] rounded-xl py-3 items-center"><Text className="text-white font-bold">Add Slot</Text></TouchableOpacity></View>
    <Text className="text-lg font-bold text-[#1A1A2E] mb-3">Scheduled slots</Text>
    {slots.map((slot) => <View key={slot.id} className="bg-white rounded-xl p-4 mb-3 border border-[#E5E5E5]"><View className="flex-row justify-between"><View><Text className="font-bold text-[#1A1A2E]">{slot.date}</Text><Text className="text-[#737373] mt-1">{slot.start_time} - {slot.end_time} · Rs {slot.price}</Text></View><Text className={`font-medium ${slot.is_booked ? 'text-[#DC2626]' : slot.is_blocked ? 'text-[#F59E0B]' : 'text-[#4CAF50]'}`}>{slot.is_booked ? 'Booked' : slot.is_blocked ? 'Blocked' : 'Available'}</Text></View>{!slot.is_booked && <View className="flex-row mt-3"><TouchableOpacity onPress={() => toggleBlocked(slot)} className="bg-[#F5F5F5] rounded-lg px-3 py-2 mr-2"><Text>{slot.is_blocked ? 'Unblock' : 'Block'}</Text></TouchableOpacity><TouchableOpacity onPress={() => setPendingRemove(slot)} className="bg-[#FEF2F2] rounded-lg px-3 py-2"><Text className="text-[#DC2626]">Remove</Text></TouchableOpacity></View>}</View>)}
    {loading && slots.length === 0 && <ActivityIndicator color="#4CAF50" />}
    {!loading && slots.length === 0 && <View className="items-center py-8"><Ionicons name="calendar-outline" size={40} color="#D4D4D4" /><Text className="text-[#737373] text-center mt-2">No slots created yet.</Text></View>}
  </ScrollView><Modal visible={Boolean(pendingRemove)} transparent animationType="fade" onRequestClose={() => setPendingRemove(null)}><View className="flex-1 bg-black/40 items-center justify-center px-8"><View className="bg-white rounded-2xl p-6 w-full"><Text className="text-xl font-bold text-[#1A1A2E]">Remove slot?</Text><Text className="text-[#737373] mt-2">This slot will no longer be available to players.</Text><View className="flex-row justify-end mt-6"><TouchableOpacity onPress={() => setPendingRemove(null)} className="px-4 py-3"><Text className="text-[#737373] font-medium">Cancel</Text></TouchableOpacity><TouchableOpacity onPress={remove} className="bg-[#DC2626] rounded-xl px-4 py-3"><Text className="text-white font-bold">Remove</Text></TouchableOpacity></View></View></View></Modal><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
