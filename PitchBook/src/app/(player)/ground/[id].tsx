import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPublicGround, Ground, Slot } from '@/lib/api/vendors';
import { Toast } from '@/components/ui/toast';

const fallbackImage = 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200';

export default function GroundDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ground, setGround] = useState<Ground | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (typeof id !== 'string') return;
    getPublicGround(id).then((result) => { setGround(result.ground); setSlots(result.slots); setSelectedDate(result.slots[0]?.date || null); }).catch((error: any) => setToast(error?.message || 'Unable to load this ground.')).finally(() => setLoading(false));
  }, [id]);

  const dates = useMemo(() => [...new Set(slots.map((slot) => slot.date))], [slots]);
  const visibleSlots = slots.filter((slot) => slot.date === selectedDate);
  const images = ground ? (ground.cover_image ? [ground.cover_image, ...ground.images] : ground.images) : [];

  if (loading) return <SafeAreaView className="flex-1 items-center justify-center bg-white"><ActivityIndicator color="#4CAF50" /></SafeAreaView>;
  if (!ground) return <SafeAreaView className="flex-1 items-center justify-center bg-white px-6"><Text className="text-[#1A1A2E] text-xl font-bold">Ground unavailable</Text><TouchableOpacity onPress={() => router.back()} className="mt-4"><Text className="text-[#4CAF50]">Go back</Text></TouchableOpacity><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;

  return <SafeAreaView className="flex-1 bg-white"><View className="flex-row items-center px-5 py-3 border-b border-[#E5E5E5]"><TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"><Ionicons name="arrow-back" size={22} color="#1A1A2E" /></TouchableOpacity><Text className="text-lg font-bold text-[#1A1A2E] flex-1 text-center" numberOfLines={1}>{ground.title}</Text><View className="w-10" /></View><ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>{(images.length ? images : [fallbackImage]).map((image, index) => <Image key={`${image}-${index}`} source={{ uri: image }} className="w-screen h-56" resizeMode="cover" />)}</ScrollView>
    <View className="px-5 pt-5"><Text className="text-2xl font-bold text-[#1A1A2E]">{ground.title}</Text><Text className="text-[#737373] mt-1">{ground.address}, {ground.city}</Text><View className="flex-row items-center mt-3"><Ionicons name="star" size={17} color="#F59E0B" /><Text className="font-bold ml-1">{ground.rating || 'New'}</Text><Text className="text-[#737373] ml-2">({ground.total_reviews} reviews)</Text><Text className="text-[#4CAF50] font-bold ml-auto">PKR {ground.price_per_hour}/hr</Text></View>
      <Text className="text-lg font-bold text-[#1A1A2E] mt-7 mb-3">Amenities</Text><View className="flex-row flex-wrap">{ground.amenities.map((item) => <View key={item} className="bg-[#F5F5F5] rounded-full px-3 py-2 mr-2 mb-2"><Text className="text-[#737373]">{item}</Text></View>)}</View>
      <Text className="text-lg font-bold text-[#1A1A2E] mt-6 mb-2">About this ground</Text><Text className="text-[#737373] leading-5">{ground.description || 'No description provided by the ground owner.'}</Text>
      <Text className="text-lg font-bold text-[#1A1A2E] mt-6 mb-3">Choose a date</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{dates.map((date) => <TouchableOpacity key={date} onPress={() => { setSelectedDate(date); setSelectedSlot(null); }} className={`rounded-full px-4 py-2 mr-2 ${selectedDate === date ? 'bg-[#4CAF50]' : 'bg-[#F5F5F5]'}`}><Text className={selectedDate === date ? 'text-white font-bold' : 'text-[#737373]'}>{date}</Text></TouchableOpacity>)}</ScrollView>
      <Text className="text-lg font-bold text-[#1A1A2E] mt-6 mb-3">Available slots</Text>{visibleSlots.length === 0 ? <Text className="text-[#737373]">No slots available for this date.</Text> : visibleSlots.map((slot) => { const available = !slot.is_booked && !slot.is_blocked; return <TouchableOpacity key={slot.id} disabled={!available} onPress={() => setSelectedSlot(slot)} className={`flex-row items-center justify-between rounded-xl p-4 mb-2 border ${selectedSlot?.id === slot.id ? 'border-[#4CAF50] bg-[#E8F5E9]' : available ? 'border-[#E5E5E5] bg-white' : 'border-transparent bg-[#F5F5F5]'}`}><View><Text className={available ? 'text-[#1A1A2E] font-bold' : 'text-[#A3A3A3]'}>{slot.start_time} - {slot.end_time}</Text><Text className={available ? 'text-[#4CAF50] mt-1' : 'text-[#A3A3A3] mt-1'}>{available ? `PKR ${slot.price}` : slot.is_booked ? 'Booked' : 'Blocked'}</Text></View>{available && <Ionicons name={selectedSlot?.id === slot.id ? 'checkmark-circle' : 'ellipse-outline'} size={24} color="#4CAF50" />}</TouchableOpacity>; })}
    </View></ScrollView><View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-5 py-4"><TouchableOpacity disabled={!selectedSlot} onPress={() => selectedSlot && router.push({ pathname: '/(player)/payment-method', params: { slotId: selectedSlot.id, groundTitle: ground.title, groundAddress: ground.address, date: selectedSlot.date, startTime: selectedSlot.start_time, endTime: selectedSlot.end_time, amount: String(selectedSlot.price) } })} className={`rounded-full py-4 items-center ${selectedSlot ? 'bg-[#4CAF50]' : 'bg-[#D4D4D4]'}`}><Text className="text-white font-bold">{selectedSlot ? `Continue · PKR ${selectedSlot.price}` : 'Select a slot'}</Text></TouchableOpacity></View><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
