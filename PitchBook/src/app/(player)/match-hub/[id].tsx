import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { BookingDispute, BookingProfile, getBooking, getBookingDispute, openBookingDispute } from '@/lib/api/bookings';
import { formatTimeRange12 } from '@/lib/time';
import { goBackOrReplace } from '@/lib/navigation';
import { Toast } from '@/components/ui/toast';

const categories = [
  ['delayed_start', 'Delayed start', 'time-outline'],
  ['ground_closed', 'Ground closed', 'lock-closed-outline'],
  ['pitch_quality', 'Pitch quality', 'warning-outline'],
  ['booking_not_honored', 'Booking not honored', 'close-circle-outline'],
  ['other', 'Other issue', 'ellipsis-horizontal-circle-outline'],
] as const;

export default function MatchHubScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [booking, setBooking] = useState<BookingProfile | null>(null);
  const [dispute, setDispute] = useState<BookingDispute | null>(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextBooking, nextDispute] = await Promise.all([getBooking(id), getBookingDispute(id)]);
      setBooking(nextBooking); setDispute(nextDispute);
    } catch (error: any) { setToast(error?.message || 'Unable to load the match hub.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const windowState = useMemo(() => {
    if (!booking) return { live: false, canReport: false, label: '' };
    const now = Date.now();
    const start = new Date(`${booking.date}T${booking.start_time}+05:00`).getTime();
    const end = new Date(`${booking.end_date || booking.date}T${booking.end_time}+05:00`).getTime();
    return { live: now >= start && now < end, canReport: now >= start && now <= end + 2 * 60 * 60_000, label: now < start ? 'Starting soon' : now < end ? 'Match live' : 'Match ended' };
  }, [booking]);

  const submit = async () => {
    if (!category || description.trim().length < 10) { setToast('Choose an issue and add at least 10 characters.'); return; }
    setSaving(true);
    try { setDispute(await openBookingDispute(id, { category, description: description.trim() })); setToast('Issue sent. The venue can respond and our team will review it.'); }
    catch (error: any) { setToast(error?.message || 'Unable to report this issue.'); }
    finally { setSaving(false); }
  };

  if (loading || !booking) return <SafeAreaView className="flex-1 bg-[#10120F] items-center justify-center"><StatusBar barStyle="light-content" /><ActivityIndicator color="#3DB54A" size="large" /><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
    <StatusBar barStyle="light-content" />
    <View className="px-5 py-3 flex-row items-center"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOrReplace(`/(player)/booking/${id}`)} className="w-11 h-11 items-center justify-center"><Ionicons name="chevron-back" size={28} color="#F8F7F0" /></TouchableOpacity><Text className="text-[#F8F7F0] text-xl font-bold ml-2">Match Hub</Text><View className="ml-auto rounded-full border border-[#3DB54A] px-3 py-1.5"><Text className="text-[#71D77A] text-xs font-bold">{windowState.label}</Text></View></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20) + 30 }}>
      <View className="bg-[#181C16] border border-[#30372B] rounded-[24px] p-5 mt-2"><Text className="text-[#F8F7F0] text-lg font-bold">{booking.ground_title}</Text><Text className="text-[#AFAFA9] text-sm mt-2">{booking.pitch_name || 'Pitch'} · {formatTimeRange12(booking.start_time, booking.end_time)}</Text><Text className="text-[#AFAFA9] text-xs mt-2">Booking #{booking.booking_number}</Text><TouchableOpacity accessibilityRole="link" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.ground_address)}`)} className="rounded-full bg-[#3DB54A] py-3.5 items-center mt-5"><Text className="text-[#102110] font-bold">Get directions</Text></TouchableOpacity></View>
      <View className="bg-white rounded-[24px] p-5 mt-4 flex-row items-center"><Ionicons name="qr-code-outline" size={48} color="#10120F" /><View className="ml-4 flex-1"><Text className="text-[#10120F] font-bold">Ground check-in</Text><Text selectable className="text-[#10120F] text-lg font-bold mt-1">{booking.booking_number}</Text></View></View>
      {dispute ? <View className="bg-[#242019] border border-[#6B5837] rounded-[24px] p-5 mt-4"><Text className="text-[#F4D28D] font-bold">Issue status: {dispute.status.replaceAll('_', ' ')}</Text><Text className="text-[#DDD4C4] text-sm mt-3">{dispute.description}</Text>{dispute.vendor_response ? <View className="border-t border-[#554831] mt-4 pt-4"><Text className="text-[#F4D28D] text-xs font-bold">VENUE RESPONSE</Text><Text className="text-[#DDD4C4] text-sm mt-2">{dispute.vendor_response}</Text></View> : <Text className="text-[#B7A98F] text-xs mt-3">Waiting for the venue response.</Text>}</View> : windowState.canReport ? <View className="bg-[#181C16] border border-[#30372B] rounded-[24px] p-5 mt-4"><Text className="text-[#F8F7F0] text-base font-bold">Something went wrong?</Text><Text className="text-[#AFAFA9] text-xs mt-1">Report during the match or within two hours after it ends.</Text><View className="flex-row flex-wrap gap-2 mt-4">{categories.map(([value, label, icon]) => <TouchableOpacity key={value} onPress={() => setCategory(value)} className={`border rounded-full px-3 py-2 flex-row items-center ${category === value ? 'bg-[#17301B] border-[#3DB54A]' : 'border-[#3A4036]'}`}><Ionicons name={icon} size={15} color={category === value ? '#71D77A' : '#AFAFA9'} /><Text className={`text-xs ml-1.5 ${category === value ? 'text-[#71D77A]' : 'text-[#D4D6D0]'}`}>{label}</Text></TouchableOpacity>)}</View><TextInput value={description} onChangeText={setDescription} multiline maxLength={1000} placeholder="Describe what happened..." placeholderTextColor="#777C74" textAlignVertical="top" className="h-28 bg-[#10130F] border border-[#343A30] rounded-2xl px-4 py-3 text-[#F8F7F0] mt-4" /><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={submit} className="rounded-full border border-[#F2A34A] py-3.5 items-center mt-4">{saving ? <ActivityIndicator color="#F2A34A" /> : <Text className="text-[#F2A34A] font-bold">Send issue for review</Text>}</TouchableOpacity></View> : <View className="bg-[#181C16] border border-[#30372B] rounded-[20px] p-4 mt-4"><Text className="text-[#AFAFA9] text-sm">Issue reporting opens when the match starts and closes two hours after it ends.</Text></View>}
    </ScrollView><Toast message={toast} onHide={() => setToast(null)} />
  </SafeAreaView>;
}
