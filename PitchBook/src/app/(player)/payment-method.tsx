import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookingProfile, confirmMockBooking, createBooking, getBooking } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { CheckoutHoldTimer } from '@/components/booking/CheckoutHoldTimer';
import { PricingBreakdown } from '@/components/booking/PricingBreakdown';

export default function PaymentMethodScreen() {
  const params = useLocalSearchParams<{
    slotId: string;
    groundTitle: string;
    groundAddress: string;
    date: string;
    startTime: string;
    endTime: string;
    amount: string;
  }>();

  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [holdExpired, setHoldExpired] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<BookingProfile | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [idempotencyKey] = useState(
    () => `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const slotPrice = Number(params.amount) || 0;
  const pendingBookingId = pendingBooking?.id;

  useEffect(() => {
    if (!params.slotId) return;
    let active = true;
    createBooking(params.slotId, idempotencyKey)
      .then((booking) => {
        if (!active) return;
        setPendingBooking(booking);
        setHoldExpired(booking.status === 'expired');
      })
      .catch((error: any) => {
        if (active) setToast(error?.message || 'This slot is no longer available.');
      });
    return () => { active = false; };
  }, [idempotencyKey, params.slotId]);

  useFocusEffect(useCallback(() => {
    if (!pendingBookingId) return;
    getBooking(pendingBookingId)
      .then((booking) => {
        setPendingBooking(booking);
        setHoldExpired(booking.status === 'expired');
      })
      .catch(() => setHoldExpired(true));
  }, [pendingBookingId]));

  const handleConfirm = async () => {
    if (!params.slotId) {
      setToast('The selected slot is missing. Please select your slot again.');
      return;
    }
    if (holdExpired) {
      setToast('Your hold timer has expired. Please go back and select the slot again.');
      return;
    }

    setLoading(true);
    try {
      if (!pendingBooking) {
        setToast('Your slot hold is still being prepared. Please wait a moment.');
        return;
      }

      const booking = await confirmMockBooking(pendingBooking.id, reference.trim() || undefined);

      // 3. Navigate to booking confirmation screen with real persisted booking details
      router.replace({
        pathname: '/(player)/booking-confirmation',
        params: {
          bookingId: booking.id,
          ground: booking.ground_title,
          address: booking.ground_address,
          date: booking.date,
          startTime: booking.start_time,
          endTime: booking.end_time,
          amount: String(booking.total_amount),
          bookingNumber: booking.booking_number,
        },
      });
    } catch (error: any) {
      const msg = error?.message || 'This slot is no longer available. Please select another slot.';
      setToast(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      {/* Header */}
      <View className="flex-row items-center bg-white px-5 py-4 border-b border-[#E5E5E5]">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-[#1A1A2E] ml-3">Review & Pay</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Checkout Hold Countdown */}
          <View className="mb-4">
            {pendingBooking?.hold_expires_at ? (
              <CheckoutHoldTimer expiresAt={pendingBooking.hold_expires_at} onExpire={() => setHoldExpired(true)} />
            ) : (
              <View className="rounded-2xl p-4 flex-row items-center bg-[#E0F2FE]">
                <ActivityIndicator size="small" color="#0284C7" />
                <Text className="text-[#0284C7] text-xs font-semibold ml-3">Securing your slot...</Text>
              </View>
            )}
          </View>

          {/* Ground & Slot Summary Card */}
          <View className="bg-white rounded-2xl p-5 border border-[#E5E5E5] mb-4">
            <Text className="text-xl font-bold text-[#1A1A2E]">{params.groundTitle || 'Ground'}</Text>
            <Text className="text-[#737373] text-sm mt-1">{params.groundAddress || 'Address not provided'}</Text>

            <View className="border-t border-[#F5F5F5] mt-4 pt-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar-outline" size={16} color="#737373" />
                <Text className="text-[#737373] text-sm ml-2 font-medium">{params.date}</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#737373" />
                <Text className="text-[#1A1A2E] text-sm ml-2 font-bold">
                  {params.startTime} - {params.endTime}
                </Text>
              </View>
            </View>
          </View>

          {/* Pricing Breakdown Card */}
          <View className="mb-4">
            <PricingBreakdown
              slotPrice={slotPrice}
              platformFee={0}
              totalAmount={slotPrice}
            />
          </View>

          {/* Mock Payment Mode Card */}
          <View className="bg-[#FFF8E1] rounded-2xl p-5 border border-[#FDE68A]">
            <View className="flex-row items-center">
              <Ionicons name="card-outline" size={20} color="#B45309" />
              <Text className="text-[#92400E] font-bold text-base ml-2">Mock Payment Mode</Text>
            </View>
            <Text className="text-[#92400E] text-xs mt-2 leading-4">
              Development mode is currently active. Click confirm below to simulate instant payment and lock in your slot.
            </Text>

            <TextInput
              className="bg-white rounded-xl px-4 py-3 mt-4 text-[#1A1A2E] text-sm border border-[#E5E5E5]"
              placeholder="Optional payment reference or note"
              placeholderTextColor="#A3A3A3"
              value={reference}
              onChangeText={setReference}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Sticky Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-5 py-4">
        <TouchableOpacity
          disabled={loading || holdExpired || !pendingBooking}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel={`Confirm booking for PKR ${slotPrice}`}
          className={`rounded-full py-4 items-center ${
            loading || holdExpired || !pendingBooking ? 'bg-[#9CA3AF]' : 'bg-[#4CAF50]'
          }`}
          style={!loading && !holdExpired && pendingBooking ? {
            shadowColor: '#4CAF50',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          } : undefined}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">
              {holdExpired ? 'Hold Expired - Select Again' : `Confirm Booking · PKR ${slotPrice.toLocaleString()}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
