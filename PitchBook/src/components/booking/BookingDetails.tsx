import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookingProfile, cancelBooking, getBooking, markBookingNoShow } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';

export function BookingDetails({ id, vendorView }: { id: string; vendorView: boolean }) {
  const [booking, setBooking] = useState<BookingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBooking(await getBooking(id));
    } catch (error: any) {
      setToast(error?.message || 'Unable to load this booking.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel booking?',
      vendorView
        ? 'The player will receive a full refund if payment was already completed.'
        : 'Refund eligibility depends on how soon the match slot begins.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await cancelBooking(
                id,
                vendorView ? 'Cancelled by venue manager' : 'Cancelled by player'
              );
              setBooking(updated);
            } catch (error: any) {
              setToast(error?.message || 'Unable to cancel this booking.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleNoShow = () => {
    Alert.alert(
      'Mark player as no-show?',
      'Only mark no-show if the booked slot has ended and the squad did not arrive.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Confirm No-Show',
          onPress: async () => {
            setActionLoading(true);
            try {
              const updated = await markBookingNoShow(id);
              setBooking(updated);
            } catch (error: any) {
              setToast(error?.message || 'Unable to update booking status.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F8F9FA]">
        <ActivityIndicator size="large" color="#4CAF50" />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#F8F9FA] px-6">
        <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
        <Text className="text-[#1A1A2E] text-xl font-bold mt-4">Booking Not Found</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          className="mt-6 bg-[#4CAF50] rounded-full px-8 py-3.5"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
        <Toast message={toast} tone="error" onHide={() => setToast(null)} />
      </SafeAreaView>
    );
  }

  const isCancellable =
    booking.status === 'confirmed' || booking.status === 'pending_payment';

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      {/* Top Header */}
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-[#E5E5E5]">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-[#1A1A2E] ml-3">Booking Details</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* Status & Booking Number Card */}
        <View className="bg-white rounded-2xl p-5 border border-[#E5E5E5] mb-4">
          <View className="flex-row justify-between items-center pb-3 border-b border-[#F5F5F5]">
            <View>
              <Text className="text-[#737373] text-xs font-semibold uppercase">Booking Ref</Text>
              <Text className="text-[#1A1A2E] text-sm font-mono font-bold mt-0.5">
                #{booking.booking_number}
              </Text>
            </View>
            <BookingStatusBadge status={booking.status} paymentStatus={booking.payment_status} />
          </View>

          <Text className="text-xl font-bold text-[#1A1A2E] mt-4">{booking.ground_title}</Text>
          <Text className="text-[#737373] text-sm mt-1">{booking.ground_address}</Text>

          <View className="mt-4 pt-4 border-t border-[#F5F5F5]">
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={16} color="#737373" />
              <Text className="text-[#1A1A2E] text-sm ml-2 font-semibold">{booking.date}</Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={16} color="#737373" />
              <Text className="text-[#1A1A2E] text-sm ml-2 font-semibold">
                {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
              </Text>
            </View>
          </View>
        </View>

        {/* Financial Summary Card */}
        <View className="bg-white rounded-2xl p-5 border border-[#E5E5E5] mb-4">
          <Text className="text-[#1A1A2E] text-base font-bold mb-3">Payment Summary</Text>

          <View className="flex-row justify-between items-center py-1.5">
            <Text className="text-[#737373] text-sm">Payment Status</Text>
            <Text className="text-[#1A1A2E] text-sm font-semibold capitalize">
              {booking.payment_status.replaceAll('_', ' ')}
            </Text>
          </View>

          <View className="flex-row justify-between items-center py-1.5">
            <Text className="text-[#737373] text-sm">Total Slot Fee</Text>
            <Text className="text-[#4CAF50] text-base font-bold">
              PKR {booking.total_amount.toLocaleString()}
            </Text>
          </View>

          {vendorView && (
            <View className="flex-row justify-between items-center py-1.5 border-t border-[#F5F5F5] mt-2 pt-2">
              <Text className="text-[#737373] text-sm">Net Vendor Payout</Text>
              <Text className="text-[#1A1A2E] text-base font-bold">
                PKR {booking.vendor_amount.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Player Contact Card (for vendor view) */}
        {vendorView && (
          <View className="bg-white rounded-2xl p-5 border border-[#E5E5E5] mb-4">
            <Text className="text-[#1A1A2E] text-base font-bold mb-3">Player Information</Text>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[#1A1A2E] font-semibold text-sm">{booking.player_name}</Text>
                <Text className="text-[#737373] text-xs mt-0.5">
                  {booking.player_phone || 'Phone number not shared'}
                </Text>
              </View>
              {booking.player_phone && (
                <View className="w-9 h-9 rounded-full bg-[#E8F5E9] items-center justify-center">
                  <Ionicons name="call-outline" size={18} color="#4CAF50" />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Cancellation Notice Card (if cancelled) */}
        {booking.status === 'cancelled' && (
          <View className="bg-[#FFF7ED] rounded-2xl p-5 border border-[#FED7AA] mb-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="information-circle" size={20} color="#C2410C" />
              <Text className="text-[#9A3412] font-bold text-sm ml-2">Cancellation Record</Text>
            </View>
            {booking.cancellation_reason && (
              <Text className="text-[#9A3412] text-xs mb-2">
                Reason: {booking.cancellation_reason}
              </Text>
            )}
            <View className="flex-row justify-between items-center pt-2 border-t border-[#FED7AA]">
              <Text className="text-[#9A3412] text-xs">Cancellation Fee:</Text>
              <Text className="text-[#9A3412] font-bold text-xs">PKR {booking.cancellation_fee}</Text>
            </View>
            <View className="flex-row justify-between items-center pt-1">
              <Text className="text-[#9A3412] text-xs">Refund Amount:</Text>
              <Text className="text-[#9A3412] font-bold text-xs">PKR {booking.refund_amount}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {isCancellable && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cancel this booking"
            disabled={actionLoading}
            onPress={handleCancel}
            className="border border-[#DC2626] bg-white rounded-full py-4 items-center mt-3"
          >
            {actionLoading ? (
              <ActivityIndicator color="#DC2626" />
            ) : (
              <Text className="text-[#DC2626] font-bold text-base">Cancel Booking</Text>
            )}
          </TouchableOpacity>
        )}

        {vendorView && booking.status === 'confirmed' && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mark player as no-show"
            disabled={actionLoading}
            onPress={handleNoShow}
            className="bg-[#1A1A2E] rounded-full py-4 items-center mt-3"
          >
            <Text className="text-white font-bold text-base">Mark as No-Show</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
