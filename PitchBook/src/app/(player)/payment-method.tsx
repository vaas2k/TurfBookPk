import { useMemo, useState } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { confirmMockBooking, confirmMockBookingOrder, createBooking, createBookingOrder } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { PricingBreakdown } from '@/components/booking/PricingBreakdown';

type CheckoutSlot = { id: string; date: string; startTime: string; endTime: string; price: number };

function parseSelectedSlots(value: string | string[] | undefined): CheckoutSlot[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((slot): slot is CheckoutSlot => Boolean(slot) && typeof slot.id === 'string' && typeof slot.date === 'string' && typeof slot.startTime === 'string' && typeof slot.endTime === 'string' && typeof slot.price === 'number');
  } catch {
    return [];
  }
}

export default function PaymentMethodScreen() {
  const params = useLocalSearchParams<{
    slotId: string;
    slotIds?: string;
    selectedSlots?: string;
    groundTitle: string;
    groundAddress: string;
    date: string;
    startTime: string;
    endTime: string;
    amount: string;
  }>();

  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [idempotencyKey] = useState(
    () => `booking-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const selectedSlots = useMemo(() => parseSelectedSlots(params.selectedSlots), [params.selectedSlots]);
  const slotIds = useMemo(() => {
    if (selectedSlots.length) return selectedSlots.map((slot) => slot.id);
    if (typeof params.slotIds === 'string') {
      try { const parsed = JSON.parse(params.slotIds); if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === 'string'); } catch { /* Fall through to the single slot. */ }
    }
    return params.slotId ? [params.slotId] : [];
  }, [params.slotId, params.slotIds, selectedSlots]);
  const slotPrice = selectedSlots.length
    ? selectedSlots.reduce((total, slot) => total + slot.price, 0)
    : Number(params.amount) || 0;
  const isMultiSlotOrder = slotIds.length > 1;

  const handleConfirm = async () => {
    if (!slotIds.length) {
      setToast('The selected slots are missing. Please select them again.');
      return;
    }
    setLoading(true);
    try {
      if (isMultiSlotOrder) {
        const order = await createBookingOrder(slotIds, idempotencyKey);
        await confirmMockBookingOrder(order.id, reference.trim() || undefined);
        router.replace('/(player)/bookings');
        return;
      }
      const pendingBooking = await createBooking(slotIds[0]!, idempotencyKey);
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
              {isMultiSlotOrder && (
                <Text className="text-[#4CAF50] text-sm font-semibold mt-3">
                  {slotIds.length} slots selected across your chosen dates
                </Text>
              )}
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
          disabled={loading}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel={`Confirm booking for PKR ${slotPrice}`}
          className={`rounded-full py-4 items-center ${
            loading ? 'bg-[#9CA3AF]' : 'bg-[#4CAF50]'
          }`}
          style={!loading ? {
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
              {`Confirm Booking · PKR ${slotPrice.toLocaleString()}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
