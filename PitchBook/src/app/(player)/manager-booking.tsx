import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getManagerBookingDispute, getManagerBooking, ManagerBooking, ManagerBookingDispute, manualCheckIn, markBookingCompleted, markBookingNoShow, recordDelayedStart, respondToBookingDispute } from '@/lib/api/bookings';
import { shortBookingReference } from '@/lib/booking-reference';
import { formatTimeRange12 } from '@/lib/time';

export default function ManagerBookingScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<ManagerBooking | null>(null);
  const [dispute, setDispute] = useState<ManagerBookingDispute | null>(null);
  const [response, setResponse] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const [item, issue] = await Promise.all([getManagerBooking(id), getManagerBookingDispute(id)]); setBooking(item); setDispute(issue); setError(''); }
    catch (caught: any) { setError(caught?.message || 'Unable to load booking.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const act = async (operation: () => Promise<unknown>) => { setBusy(true); try { await operation(); await load(); } catch (caught: any) { setError(caught?.message || 'Action failed.'); } finally { setBusy(false); } };
  const end = booking ? new Date(`${booking.end_date}T${booking.end_time}+05:00`).getTime() : 0;
  const ended = Boolean(end && Date.now() >= end);
  const canRespond = dispute && ['open', 'waiting'].includes(dispute.status) && !dispute.vendor_response;
  const issueLabel = dispute?.category === 'delayed_start' ? 'Delayed start' : dispute?.category === 'ground_closed' ? 'Ground closed' : dispute?.category === 'pitch_quality' ? 'Pitch quality' : dispute?.category === 'booking_not_honored' ? 'Booking not honored' : 'Other issue';
  return <SafeAreaView className="flex-1 bg-[#10120F]" edges={['top', 'bottom', 'left', 'right']}>
    <View className="flex-row items-center px-5 pt-3"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="w-11 h-11 justify-center"><Ionicons name="arrow-back" size={24} color="#F5F5F0" /></TouchableOpacity><Text className="text-[#F5F5F0] text-xl font-bold ml-2">Match attendance</Text></View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {!booking ? <ActivityIndicator color="#42B84F" className="mt-10" /> : <View className="bg-[#1B1F19] rounded-2xl border border-[#30372B] p-5"><Text className="text-[#F5F5F0] text-xl font-bold">{booking.player_name}</Text><Text className="text-[#A6ACA3] text-sm mt-2">#{shortBookingReference(booking.booking_number)} · {booking.ground_title}</Text><Text className="text-[#A6ACA3] text-sm mt-2">{booking.date} · {formatTimeRange12(booking.start_time, booking.end_time)}</Text><Text className={booking.checked_in_at ? 'text-[#75D67E] mt-3' : 'text-[#F4B844] mt-3'}>{booking.checked_in_at ? `Checked in at ${new Date(booking.checked_in_at).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for check-in'}</Text><Text className="text-[#A6ACA3] text-xs mt-2">{booking.status.replaceAll('_', ' ')} · {booking.payment_status}</Text></View>}
      {error ? <Text className="text-[#F4B844] mt-4">{error}</Text> : null}
      {booking?.status === 'confirmed' && !booking.checked_in_at ? <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(player)/manager-scan')} className="bg-[#42B84F] rounded-full py-4 mt-5 items-center"><Text className="text-[#102110] font-bold">Scan player QR</Text></TouchableOpacity> : null}
      {booking?.status === 'confirmed' && !booking.checked_in_at ? <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-4"><Text className="text-[#F5F5F0] font-bold">Camera not working?</Text><Text className="text-[#A6ACA3] text-xs mt-1">Ask the player for the eight-digit code shown beside their QR.</Text><TextInput accessibilityLabel="Eight-digit check-in code" keyboardType="number-pad" maxLength={8} value={code} onChangeText={setCode} placeholder="Eight-digit code" placeholderTextColor="#8E948B" className="bg-[#10120F] border border-[#30372B] rounded-xl px-4 py-3 text-[#F5F5F0] mt-3" /><TouchableOpacity accessibilityRole="button" disabled={busy || code.length !== 8} onPress={() => void act(() => manualCheckIn(id, code))} className="border border-[#42B84F] rounded-full py-3 items-center mt-3"><Text className="text-[#75D67E] font-bold">Confirm code</Text></TouchableOpacity></View> : null}
      {booking?.status === 'confirmed' && ended ? <View className="mt-5"><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void act(() => markBookingCompleted(id))} className="border border-[#42B84F] rounded-full py-4 items-center"><Text className="text-[#75D67E] font-bold">Mark match completed</Text></TouchableOpacity>{!booking.checked_in_at ? <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void act(() => markBookingNoShow(id))} className="border border-[#9B3A37] rounded-full py-4 items-center mt-3"><Text className="text-[#F26666] font-bold">Mark no-show</Text></TouchableOpacity> : null}</View> : null}
      {booking?.status === 'confirmed' && !ended ? <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void act(() => recordDelayedStart(id, 'venue_delay'))} className="border border-[#9B7A38] rounded-full py-4 items-center mt-5"><Text className="text-[#F4B844] font-bold">Record delayed start</Text></TouchableOpacity> : null}
      {dispute ? <View className="mt-7 bg-[#242019] border border-[#6B5837] rounded-2xl p-4"><Text className="text-[#F4D28D] font-bold">Player reported: {issueLabel}</Text><Text className="text-[#AFAFA9] text-xs mt-1">Status: {dispute.status.replaceAll('_', ' ')}</Text><Text className="text-[#F5F5F0] text-sm mt-4">{dispute.description}</Text>{dispute.vendor_response ? <View className="border-t border-[#554831] mt-4 pt-4"><Text className="text-[#F4D28D] text-xs font-bold">VENUE RESPONSE</Text><Text className="text-[#F5F5F0] text-sm mt-2">{dispute.vendor_response}</Text></View> : null}</View> : null}
      {canRespond && dispute ? <View className="mt-5"><Text className="text-[#F5F5F0] font-bold">Respond to player issue</Text><TextInput accessibilityLabel="Response to player issue" value={response} onChangeText={setResponse} multiline placeholder="Explain what happened at the ground" placeholderTextColor="#A6ACA3" className="bg-[#1B1F19] border border-[#30372B] rounded-xl p-4 text-[#F5F5F0] mt-3 min-h-24" /><TouchableOpacity accessibilityRole="button" disabled={busy || response.trim().length < 10} onPress={() => void act(() => respondToBookingDispute(id, dispute.id, response.trim()))} className="bg-[#42B84F] rounded-full py-4 items-center mt-3"><Text className="text-[#102110] font-bold">Send response</Text></TouchableOpacity></View> : null}
    </ScrollView>
  </SafeAreaView>;
}
