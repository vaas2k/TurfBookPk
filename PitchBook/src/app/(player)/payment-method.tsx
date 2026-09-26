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
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatTimeRange12 } from '@/lib/time';
import { confirmMockBooking, confirmMockBookingOrder, createBooking, createBookingOrder } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';

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
    cancellationPolicy?: 'lenient' | 'standard' | 'strict';
  }>();

  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'jazzcash' | 'easypaisa' | 'bank'>('jazzcash');
  const [loading, setLoading] = useState(false);
  const [reserveFutureSlots, setReserveFutureSlots] = useState(false);
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
  const firstSelectedDate = selectedSlots.length ? [...selectedSlots].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0]?.date : null;
  const firstDayPrice = firstSelectedDate ? selectedSlots.filter((slot) => slot.date === firstSelectedDate).reduce((total, slot) => total + slot.price, 0) : slotPrice;
  const dueNow = reserveFutureSlots && isMultiSlotOrder ? firstDayPrice : slotPrice;
  const cancellationPolicy = params.cancellationPolicy || 'standard';
  const earliestSlot = selectedSlots.length ? [...selectedSlots].sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0] : null;
  const hoursUntilSlot = earliestSlot ? (new Date(`${earliestSlot.date}T${earliestSlot.startTime}:00+05:00`).getTime() - Date.now()) / 3_600_000 : Infinity;
  const expectedRefundPercentage = cancellationPolicy === 'strict'
    ? hoursUntilSlot >= 48 ? 100 : hoursUntilSlot >= 24 ? 70 : hoursUntilSlot >= 12 ? 50 : hoursUntilSlot >= 6 ? 30 : 0
    : hoursUntilSlot >= 24 ? 100 : hoursUntilSlot >= 12 ? 75 : hoursUntilSlot >= 6 ? 50 : cancellationPolicy === 'lenient' ? 25 : 0;

  const handleConfirm = async () => {
    if (!slotIds.length) {
      setToast('The selected slots are missing. Please select them again.');
      return;
    }
    setLoading(true);
    try {
      if (isMultiSlotOrder) {
        const order = await createBookingOrder(slotIds, idempotencyKey, reserveFutureSlots);
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
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" translucent={false} />
      {/* Header */}
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace('/(player)')}
          className="w-10 h-10 rounded-full border border-[#30372B] items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#F8F7F0" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 29 }} className="text-[#F8F7F0] ml-4">PAYMENT METHOD</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, paddingBottom: 130 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ground & Slot Summary Card */}
          <View className="bg-[#181C16] rounded-[26px] p-5 border border-[#244A29] mb-8">
            <View className="flex-row items-start justify-between"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[20px] text-[#F8F7F0] flex-1">{params.groundTitle || 'Ground'}</Text><View className="bg-[#19331D] px-3 py-2 rounded-xl"><Text className="text-[#3DB54A] font-bold">Pitch 1</Text></View></View>

            <View className="border-t border-[#30372B] mt-4 pt-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar-outline" size={16} color="#737373" />
                <Text className="text-[#737373] text-sm ml-2 font-medium">{params.date}</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#737373" />
                <Text className="text-[#1A1A2E] text-sm ml-2 font-bold">
                  {formatTimeRange12(params.startTime, params.endTime)}
                </Text>
              </View>
              {isMultiSlotOrder && (
                <Text className="text-[#4CAF50] text-sm font-semibold mt-3">
                  {slotIds.length} slots selected across your chosen dates
                </Text>
              )}
            </View>
          </View>

          <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 20 }} className="text-[#BFC1B9] mb-4">SELECT PAYMENT METHOD</Text>
          {[
            { id: 'jazzcash' as const, title: 'JazzCash', subtitle: 'Mobile Wallet', initials: 'JC', color: '#F01E2C' },
            { id: 'easypaisa' as const, title: 'Easypaisa', subtitle: 'Mobile Wallet', initials: 'EP', color: '#00AE5B' },
            { id: 'bank' as const, title: 'Bank Transfer', subtitle: 'Direct bank payment', initials: '⌂', color: '#34382E' },
          ].map((method) => <TouchableOpacity key={method.id} accessibilityRole="radio" accessibilityState={{ selected: paymentMethod === method.id }} onPress={() => setPaymentMethod(method.id)} className={`rounded-[22px] p-4 mb-3 flex-row items-center border ${paymentMethod === method.id ? 'border-[#3DB54A] bg-[#1B2019]' : 'border-[#343A30] bg-[#181C16]'}`}><View style={{ backgroundColor: method.color }} className="w-14 h-14 rounded-full items-center justify-center"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-white text-lg">{method.initials}</Text></View><View className="flex-1 ml-4"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-[18px]">{method.title}</Text><Text className="text-[#AFAFA9] text-base mt-0.5">{method.subtitle}</Text></View><Ionicons name={paymentMethod === method.id ? 'radio-button-on' : 'radio-button-off'} size={31} color={paymentMethod === method.id ? '#3DB54A' : '#70766D'} /></TouchableOpacity>)}
          <View className="mt-5"><View className="flex-row justify-between"><Text className="text-[#BFC1B9] text-lg">Slot Fee</Text><Text className="text-[#F8F7F0] text-lg">Rs {slotPrice.toLocaleString()}</Text></View><View className="flex-row justify-between mt-4"><Text className="text-[#BFC1B9] text-lg">Platform Fee</Text><Text className="text-[#F8F7F0] text-lg">Rs 0</Text></View><View className="flex-row justify-between mt-5 pt-5 border-t border-[#30372B]"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-xl">Total Amount</Text><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#3DB54A] text-[25px]">RS {dueNow.toLocaleString()}</Text></View></View>
          <View className="bg-[#1A2119] border border-[#315536] rounded-2xl p-4 mt-5"><View className="flex-row items-center"><Ionicons name="shield-checkmark-outline" size={19} color="#59C462" /><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F3F4EF] ml-2 text-sm">{cancellationPolicy[0].toUpperCase() + cancellationPolicy.slice(1)} cancellation policy</Text></View><Text className="text-[#AFAFA9] text-xs leading-5 mt-2">If you cancel after payment, the current estimate is {expectedRefundPercentage}% of the amount paid. You will have a {cancellationPolicy === 'lenient' ? 30 : cancellationPolicy === 'strict' ? 5 : 15}-minute full-refund grace window after booking.</Text></View>

          {isMultiSlotOrder && (
            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: reserveFutureSlots }} onPress={() => setReserveFutureSlots((value) => !value)} className={`rounded-2xl p-4 mb-4 border ${reserveFutureSlots ? 'bg-[#E8F5E9] border-[#4CAF50]' : 'bg-white border-[#E5E5E5]'}`}>
              <View className="flex-row items-start"><Ionicons name={reserveFutureSlots ? 'checkbox' : 'square-outline'} size={22} color="#2E7D32" /><View className="flex-1 ml-3"><Text className="text-[#1A1A2E] font-bold">Reserve future recurring slots</Text><Text className="text-[#4B5563] text-xs leading-4 mt-1">Pay PKR {firstDayPrice.toLocaleString()} for all selected slots on {firstSelectedDate} now. Later-date slots stay reserved and each opens a 30-minute payment window 2 hours before it starts. Unpaid slots are released.</Text></View></View>
            </TouchableOpacity>
          )}

          {/* Mock Payment Mode Card */}
          <View className="hidden">
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
      <View className="absolute bottom-0 left-0 right-0 bg-[#171B15] border-t border-[#30372B] px-6 py-5">
        <TouchableOpacity
          disabled={loading}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel={`Confirm booking for PKR ${dueNow}`}
          className={`rounded-full py-4 items-center ${
            loading ? 'bg-[#596057]' : 'bg-[#3DB54A]'
          }`}
          style={!loading ? {
            shadowColor: '#3DB54A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          } : undefined}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-white text-xl">
              {`Pay Rs ${dueNow.toLocaleString()}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
