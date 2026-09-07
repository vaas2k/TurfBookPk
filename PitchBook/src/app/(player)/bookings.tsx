import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listPlayerBookings, BookingProfile } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<BookingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setBookings(await listPlayerBookings()); } catch (error: any) { setToast(error?.message || 'Unable to load bookings.'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><View className="bg-white px-6 py-5 border-b border-[#E5E5E5]"><Text className="text-2xl font-bold text-[#1A1A2E]">MY BOOKINGS</Text><Text className="text-[#737373] mt-1">{bookings.length} bookings</Text></View><ScrollView className="flex-1 px-4 pt-4" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>{loading && bookings.length === 0 ? <ActivityIndicator color="#4CAF50" /> : bookings.length === 0 ? <View className="items-center py-16"><Ionicons name="calendar-outline" size={60} color="#D4D4D4" /><Text className="text-[#1A1A2E] text-xl font-bold mt-4">No bookings yet</Text><TouchableOpacity onPress={() => router.push('/(player)')} className="mt-5 bg-[#4CAF50] rounded-full px-6 py-3"><Text className="text-white font-bold">Discover grounds</Text></TouchableOpacity></View> : bookings.map((booking) => <View key={booking.id} className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"><View className="flex-row justify-between"><View className="flex-1"><Text className="text-[#1A1A2E] text-base font-bold">{booking.ground_title}</Text><Text className="text-[#737373] mt-1">{booking.date} · {booking.start_time} - {booking.end_time}</Text><Text className="text-[#4CAF50] font-bold mt-2">PKR {booking.total_amount}</Text></View><Text className={`font-bold ${booking.status === 'cancelled' ? 'text-[#DC2626]' : 'text-[#4CAF50]'}`}>{booking.status}</Text></View><Text className="text-[#A3A3A3] text-xs mt-3">{booking.booking_number}</Text></View>)}</ScrollView><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
