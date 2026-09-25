import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookingProfile, cancelBooking, confirmRecurringReservationBooking, getBooking, getCancellationPreview, markBookingCompleted, markBookingNoShow } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { appDialog } from '@/components/ui/app-dialog';
import { goBackOrReplace } from '@/lib/navigation';

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

  const handleCancel = async () => {
    setActionLoading(true);
    let preview;
    try { preview = await getCancellationPreview(id); }
    catch (error: any) { setToast(error?.message || 'Unable to check the cancellation policy.'); setActionLoading(false); return; }
    setActionLoading(false);
    appDialog.alert(
      'Review cancellation',
      `Cancellation fee: PKR ${preview.cancellation_fee.toLocaleString()}\n${preview.payment_status === 'paid' ? `Refund due: PKR ${preview.refund_amount.toLocaleString()}` : 'No payment has been recorded.'}${preview.is_mock_payment ? '\nThis is a mock payment. No real money will move.' : ''}\n\nThe slot will become available again.`,
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
    appDialog.alert(
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
  const handleCompleted = () => {
    appDialog.alert('Mark attendance complete?', 'Only do this after the booked slot has ended and the player attended.', [{ text: 'Back', style: 'cancel' }, { text: 'Mark completed', onPress: async () => { setActionLoading(true); try { setBooking(await markBookingCompleted(id)); } catch (error: any) { setToast(error?.message || 'Unable to update booking status.'); } finally { setActionLoading(false); } } }]);
  };
  const handleRecurringPayment = async () => {
    setActionLoading(true);
    try { setBooking(await confirmRecurringReservationBooking(id)); }
    catch (error: any) { setToast(error?.message || 'Unable to pay for this reserved slot.'); }
    finally { setActionLoading(false); }
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
          onPress={() => goBackOrReplace(vendorView ? '/(vendor)/bookings' : '/(player)/bookings')}
          className="mt-6 bg-[#4CAF50] rounded-full px-8 py-3.5"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
        <Toast message={toast} tone="error" onHide={() => setToast(null)} />
      </SafeAreaView>
    );
  }

  const isCancellable =
    (booking.status === 'confirmed' || booking.status === 'pending_payment') && new Date(`${booking.date}T${booking.start_time}+05:00`).getTime() > Date.now();
  const hasEnded = new Date(`${booking.date}T${booking.end_time}+05:00`).getTime() <= Date.now();
  const paymentWindowOpen = booking.payment_window_opens_at ? new Date(booking.payment_window_opens_at).getTime() <= Date.now() : false;
  const reservationActive = booking.is_recurring_reservation && booking.status === 'pending_payment' && booking.reservation_expires_at && new Date(booking.reservation_expires_at).getTime() > Date.now();

  if (!vendorView) {
    const isUpcoming = booking.status === 'confirmed' || booking.status === 'pending_payment';
    const isCompleted = booking.status === 'completed' || booking.status === 'no_show';
    const bookingDate = new Date(`${booking.date}T12:00:00`).toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' });
    const slotTime = `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)}`;

    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
        <StatusBar barStyle="light-content" backgroundColor="#10120F" translucent={false} />
        <View className="px-6 pt-4 pb-5 flex-row items-center">
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOrReplace('/(player)/bookings')} className="w-11 h-11 items-center justify-center -ml-2"><Ionicons name="arrow-back" size={31} color="#F8F7F0" /></TouchableOpacity>
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 26, letterSpacing: 0.25 }} className="text-[#F8F7F0] ml-3">BOOKING DETAILS</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          <View className="bg-[#181C16] border border-[#30382B] rounded-[26px] p-4 flex-row items-center">
            <View className="w-[96px] h-[96px] rounded-[18px] bg-[#24492A] items-center justify-center overflow-hidden"><Ionicons name="football" size={43} color="#B6E1B9" /></View>
            <View className="flex-1 ml-4"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-[18px]" numberOfLines={2}>{booking.ground_title}</Text><Text className="text-[#3DB54A] text-[15px] mt-1">Pitch booking</Text><Text className="text-[#858A81] text-sm mt-2">Ref: #{booking.booking_number}</Text></View>
          </View>
          <View className="bg-[#252A21] rounded-[24px] px-5 py-5 mt-5 flex-row items-center"><Ionicons name="calendar" size={26} color="#3DB54A" /><Text style={{ fontFamily: 'SpaceGrotesk_500Medium' }} className="text-[#F3F4EF] text-[16px] ml-4 flex-1">{bookingDate} • {slotTime} (1 Hour)</Text></View>

          {isUpcoming && <View className="bg-white rounded-[28px] mt-5 px-5 py-7 items-center"><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 19 }} className="text-[#10120F]">GROUND CHECK-IN CODE</Text><View className="w-40 h-40 border-[7px] border-[#10120F] rounded-md mt-5 items-center justify-center"><Ionicons name="qr-code" size={120} color="#10120F" /></View><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#10120F] text-[21px] mt-5">{booking.booking_number}</Text></View>}

          {booking.status === 'cancelled' && <View className="bg-[#2D1B19] border border-[#7C382E] rounded-[24px] p-5 mt-5"><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 20 }} className="text-[#FF5C57]">BOOKING CANCELLED</Text><Text className="text-[#E2B5AF] text-sm mt-3">{booking.cancellation_reason || 'This booking has been cancelled.'}</Text><View className="flex-row justify-between pt-4 mt-4 border-t border-[#64322C]"><Text className="text-[#E2B5AF]">Refund amount</Text><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0]">PKR {booking.refund_amount.toLocaleString()}</Text></View></View>}

          <View className="bg-[#20241D] rounded-[25px] p-5 mt-5"><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 19 }} className="text-[#BFC1B9]">PAYMENT BREAKDOWN</Text><View className="flex-row justify-between mt-5"><Text className="text-[#BFC1B9] text-base">Pitch Booking Fee</Text><Text className="text-[#F8F7F0] text-base">Rs {booking.total_amount.toLocaleString()}</Text></View><View className="flex-row justify-between mt-4"><Text className="text-[#BFC1B9] text-base">Platform Fee</Text><Text className="text-[#F8F7F0] text-base">Rs {booking.platform_fee.toLocaleString()}</Text></View><View className="flex-row justify-between mt-5 pt-5 border-t border-[#383E32]"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-lg">Total {booking.payment_status === 'paid' ? 'Paid' : 'Amount'}</Text><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#3DB54A] text-lg">Rs {(booking.total_amount + booking.platform_fee).toLocaleString()}</Text></View></View>
        </ScrollView>
        {isUpcoming && isCancellable && <View className="absolute bottom-0 left-0 right-0 bg-[#10120F] px-6 py-5"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel booking" onPress={handleCancel} disabled={actionLoading} className="border-2 border-[#FA4747] rounded-full py-4 items-center bg-[#351B1B]"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#FF5757] text-xl">Cancel booking</Text></TouchableOpacity></View>}
        {isCompleted && <View className="absolute bottom-0 left-0 right-0 bg-[#10120F] px-6 py-5"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Rate this ground" onPress={() => router.push({ pathname: '/(player)/reviews-write', params: { bookingId: booking.id, title: booking.ground_title } })} className="bg-[#3DB54A] rounded-full py-4 items-center"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-white text-xl">Rate this ground</Text></TouchableOpacity></View>}
        <Toast message={toast} tone="error" onHide={() => setToast(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      {/* Top Header */}
      <View className="flex-row items-center px-5 py-4 bg-white border-b border-[#E5E5E5]">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace(vendorView ? '/(vendor)/bookings' : '/(player)/bookings')}
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
        {!vendorView && reservationActive && (
          <View className="bg-[#E8F5E9] rounded-2xl p-5 border border-[#86EFAC] mb-2"><Text className="text-[#1A1A2E] font-bold">Future slot reserved for you</Text><Text className="text-[#4B5563] text-sm mt-1">{paymentWindowOpen ? 'Your payment window is open now. Pay before this reservation is released.' : `Payment opens ${new Date(booking.payment_window_opens_at!).toLocaleString()}.`}</Text>{paymentWindowOpen && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Pay for reserved slot" disabled={actionLoading} onPress={handleRecurringPayment} className="bg-[#4CAF50] rounded-full py-3 items-center mt-4">{actionLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Pay PKR {booking.total_amount.toLocaleString()}</Text>}</TouchableOpacity>}</View>
        )}
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

        {vendorView && booking.status === 'confirmed' && !hasEnded && <Text className="text-[#737373] text-center mt-4">Attendance and no-show can be recorded after this slot ends.</Text>}
        {vendorView && booking.status === 'confirmed' && hasEnded && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mark player attendance complete" disabled={actionLoading} onPress={handleCompleted} className="bg-[#4CAF50] rounded-full py-4 items-center mt-3"><Text className="text-white font-bold text-base">Mark Attendance Complete</Text></TouchableOpacity>
        )}
        {vendorView && booking.status === 'confirmed' && hasEnded && (
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
        {!vendorView && booking.status === 'completed' && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Rate this ground" onPress={() => router.push({ pathname: '/(player)/reviews-write', params: { bookingId: booking.id, title: booking.ground_title } })} className="bg-[#F59E0B] rounded-full py-4 items-center mt-3"><Text className="text-white font-bold text-base">Rate this ground</Text></TouchableOpacity>
        )}
      </ScrollView>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
