import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatTimeRange12 } from '@/lib/time';
import { BookingProfile, getVendorBookings } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';

interface VendorBookingSection {
  title: string;
  data: BookingProfile[];
  key: 'today' | 'upcoming' | 'past' | 'cancelled';
}

export default function VendorBookings() {
  const [bookings, setBookings] = useState<BookingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(() => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getVendorBookings(1);
      setBookings(data.bookings); setPage(1); setHasMore(data.pagination.has_more); setTotal(data.pagination.total);
    } catch (error: any) {
      setToast(error?.message || 'Unable to load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await getVendorBookings(page + 1);
      setBookings((current) => [...current, ...data.bookings]); setPage(data.pagination.page); setHasMore(data.pagination.has_more); setTotal(data.pagination.total);
    } catch (error: any) {
      setToast(error?.message || 'Unable to load more bookings.');
    } finally { setLoadingMore(false); }
  }, [hasMore, loading, loadingMore, page, refreshing]);

  useEffect(() => {
    load();
  }, [load]);

  const sections: VendorBookingSection[] = useMemo(() => {
    const todayStr = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().split('T')[0];

    const today: BookingProfile[] = [];
    const upcoming: BookingProfile[] = [];
    const past: BookingProfile[] = [];
    const cancelled: BookingProfile[] = [];

    const selected = new Date(`${selectedDate}T12:00:00+05:00`);
    const start = range === 'month' ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(selected);
    if (range === 'week') start.setDate(selected.getDate() - selected.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (range === 'month') end.setMonth(end.getMonth() + 1); else end.setDate(end.getDate() + (range === 'week' ? 7 : 1));
    bookings.filter((b) => { const date = new Date(`${b.date}T12:00:00+05:00`); return date >= start && date < end; }).forEach((b) => {
      if (b.status === 'cancelled' || b.status === 'expired') {
        cancelled.push(b);
      } else if (b.date === todayStr) {
        today.push(b);
      } else if (b.date > todayStr) {
        upcoming.push(b);
      } else {
        past.push(b);
      }
    });

    const result: VendorBookingSection[] = [];
    if (today.length > 0) {
      result.push({ title: "Today's Schedule", data: today, key: 'today' });
    }
    if (upcoming.length > 0) {
      result.push({ title: 'Upcoming Bookings', data: upcoming, key: 'upcoming' });
    }
    if (past.length > 0) {
      result.push({ title: 'Past / Completed', data: past, key: 'past' });
    }
    if (cancelled.length > 0) {
      result.push({ title: 'Cancelled & Expired', data: cancelled, key: 'cancelled' });
    }
    return result;
  }, [bookings, range, selectedDate]);

  const renderBookingCard = ({ item }: { item: BookingProfile }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View booking ${item.booking_number} for ${item.ground_title}`}
      onPress={() => router.push({ pathname: '/(vendor)/booking/[id]', params: { id: item.id } })}
      className="bg-[#1B1F19] rounded-[14px] p-4 mb-3 border border-[#30372B]"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
          <Text className="text-[#F5F5F0] text-base font-bold" numberOfLines={1}>
            {formatTimeRange12(item.start_time, item.end_time)}
          </Text>
          <Text className="text-[#AFAFA9] text-sm mt-1">
            {item.player_name || 'Player'} · {item.ground_title}
          </Text>
        </View>
        <BookingStatusBadge status={item.status} paymentStatus={item.payment_status} />
      </View>

      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-[#30372B]">
        <Text className="text-[#92978F] text-xs">Ref #{item.booking_number}</Text>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#50C15B] text-sm">PKR {item.vendor_amount.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: VendorBookingSection }) => (
    <View className="hidden">
      <Text className="text-sm font-bold uppercase tracking-wider text-[#4B5563]">
        {section.title}
      </Text>
      <View className="bg-[#E5E7EB] rounded-full px-2 py-0.5">
        <Text className="text-xs font-bold text-[#4B5563]">
          {section.data.length}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#10120F]">
      {/* Top Header */}
      <View className="px-6 pt-5"><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 27 }} className="text-[#F5F5F0]">BOOKING HISTORY</Text><Text className="text-[#55C561] text-sm mt-0.5">{total} booking{total === 1 ? '' : 's'} across your grounds</Text><View className="bg-[#1B1F19] rounded-[14px] p-1 flex-row mt-4">{(['day', 'week', 'month'] as const).map((item) => <TouchableOpacity key={item} onPress={() => setRange(item)} className={`flex-1 min-h-[42px] rounded-[10px] items-center justify-center ${range === item ? 'bg-[#3EAF4C]' : ''}`}><Text className={range === item ? 'text-[#102012] font-bold' : 'text-[#B2B5AF] font-bold'}>{item[0].toUpperCase() + item.slice(1)}</Text></TouchableOpacity>)}</View><View className="flex-row items-center justify-between mt-4 mb-2"><TouchableOpacity onPress={() => { const next = new Date(`${selectedDate}T12:00:00+05:00`); next.setDate(next.getDate() - (range === 'day' ? 1 : range === 'week' ? 7 : 30)); setSelectedDate(next.toISOString().slice(0, 10)); }} className="h-9 w-9 rounded-lg bg-[#1B1F19] items-center justify-center"><Ionicons name="chevron-back" size={20} color="#F5F5F0" /></TouchableOpacity><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0]">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-PK', { weekday: range === 'day' ? 'long' : undefined, month: 'short', day: 'numeric', year: range === 'month' ? 'numeric' : undefined })}</Text><TouchableOpacity onPress={() => { const next = new Date(`${selectedDate}T12:00:00+05:00`); next.setDate(next.getDate() + (range === 'day' ? 1 : range === 'week' ? 7 : 30)); setSelectedDate(next.toISOString().slice(0, 10)); }} className="h-9 w-9 rounded-lg bg-[#1B1F19] items-center justify-center"><Ionicons name="chevron-forward" size={20} color="#F5F5F0" /></TouchableOpacity></View></View>

      {loading && bookings.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : bookings.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-[#E5E7EB]/50 items-center justify-center mb-4">
            <Ionicons name="calendar-outline" size={42} color="#9CA3AF" />
          </View>
          <Text className="text-[#1A1A2E] text-xl font-bold">No bookings yet</Text>
          <Text className="text-[#737373] text-center mt-1 text-sm max-w-xs">
            When players reserve slots at your grounds, their bookings will appear here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingCard}
          renderSectionHeader={renderSectionHeader}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color="#4CAF50" /> : null}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#4CAF50"
              colors={['#4CAF50']}
            />
          }
        />
      )}

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
