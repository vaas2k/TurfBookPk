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
import { BookingProfile, listVendorBookings } from '@/lib/api/bookings';
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
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listVendorBookings();
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

  const sections: VendorBookingSection[] = useMemo(() => {
    const todayStr = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().split('T')[0];

    const today: BookingProfile[] = [];
    const upcoming: BookingProfile[] = [];
    const past: BookingProfile[] = [];
    const cancelled: BookingProfile[] = [];

    bookings.forEach((b) => {
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
  }, [bookings]);

  const renderBookingCard = ({ item }: { item: BookingProfile }) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`View booking ${item.booking_number} for ${item.ground_title}`}
      onPress={() => router.push({ pathname: '/(vendor)/booking/[id]', params: { id: item.id } })}
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

      <View className="bg-[#F9FAFB] rounded-xl p-3 mt-3 border border-[#F3F4F6]">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 mr-2">
            <Ionicons name="person-circle-outline" size={18} color="#4B5563" />
            <Text className="text-[#1A1A2E] font-semibold text-xs ml-1.5" numberOfLines={1}>
              {item.player_name || 'Player'}
            </Text>
          </View>
          <Text className="text-[#6B7280] text-xs font-mono">
            {item.player_phone || 'No phone'}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-[#F5F5F5]">
        <Text className="text-[#9CA3AF] text-xs font-mono">
          #{item.booking_number}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-[#737373] text-xs mr-1.5">Net Payout:</Text>
          <Text className="text-[#4CAF50] font-bold text-base">
            PKR {item.vendor_amount.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: VendorBookingSection }) => (
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
      <View className="px-5 py-4 bg-white border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOrReplace('/(vendor)')} className="w-11 h-11 rounded-full bg-[#F5F5F5] items-center justify-center mr-3"><Ionicons name="arrow-back" size={20} color="#1A1A2E" /></TouchableOpacity>
        <View className="flex-1"><Text className="text-2xl font-bold text-[#1A1A2E]">VENDOR BOOKINGS</Text>
        <Text className="text-[#737373] text-xs mt-0.5">
          {bookings.length} {bookings.length === 1 ? 'total booking' : 'total bookings across your venues'}
        </Text></View>
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
