import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { ManagerBooking, getManagerBookings } from '@/lib/api/bookings';
import { acceptManagerAssignment, getMyManagerAssignments, ManagerAssignment } from '@/lib/api/managers';
import { shortBookingReference } from '@/lib/booking-reference';
import { formatTimeRange12 } from '@/lib/time';
import { useAuthStore } from '@/store/authStore';
import { useManagerAccessStore } from '@/store/managerAccessStore';

export default function ManagerHub() {
  const today = new Date(Date.now() + 5 * 60 * 60_000).toISOString().slice(0, 10);
  const userId = useAuthStore((state) => state.user?.id);
  const setManagerAccepted = useManagerAccessStore((state) => state.setAccepted);
  const [assignments, setAssignments] = useState<ManagerAssignment[]>([]);
  const [bookings, setBookings] = useState<ManagerBooking[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const mine = await getMyManagerAssignments();
      setAssignments(mine);
      if (mine.some((item) => item.accepted_at)) setBookings(await getManagerBookings(today));
      else setBookings([]);
      setError('');
    } catch (caught: any) { setError(caught?.message || 'Unable to load ground manager access.'); }
    finally { setBusy(false); }
  }, [today]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <SafeAreaView className="flex-1 bg-[#10120F]" edges={['top', 'bottom', 'left', 'right']}>
    <View className="px-5 pt-4"><Text className="text-[#F5F5F0] text-xl font-bold">Manage grounds</Text></View>
    <ScrollView refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} tintColor="#42B84F" />} contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
      <Text className="text-[#A6ACA3] text-sm">Bookings and check-in for your assigned grounds.</Text>
      {error ? <Text className="text-[#F4B844] mt-4">{error}</Text> : null}
      {busy && !assignments.length ? <ActivityIndicator className="mt-7" color="#42B84F" /> : null}
      {assignments.map((item) => <View key={item.id} className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-4"><View className="flex-row items-start"><View className="w-11 h-11 rounded-xl bg-[#263629] items-center justify-center mr-3"><Ionicons name="football-outline" size={23} color="#75D67E" /></View><View className="flex-1"><Text className="text-[#F5F5F0] font-bold text-base">{item.ground_title}</Text><Text className="text-[#A6ACA3] text-xs mt-1">{item.vendor_name}</Text></View></View>{item.accepted_at ? <><Text className="text-[#A6ACA3] text-sm mt-4">{bookings.filter((booking) => booking.ground_id === item.ground_id && (booking.date === today || booking.end_date === today)).length} bookings today</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(player)/manager-slots', params: { groundId: item.ground_id, title: item.ground_title } })} className="border border-[#42B84F] rounded-full py-3 items-center mt-3"><Text className="text-[#75D67E] font-bold">View and manage slots</Text></TouchableOpacity></> : <TouchableOpacity accessibilityRole="button" onPress={async () => { try { await acceptManagerAssignment(item.id); if (userId) setManagerAccepted(userId); await load(); } catch (caught: any) { setError(caught?.message || 'Unable to accept assignment.'); } }} className="bg-[#42B84F] rounded-full py-3 items-center mt-4"><Text className="text-[#102110] font-bold">Accept assignment</Text></TouchableOpacity>}</View>)}
      {assignments.some((item) => item.accepted_at) ? <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(player)/manager-scan')} className="bg-[#42B84F] rounded-full py-4 items-center mt-6 flex-row justify-center"><Ionicons name="scan-outline" size={22} color="#102110" /><Text className="text-[#102110] font-bold ml-2">Scan player QR</Text></TouchableOpacity> : null}
      <Text className="text-[#F5F5F0] text-lg font-bold mt-8">Today’s bookings</Text>
      {bookings.filter((booking) => booking.date === today || booking.end_date === today).map((booking) => <TouchableOpacity key={booking.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/(player)/manager-booking', params: { id: booking.id } })} className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-3"><Text className="text-[#F5F5F0] font-bold">{booking.player_name} · #{shortBookingReference(booking.booking_number)}</Text><Text className="text-[#A6ACA3] text-sm mt-1">{booking.ground_title} · {formatTimeRange12(booking.start_time, booking.end_time)}</Text><Text className={booking.checked_in_at ? 'text-[#75D67E] text-xs mt-2' : 'text-[#F4B844] text-xs mt-2'}>{booking.checked_in_at ? 'Checked in' : booking.status.replaceAll('_', ' ')}</Text></TouchableOpacity>)}
      {!busy && assignments.some((item) => item.accepted_at) && !bookings.some((booking) => booking.date === today || booking.end_date === today) ? <Text className="text-[#A6ACA3] text-sm mt-4">No bookings at your assigned grounds today.</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
