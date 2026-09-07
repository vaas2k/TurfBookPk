import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookingProfile, listVendorBookings } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';

export default function VendorBookings() {
  const [bookings, setBookings] = useState<BookingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setBookings(await listVendorBookings()); } catch (error: any) { setToast(error?.message || 'Unable to load bookings.'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><View className="px-6 py-5 bg-white border-b border-[#E5E5E5]"><Text className="text-2xl font-bold text-[#1A1A2E]">Bookings</Text><Text className="text-[#737373] mt-1">{bookings.length} player bookings</Text></View><ScrollView className="flex-1 px-4 pt-4" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>{loading && bookings.length === 0 ? <ActivityIndicator color="#4CAF50" /> : bookings.length === 0 ? <View className="items-center py-16"><Text className="text-[#737373]">No bookings yet.</Text></View> : bookings.map((booking) => <View key={booking.id} className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"><View className="flex-row justify-between"><View className="flex-1"><Text className="text-[#1A1A2E] text-base font-bold">{booking.ground_title}</Text><Text className="text-[#737373] mt-1">{booking.date} · {booking.start_time} - {booking.end_time}</Text><Text className="text-[#1A1A2E] font-medium mt-2">{booking.player_name}</Text><Text className="text-[#737373] text-sm">{booking.player_phone || 'Phone unavailable'}</Text></View><Text className={`font-bold ${booking.status === 'cancelled' ? 'text-[#DC2626]' : 'text-[#4CAF50]'}`}>{booking.status}</Text></View><Text className="text-[#4CAF50] font-bold mt-3">PKR {booking.vendor_amount}</Text><Text className="text-[#A3A3A3] text-xs mt-2">{booking.booking_number}</Text></View>)}</ScrollView><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
