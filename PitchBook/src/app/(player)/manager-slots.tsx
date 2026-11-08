import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { changeManagerSlot, getManagerSlots, ManagerPitch, ManagerSlot } from '@/lib/api/managers';
import { formatTimeRange12 } from '@/lib/time';
import { appDialog } from '@/components/ui/app-dialog';

const localDate = (offset: number) => new Date(Date.now() + 5 * 60 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10);
export default function ManagerSlots() {
  const { groundId = '', title = 'Ground' } = useLocalSearchParams<{ groundId: string; title: string }>();
  const [date, setDate] = useState(localDate(0));
  const [pitches, setPitches] = useState<ManagerPitch[]>([]);
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);
  const [slots, setSlots] = useState<ManagerSlot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = await getManagerSlots(groundId, date);
      setPitches(result.pitches);
      setSlots(result.slots);
      setSelectedPitchId((current) => result.pitches.some((pitch) => pitch.id === current) ? current : result.pitches[0]?.id ?? null);
      setError('');
    } catch (caught: any) { setError(caught?.message || 'Unable to load slots.'); }
    finally { setBusy(false); }
  }, [groundId, date]);
  useEffect(() => { void load(); }, [load]);
  const selectedPitch = pitches.find((pitch) => pitch.id === selectedPitchId);
  const visibleSlots = slots.filter((slot) => slot.pitch_id === selectedPitchId);
  const act = (slot: ManagerSlot, action: 'block' | 'unblock' | 'reserve' | 'remove') => appDialog.alert(`${action === 'remove' ? 'Remove' : action === 'reserve' ? 'Reserve' : action === 'block' ? 'Block' : 'Unblock'} slot?`, `${formatTimeRange12(slot.start_time, slot.end_time)} on ${slot.date}`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: async () => { try { await changeManagerSlot(groundId, slot.id, action); await load(); } catch (caught: any) { setError(caught?.message || 'Unable to update slot.'); } } }]);
  return <SafeAreaView className="flex-1 bg-[#10120F]" edges={['top', 'bottom', 'left', 'right']}>
    <View className="flex-row items-center px-5 pt-3"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="w-11 h-11 justify-center"><Ionicons name="arrow-back" size={24} color="#F5F5F0" /></TouchableOpacity><Text className="text-[#F5F5F0] text-xl font-bold ml-2 flex-1" numberOfLines={1}>{title} slots</Text></View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 55 }}>
      <Text className="text-[#A6ACA3] text-sm">Choose a pitch, then block, reserve, or remove its future slots.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5" contentContainerStyle={{ paddingRight: 20 }}>{Array.from({ length: 7 }, (_, offset) => localDate(offset)).map((day) => <TouchableOpacity key={day} accessibilityRole="button" accessibilityState={{ selected: date === day }} onPress={() => setDate(day)} className={`border rounded-full px-4 py-2 mr-2 ${date === day ? 'border-[#42B84F] bg-[#17301B]' : 'border-[#4A5047]'}`}><Text className={date === day ? 'text-[#75D67E]' : 'text-[#A6ACA3]'}>{new Date(`${day}T12:00:00Z`).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })}</Text></TouchableOpacity>)}</ScrollView>
      {busy ? <ActivityIndicator color="#42B84F" className="mt-5" /> : null}
      {error ? <Text className="text-[#F4B844] mt-4">{error}</Text> : null}
      {!busy && pitches.length === 0 ? <Text className="text-[#A6ACA3] mt-8 text-center">No pitches are set up for this ground.</Text> : null}
      {pitches.length > 0 ? <><Text className="text-[#F5F5F0] font-bold mt-6 mb-3">Choose a pitch</Text><View className="flex-row flex-wrap">{pitches.map((pitch) => <TouchableOpacity key={pitch.id} accessibilityRole="button" accessibilityState={{ selected: selectedPitchId === pitch.id }} onPress={() => setSelectedPitchId(pitch.id)} className={`rounded-xl border px-4 py-3 mr-2 mb-2 ${selectedPitchId === pitch.id ? 'border-[#42B84F] bg-[#17301B]' : 'border-[#455A43] bg-[#1B1F19]'}`}><Text className={selectedPitchId === pitch.id ? 'text-[#75D67E] font-bold' : 'text-[#F5F5F0] font-bold'}>{pitch.name} · {pitch.side} a-side</Text></TouchableOpacity>)}</View></> : null}
      {selectedPitch ? <View className="mt-5"><Text className="text-[#F5F5F0] text-lg font-bold">{selectedPitch.name}</Text><Text className="text-[#A6ACA3] text-sm mt-1">{selectedPitch.side} a-side · {selectedPitch.kind === 'combined' ? 'Combined pitch' : 'Separate pitch'} · {visibleSlots.length} slots</Text></View> : null}
      {!busy && selectedPitch && visibleSlots.length === 0 ? <Text className="text-[#A6ACA3] mt-7 text-center">No slots for this pitch on this date.</Text> : null}
      {visibleSlots.map((slot) => <View key={slot.id} className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-3"><Text className="text-[#F5F5F0] font-bold text-base">{formatTimeRange12(slot.start_time, slot.end_time)}</Text><Text className="text-[#A6ACA3] text-xs mt-1">{slot.is_booked ? 'Booked' : slot.is_held ? 'Payment hold' : slot.is_club_reserved ? 'Club reserved' : slot.is_blocked ? 'Blocked' : 'Available'}</Text>{!slot.is_booked && !slot.is_held ? <View className="flex-row flex-wrap mt-3">{(slot.is_blocked ? ['unblock', 'remove'] as const : ['block', 'reserve', 'remove'] as const).map((action) => <TouchableOpacity key={action} accessibilityRole="button" onPress={() => act(slot, action)} className="border border-[#4B7650] rounded-full px-4 py-2 mr-2 mb-2"><Text className="text-[#75D67E] capitalize">{action}</Text></TouchableOpacity>)}</View> : null}</View>)}
    </ScrollView>
  </SafeAreaView>;
}
