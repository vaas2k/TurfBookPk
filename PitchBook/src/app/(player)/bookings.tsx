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
import { BookingProfile, listPlayerBookings } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';

interface BookingSection {
  title: string;
  data: BookingProfile[];
  key: 'pending' | 'upcoming' | 'completed' | 'cancelled';
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<BookingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listPlayerBookings();
      setBookings(data);
    } catch (error: any) {
      setToast(error?.message || 'Unable to load bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  const renderBookingItem = ({ item }: { item: BookingProfile }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View booking ${item.booking_number} for ${item.ground_title}`}
      onPress={() => router.push({ pathname: '/(player)/booking/[id]', params: { id: item.id } })}
      className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"
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
          <Text className="text-[#1A1A2E] text-base font-bold" numberOfLines={1}>
            {item.ground_title}
          </Text>
          <Text className="text-[#737373] text-sm mt-1">
            {item.date} · {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
          </Text>
        </View>
        <BookingStatusBadge status={item.status} paymentStatus={item.payment_status} />
      </View>

      <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-[#F5F5F5]">
        <Text className="text-[#A3A3A3] text-xs font-mono">
          #{item.booking_number}
        </Text>
        <Text className="text-[#4CAF50] font-bold text-base">
          PKR {item.total_amount.toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: BookingSection }) => (
    <View className="flex-row items-center justify-between pt-4 pb-2 bg-[#F8F9FA]">
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
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      {/* Top Header */}
      <View className="bg-white px-6 py-4 border-b border-[#E5E5E5]">
        <Text className="text-2xl font-bold text-[#1A1A2E]">MY BOOKINGS</Text>
        <Text className="text-[#737373] text-xs mt-0.5">
          {bookings.length} {bookings.length === 1 ? 'total reservation' : 'total reservations'}
        </Text>
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
            Find the best turf football grounds in your city and book your next match slot.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push('/(player)')}
            className="mt-6 bg-[#4CAF50] rounded-full px-7 py-3.5"
            style={{
              shadowColor: '#4CAF50',
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
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingItem}
          renderSectionHeader={renderSectionHeader}
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
