import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { createGroundSlot, createRecurringGroundSlots, deleteGroundSlot, Ground, listGroundSlots, listVendorGrounds, Slot, updateGroundSlot } from '@/lib/api/vendors';
import { Ionicons } from '@expo/vector-icons';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';

const fieldClass = 'bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]';
const pakistanDate = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

function normalizedTime(value: string): string | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

function normalizedPrice(value: string): number | null {
  const clean = value.trim().replaceAll(',', '');
  if (!/^\d+$/.test(clean)) return null;
  const price = Number(clean);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function normalizedDate(value: string): string | null {
  const clean = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const parsed = new Date(`${clean}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === clean ? clean : null;
}

export default function GroundSlots() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [ground, setGround] = useState<Ground | null>(null);
  const [form, setForm] = useState({ date: pakistanDate(), start_time: '18:00', end_time: '19:00', price: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Slot | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [repeatEveryDays, setRepeatEveryDays] = useState('7');
  const [occurrences, setOccurrences] = useState('4');

  const load = useCallback(async () => {
    if (typeof id !== 'string') return;
    setLoading(true);
    try { const [currentSlots, grounds] = await Promise.all([listGroundSlots(id), listVendorGrounds()]); setSlots(currentSlots); setGround(grounds.find((item) => item.id === id) || null); } catch (error: any) { setToast(error?.message || 'Unable to load slots.'); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (typeof id !== 'string' || !id) return setToast('Ground information is missing. Please reopen this screen.');
    const date = normalizedDate(form.date);
    if (!date) return setToast('Enter the date as YYYY-MM-DD, for example 2026-09-20.');
    const startTime = normalizedTime(form.start_time);
    if (!startTime) return setToast('Enter a valid start time from 00:00 to 23:59.');
    const endTime = normalizedTime(form.end_time);
    if (!endTime) return setToast('Enter a valid end time from 00:00 to 23:59.');
    if (startTime >= endTime) return setToast('End time must be later than start time.');
    const price = normalizedPrice(form.price);
    if (price === null) return setToast('Enter a positive whole-number price, for example 2000.');
    setSaving(true);
    try {
      if (editingSlot) await updateGroundSlot(id, editingSlot.id, { date, start_time: startTime, end_time: endTime, price });
      else await createGroundSlot(id, { date, start_time: startTime, end_time: endTime, price });
      const successMessage = editingSlot ? 'Slot updated.' : 'Slot added.';
      setEditingSlot(null);
      setForm((current) => ({ ...current, date, start_time: endTime, end_time: '', price: '' }));
      await load();
      setToast(successMessage);
    } catch (error: any) { setToast(error?.message || `Unable to ${editingSlot ? 'update' : 'add'} slot.`); } finally { setSaving(false); }
  };

  const beginEdit = (slot: Slot) => {
    setEditingSlot(slot);
    setForm({ date: slot.date, start_time: slot.start_time.slice(0, 5), end_time: slot.end_time.slice(0, 5), price: String(slot.price) });
  };

  const addRecurring = async () => {
    if (typeof id !== 'string' || !id) return setToast('Ground information is missing. Please reopen this screen.');
    if (editingSlot) return setToast('Finish or cancel slot editing before creating a recurring schedule.');
    const date = normalizedDate(form.date); const startTime = normalizedTime(form.start_time); const endTime = normalizedTime(form.end_time); const price = normalizedPrice(form.price);
    const intervalDays = Number(repeatEveryDays); const count = Number(occurrences);
    if (!date || !startTime || !endTime || price === null || startTime >= endTime) return setToast('Complete valid date, times, and price before creating recurrence.');
    if (!Number.isSafeInteger(intervalDays) || intervalDays < 1 || !Number.isSafeInteger(count) || count < 1 || count > 60) return setToast('Repeat interval must be at least 1 day; occurrences must be between 1 and 60.');
    setSaving(true);
    try { const created = await createRecurringGroundSlots(id, { start_date: date, start_time: startTime, end_time: endTime, price, interval_days: intervalDays, occurrences: count }); await load(); setToast(`${created.length} recurring slots added.`); }
    catch (error: any) { setToast(error?.message || 'Unable to create recurring slots.'); } finally { setSaving(false); }
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
    <View className="flex-row items-center py-4"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" className="w-11 h-11 rounded-full bg-white items-center justify-center mr-3 border border-[#E5E5E5]" onPress={() => goBackOrReplace('/(vendor)/grounds')}><Ionicons name="arrow-back" size={20} color="#1A1A2E" /></TouchableOpacity><View className="flex-1"><Text className="text-xl font-bold text-[#1A1A2E]" numberOfLines={1}>{title || 'Ground slots'}</Text><Text className="text-[#737373] text-sm mt-1">Availability and schedule</Text></View></View>
    <View className="flex-row mb-5"><View className="flex-1 bg-white rounded-xl p-3 mr-2 border border-[#E5E5E5]"><Text className="text-[#737373] text-xs">Available</Text><Text className="text-[#4CAF50] text-xl font-bold mt-1">{slots.filter((slot) => !slot.is_booked && !slot.is_blocked).length}</Text></View><View className="flex-1 bg-white rounded-xl p-3 mr-2 border border-[#E5E5E5]"><Text className="text-[#737373] text-xs">Blocked</Text><Text className="text-[#F59E0B] text-xl font-bold mt-1">{slots.filter((slot) => slot.is_blocked).length}</Text></View><View className="flex-1 bg-white rounded-xl p-3 border border-[#E5E5E5]"><Text className="text-[#737373] text-xs">Booked</Text><Text className="text-[#DC2626] text-xl font-bold mt-1">{slots.filter((slot) => slot.is_booked).length}</Text></View></View>
    {ground && <View className="bg-[#EFF6FF] rounded-2xl p-4 border border-[#BFDBFE] mb-5"><View className="flex-row items-center"><Ionicons name="information-circle-outline" size={20} color="#2563EB" /><Text className="text-[#1E3A8A] font-bold ml-2">Scheduling policy</Text></View><Text className="text-[#1E40AF] text-xs leading-5 mt-2">Hours: {ground.operating_hours.open}–{ground.operating_hours.close} · Maximum slot: {ground.scheduling_policy.max_slot_duration_minutes} minutes · Create up to {ground.scheduling_policy.max_advance_booking_days} days ahead.</Text></View>}
    <View className="bg-white rounded-2xl p-4 border border-[#E5E5E5] mb-5"><Text className="text-lg font-bold text-[#1A1A2E] mb-3">{editingSlot ? 'Edit slot' : 'Add slot'}</Text>{([['date', 'Date (YYYY-MM-DD)'], ['start_time', 'Start time (HH:MM)'], ['end_time', 'End time (HH:MM)'], ['price', 'Price']] as const).map(([key, label]) => <View key={key} className="mb-3"><Text className="text-[#1A1A2E] mb-1">{label}</Text><TextInput accessibilityLabel={label} editable={!saving} className={fieldClass} value={form[key]} onChangeText={(value) => setForm({ ...form, [key]: value })} keyboardType={key === 'price' ? 'numeric' : 'default'} /></View>)}<TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel={editingSlot ? 'Update slot' : 'Add slot'} onPress={add} className={`rounded-xl py-3 items-center ${saving ? 'bg-[#9CA3AF]' : 'bg-[#4CAF50]'}`}><Text className="text-white font-bold">{saving ? 'Saving...' : editingSlot ? 'Update Slot' : 'Add Slot'}</Text></TouchableOpacity>{editingSlot && <TouchableOpacity disabled={saving} onPress={() => setEditingSlot(null)} className="py-3 items-center mt-1"><Text className="text-[#737373] font-medium">Cancel editing</Text></TouchableOpacity>}</View>
    {!editingSlot && <View className="bg-[#F0FDF4] rounded-2xl p-4 border border-[#BBF7D0] mb-5"><Text className="text-lg font-bold text-[#1A1A2E]">Repeat this slot</Text><Text className="text-[#4B5563] text-xs mt-1">Create the same date/time/price on a repeating schedule.</Text><View className="flex-row mt-3"><View className="flex-1 mr-2"><Text className="text-[#1A1A2E] text-xs mb-1">Every (days)</Text><TextInput accessibilityLabel="Repeat every days" editable={!saving} value={repeatEveryDays} onChangeText={setRepeatEveryDays} keyboardType="numeric" className={fieldClass} /></View><View className="flex-1"><Text className="text-[#1A1A2E] text-xs mb-1">Occurrences</Text><TextInput accessibilityLabel="Number of occurrences" editable={!saving} value={occurrences} onChangeText={setOccurrences} keyboardType="numeric" className={fieldClass} /></View></View><TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityLabel="Create recurring slots" onPress={addRecurring} className={`rounded-xl py-3 items-center mt-3 ${saving ? 'bg-[#9CA3AF]' : 'bg-[#1A1A2E]'}`}><Text className="text-white font-bold">{saving ? 'Saving...' : 'Create Recurring Slots'}</Text></TouchableOpacity></View>}
    <Text className="text-lg font-bold text-[#1A1A2E] mb-3">Scheduled slots</Text>
    {slots.map((slot) => <View key={slot.id} className="bg-white rounded-xl p-4 mb-3 border border-[#E5E5E5]"><View className="flex-row justify-between"><View><Text className="font-bold text-[#1A1A2E]">{slot.date}</Text><Text className="text-[#737373] mt-1">{slot.start_time} - {slot.end_time} · Rs {slot.price}</Text></View><Text className={`font-medium ${slot.is_booked ? 'text-[#DC2626]' : slot.is_blocked ? 'text-[#F59E0B]' : 'text-[#4CAF50]'}`}>{slot.is_booked ? 'Booked' : slot.is_blocked ? 'Blocked' : 'Available'}</Text></View>{!slot.is_booked && <View className="flex-row mt-3"><TouchableOpacity onPress={() => beginEdit(slot)} className="bg-[#E8F5E9] rounded-lg px-3 py-2 mr-2"><Text className="text-[#2E7D32]">Edit</Text></TouchableOpacity><TouchableOpacity onPress={() => toggleBlocked(slot)} className="bg-[#F5F5F5] rounded-lg px-3 py-2 mr-2"><Text>{slot.is_blocked ? 'Unblock' : 'Block'}</Text></TouchableOpacity><TouchableOpacity onPress={() => setPendingRemove(slot)} className="bg-[#FEF2F2] rounded-lg px-3 py-2"><Text className="text-[#DC2626]">Remove</Text></TouchableOpacity></View>}</View>)}
    {loading && slots.length === 0 && <ActivityIndicator color="#4CAF50" />}
    {!loading && slots.length === 0 && <View className="items-center py-8"><Ionicons name="calendar-outline" size={40} color="#D4D4D4" /><Text className="text-[#737373] text-center mt-2">No slots created yet.</Text></View>}
  </ScrollView><Modal visible={Boolean(pendingRemove)} transparent animationType="fade" onRequestClose={() => setPendingRemove(null)}><View className="flex-1 bg-black/40 items-center justify-center px-8"><View className="bg-white rounded-2xl p-6 w-full"><Text className="text-xl font-bold text-[#1A1A2E]">Remove slot?</Text><Text className="text-[#737373] mt-2">This slot will no longer be available to players.</Text><View className="flex-row justify-end mt-6"><TouchableOpacity onPress={() => setPendingRemove(null)} className="px-4 py-3"><Text className="text-[#737373] font-medium">Cancel</Text></TouchableOpacity><TouchableOpacity onPress={remove} className="bg-[#DC2626] rounded-xl px-4 py-3"><Text className="text-white font-bold">Remove</Text></TouchableOpacity></View></View></View></Modal><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
