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
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { shortBookingReference } from '@/lib/booking-reference';

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
  const [toast, setToast] = useState<string | null>(null);
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(() => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10));

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getVendorBookings(1);
      setBookings(data.bookings); setPage(1); setHasMore(data.pagination.has_more);
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
      setBookings((current) => [...current, ...data.bookings]); setPage(data.pagination.page); setHasMore(data.pagination.has_more);
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

  const periodSummary = useMemo(() => {
    const visible = sections.flatMap((section) => section.data);
    const cancelled = visible.filter((booking) => booking.status === 'cancelled' || booking.status === 'expired').length;
    const active = visible.length - cancelled;
    const earnings = visible
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'expired')
      .reduce((sum, booking) => sum + booking.vendor_amount, 0);
    const today = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const title = range === 'day'
      ? selectedDate === today ? "Today's bookings" : 'Bookings on this date'
      : range === 'week' ? 'Bookings this week' : 'Bookings this month';
    return { title, total: visible.length, active, cancelled, earnings };
  }, [range, sections, selectedDate]);

  const renderBookingCard = ({ item }: { item: BookingProfile }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View booking ${shortBookingReference(item.booking_number)} for ${item.ground_title}`}
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
            {formatTimeRange12(item.start_time, item.end_time)}{item.pitch_name ? ` · ${item.pitch_name}` : ''}
          </Text>
          <Text className="text-[#AFAFA9] text-sm mt-1">
            {item.player_name || 'Player'} · {item.ground_title}
          </Text>
        </View>
        <BookingStatusBadge status={item.status} paymentStatus={item.payment_status} isRecurringReservation={item.is_recurring_reservation} />
      </View>

      {item.is_recurring_reservation && item.status === 'pending_payment' && item.reservation_expires_at && (
        <View className="mt-3 rounded-xl border border-[#6C5724] bg-[#282315] px-3 py-2.5 flex-row items-center">
          <Ionicons name="time-outline" size={16} color="#F4B844" />
          <Text className="ml-2 flex-1 text-xs text-[#E6D39A]">Reserved for this player · payment due by {new Date(item.reservation_expires_at).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Karachi' })}</Text>
        </View>
      )}

      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-[#30372B]">
        <Text className="text-[#92978F] text-xs">Ref #{shortBookingReference(item.booking_number)}</Text>
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
      <View className="px-6 pt-5">
        <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 27 }} className="text-[#F5F5F0]">BOOKING HISTORY</Text>
        <View className="bg-[#1B1F19] rounded-[14px] p-1 flex-row mt-4">{(['day', 'week', 'month'] as const).map((item) => <TouchableOpacity accessibilityRole="button" key={item} onPress={() => setRange(item)} className={`flex-1 min-h-[44px] rounded-[10px] items-center justify-center ${range === item ? 'bg-[#3EAF4C]' : ''}`}><Text className={range === item ? 'text-[#102012] font-bold' : 'text-[#B2B5AF] font-bold'}>{item[0].toUpperCase() + item.slice(1)}</Text></TouchableOpacity>)}</View>
        <View className="flex-row items-center justify-between mt-4 mb-3">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous booking date" onPress={() => { const next = new Date(`${selectedDate}T12:00:00+05:00`); next.setDate(next.getDate() - (range === 'day' ? 1 : range === 'week' ? 7 : 30)); setSelectedDate(next.toISOString().slice(0, 10)); }} className="min-h-[44px] min-w-[44px] rounded-lg bg-[#1B1F19] items-center justify-center"><Ionicons name="chevron-back" size={20} color="#F5F5F0" /></TouchableOpacity>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0]">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-PK', { weekday: range === 'day' ? 'long' : undefined, month: 'short', day: 'numeric', year: range === 'month' ? 'numeric' : undefined })}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next booking date" onPress={() => { const next = new Date(`${selectedDate}T12:00:00+05:00`); next.setDate(next.getDate() + (range === 'day' ? 1 : range === 'week' ? 7 : 30)); setSelectedDate(next.toISOString().slice(0, 10)); }} className="min-h-[44px] min-w-[44px] rounded-lg bg-[#1B1F19] items-center justify-center"><Ionicons name="chevron-forward" size={20} color="#F5F5F0" /></TouchableOpacity>
        </View>
        <View className="rounded-[16px] border border-[#345A38] bg-[#172319] p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-3"><View className="h-11 w-11 rounded-xl bg-[#2E7137] items-center justify-center mr-3"><Ionicons name="calendar" size={22} color="#F5F5F0" /></View><View className="flex-1"><Text className="text-[#AEB5AC] text-xs font-bold uppercase tracking-wider">{periodSummary.title}</Text><Text className="text-[#F5F5F0] text-2xl font-bold mt-0.5">{periodSummary.total}</Text></View></View>
            <View className="items-end"><Text className="text-[#AEB5AC] text-xs">Expected earnings</Text><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#62D06D] text-base mt-1">PKR {periodSummary.earnings.toLocaleString()}</Text></View>
          </View>
          <View className="flex-row mt-4 pt-3 border-t border-[#2B3D2D]"><Text className="text-[#D8DDD6] text-sm flex-1">{periodSummary.active} active</Text><Text className="text-[#AEB5AC] text-sm">{periodSummary.cancelled} cancelled / expired</Text></View>
        </View>
      </View>

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
          ListEmptyComponent={<View className="items-center py-12 px-6"><Ionicons name="calendar-outline" size={36} color="#747B72" /><Text className="text-[#F5F5F0] font-bold mt-3">No bookings for this period</Text><Text className="text-[#92978F] text-sm text-center mt-1">Choose another date or pull down to refresh.</Text></View>}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color="#4CAF50" /> : undefined}
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
