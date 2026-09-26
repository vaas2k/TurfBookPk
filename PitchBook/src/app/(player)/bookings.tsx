import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatTimeRange12 } from '@/lib/time';
import { BookingProfile, getPlayerBookings } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { goBackOrReplace } from '@/lib/navigation';

interface BookingSection {
  title: string;
  data: BookingProfile[];
  key: 'pending' | 'upcoming' | 'completed' | 'cancelled';
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<BookingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [bookingTab, setBookingTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getPlayerBookings(1);
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
      const data = await getPlayerBookings(page + 1);
      setBookings((current) => [...current, ...data.bookings]); setPage(data.pagination.page); setHasMore(data.pagination.has_more); setTotal(data.pagination.total);
    } catch (error: any) {
      setToast(error?.message || 'Unable to load more bookings.');
    } finally { setLoadingMore(false); }
  }, [hasMore, loading, loadingMore, page, refreshing]);

  useEffect(() => {
    load();
  }, [load]);

  const sections: BookingSection[] = useMemo(() => {
    const now = new Date();
    const pakistanNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    const todayStr = pakistanNow.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const pending: BookingProfile[] = [];
    const upcoming: BookingProfile[] = [];
    const completed: BookingProfile[] = [];
    const cancelled: BookingProfile[] = [];

    bookings.forEach((item) => {
      if (item.status === 'pending_payment') {
        pending.push(item);
      } else if (item.status === 'cancelled' || item.status === 'expired') {
        cancelled.push(item);
      } else if (item.status === 'completed' || item.status === 'no_show') {
        completed.push(item);
      } else if (item.status === 'confirmed') {
        const isPast = item.date < todayStr || (item.date === todayStr && item.end_time < timeStr);
        if (isPast) {
          completed.push(item);
        } else {
          upcoming.push(item);
        }
      } else {
        completed.push(item);
      }
    });

    const result: BookingSection[] = [];
    if (pending.length > 0) {
      result.push({ title: 'Pending Payment / On Hold', data: pending, key: 'pending' });
    }
    if (upcoming.length > 0) {
      result.push({ title: 'Upcoming Bookings', data: upcoming, key: 'upcoming' });
    }
    if (completed.length > 0) {
      result.push({ title: 'Completed & Past', data: completed, key: 'completed' });
    }
    if (cancelled.length > 0) {
      result.push({ title: 'Cancelled & Expired', data: cancelled, key: 'cancelled' });
    }
    return result;
  }, [bookings]);

  const visibleSections = useMemo(() => sections.filter((section) => bookingTab === 'upcoming'
    ? section.key === 'pending' || section.key === 'upcoming'
    : bookingTab === 'past' ? section.key === 'completed' : section.key === 'cancelled'), [bookingTab, sections]);

  const renderBookingItem = ({ item }: { item: BookingProfile }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View booking ${item.booking_number} for ${item.ground_title}`}
      onPress={() => router.push({ pathname: '/(player)/booking/[id]', params: { id: item.id } })}
      className="bg-[#181C16] rounded-[22px] p-4 mb-4 border border-[#254527]"
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
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-lg" numberOfLines={1}>
            {item.ground_title}
          </Text>
          <Text className="text-[#AFAFA9] text-sm mt-1">
            {item.date} · {formatTimeRange12(item.start_time, item.end_time)}
          </Text>
        </View>
        <BookingStatusBadge status={item.status} paymentStatus={item.payment_status} />
      </View>

      <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-[#30382B]">
        <Text className="text-[#888D84] text-xs font-mono">
          #{item.booking_number}
        </Text>
        <Text className="text-[#3DB54A] font-bold text-base">
          PKR {item.total_amount.toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: BookingSection }) => (
    <View className="flex-row items-center justify-between pt-5 pb-2 bg-[#10120F]">
      <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 19 }} className="uppercase tracking-wider text-[#D6D7D0]">
        {section.title}
      </Text>
      <View className="bg-[#22281E] rounded-full px-2 py-0.5">
        <Text className="text-xs font-bold text-[#BFC1B9]">
          {section.data.length}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" translucent={false} />
      {/* Top Header */}
      <View className="bg-[#10120F] px-5 pt-5 pb-3">
        <View>
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 27, letterSpacing: 0.35 }} className="text-[#F8F7F0]">MY BOOKINGS</Text>
          <Text className="text-[#AFAFA9] text-xs mt-0.5">
            {total} {total === 1 ? 'total reservation' : 'total reservations'}
          </Text>
        </View>
        <View className="mt-6 bg-[#1B1F19] rounded-full p-1 flex-row">
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: bookingTab === 'upcoming' }} onPress={() => setBookingTab('upcoming')} className={`flex-1 items-center py-3 rounded-full ${bookingTab === 'upcoming' ? 'bg-[#3DB54A]' : ''}`}><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className={bookingTab === 'upcoming' ? 'text-white text-sm' : 'text-[#AFAFA9] text-sm'}>Upcoming</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: bookingTab === 'past' }} onPress={() => setBookingTab('past')} className={`flex-1 items-center py-3 rounded-full ${bookingTab === 'past' ? 'bg-[#3DB54A]' : ''}`}><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className={bookingTab === 'past' ? 'text-white text-sm' : 'text-[#AFAFA9] text-sm'}>Past</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: bookingTab === 'cancelled' }} onPress={() => setBookingTab('cancelled')} className={`flex-1 items-center py-3 rounded-full ${bookingTab === 'cancelled' ? 'bg-[#3DB54A]' : ''}`}><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className={bookingTab === 'cancelled' ? 'text-white text-sm' : 'text-[#AFAFA9] text-sm'}>Cancelled</Text></TouchableOpacity>
        </View>
      </View>

      {loading && bookings.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3DB54A" />
        </View>
      ) : bookings.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-16 h-16 rounded-full bg-[#20251D] items-center justify-center mb-4">
            <Ionicons name="calendar-outline" size={34} color="#3DB54A" />
          </View>
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 23 }} className="text-[#F8F7F0]">NO BOOKINGS YET</Text>
          <Text className="text-[#AFAFA9] text-center mt-1 text-sm max-w-xs">
            Find the best turf football grounds in your city and book your next match slot.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/(player)')}
            className="mt-6 bg-[#3DB54A] rounded-full px-7 py-3.5"
            style={{
              shadowColor: '#3DB54A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text className="text-white font-bold text-sm">Discover Grounds</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={visibleSections}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          renderSectionHeader={renderSectionHeader}
          ListEmptyComponent={<View className="items-center pt-16"><Ionicons name="calendar-outline" size={34} color="#3DB54A" /><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F3F4EF] mt-3">No {bookingTab} bookings</Text><Text className="text-[#AFAFA9] text-sm mt-1">Your {bookingTab} reservations will appear here.</Text></View>}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color="#4CAF50" /> : null}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, backgroundColor: '#10120F' }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#3DB54A"
              colors={['#3DB54A']}
            />
          }
        />
      )}

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
