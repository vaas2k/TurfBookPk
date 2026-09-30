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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatTimeRange12 } from '@/lib/time';
import { BookingProfile, getPlayerBookings } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppearanceStore } from '@/store/appearanceStore';
import { playerThemes } from '@/theme/playerTheme';

interface BookingSection {
  title: string;
  data: BookingProfile[];
  key: 'pending' | 'upcoming' | 'completed' | 'cancelled';
}

export default function BookingsScreen() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const insets = useSafeAreaInsets();
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

  const renderBookingItem = ({ item }: { item: BookingProfile }) => {
    const paymentOpen = item.is_recurring_reservation && item.status === 'pending_payment' && !!item.payment_window_opens_at && !!item.reservation_expires_at && new Date(item.payment_window_opens_at).getTime() <= Date.now() && new Date(item.reservation_expires_at).getTime() > Date.now();
    return <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View booking ${item.booking_number} for ${item.ground_title}`}
      onPress={() => router.push({ pathname: '/(player)/booking/[id]', params: { id: item.id } })}
      className="rounded-[22px] p-4 mb-4 border"
      style={{
        backgroundColor: theme.surfaceRaised, borderColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 mr-3">
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: theme.text }} className="text-lg" numberOfLines={1}>
            {item.ground_title}
          </Text>
          <Text style={{ color: theme.subtle }} className="text-sm mt-1" numberOfLines={1}>
            {item.date} · {formatTimeRange12(item.start_time, item.end_time)}
          </Text>
        </View>
        <BookingStatusBadge status={item.status} paymentStatus={item.payment_status} />
      </View>

      <View className="flex-row justify-between items-center mt-3 pt-3 border-t" style={{ borderTopColor: theme.border }}>
        <Text style={{ color: theme.muted, flexShrink: 1 }} className="text-xs font-mono mr-3" numberOfLines={1}>
          #{item.booking_number}
        </Text>
        <Text style={{ color: theme.green }} className="font-bold text-base">
          PKR {item.total_amount.toLocaleString()}
        </Text>
      </View>
      {paymentOpen && <View className="bg-[#17301B] border border-[#42B84F] rounded-xl p-3 mt-3 flex-row items-center"><View className="flex-1"><Text className="text-[#57CC63] text-xs font-bold">PAYMENT WINDOW OPEN</Text><Text className="text-[#A8C9AC] text-xs mt-1">Pay now to keep this reserved slot.</Text></View><View className="bg-[#42B84F] rounded-lg px-3 py-2"><Text className="text-[#102110] text-xs font-bold">Pay now</Text></View></View>}
    </TouchableOpacity>
  };

  const renderSectionHeader = ({ section }: { section: BookingSection }) => (
    <View className="flex-row items-center justify-between pt-5 pb-2" style={{ backgroundColor: theme.canvas }}>
      <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 19, color: theme.text }} className="uppercase tracking-wider">
        {section.title}
      </Text>
      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: theme.surface }}>
        <Text style={{ color: theme.subtle }} className="text-xs font-bold">
          {section.data.length}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.canvas }}>
      <StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.canvas} translucent={false} />
      {/* Top Header */}
      <View className="px-5 pt-5 pb-3" style={{ backgroundColor: theme.canvas }}>
        <View>
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 27, letterSpacing: 0.35, color: theme.text }}>MY BOOKINGS</Text>
          <Text style={{ color: theme.subtle }} className="text-xs mt-0.5">
            {total} {total === 1 ? 'total reservation' : 'total reservations'}
          </Text>
        </View>
        <View className="mt-6 rounded-full p-1 flex-row" style={{ backgroundColor: theme.surface }}>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: bookingTab === 'upcoming' }} onPress={() => setBookingTab('upcoming')} className="flex-1 items-center py-3 rounded-full" style={bookingTab === 'upcoming' ? { backgroundColor: theme.green } : undefined}><Text adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk_700Bold', color: bookingTab === 'upcoming' ? '#FFFFFF' : theme.subtle }} className="text-sm">Upcoming</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: bookingTab === 'past' }} onPress={() => setBookingTab('past')} className="flex-1 items-center py-3 rounded-full" style={bookingTab === 'past' ? { backgroundColor: theme.green } : undefined}><Text adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk_700Bold', color: bookingTab === 'past' ? '#FFFFFF' : theme.subtle }} className="text-sm">Past</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: bookingTab === 'cancelled' }} onPress={() => setBookingTab('cancelled')} className="flex-1 items-center py-3 rounded-full" style={bookingTab === 'cancelled' ? { backgroundColor: theme.green } : undefined}><Text adjustsFontSizeToFit numberOfLines={1} style={{ fontFamily: 'SpaceGrotesk_700Bold', color: bookingTab === 'cancelled' ? '#FFFFFF' : theme.subtle }} className="text-sm">Cancelled</Text></TouchableOpacity>
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 32), backgroundColor: theme.canvas }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.green}
              colors={[theme.green]}
            />
          }
        />
      )}

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
