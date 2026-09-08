import { useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { confirmMockBooking, createBooking } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';

export default function PaymentMethodScreen() {
  const params = useLocalSearchParams<{ slotId: string; groundTitle: string; groundAddress: string; date: string; startTime: string; endTime: string; amount: string }>();
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const idempotencyKey = useRef(`booking-${Date.now()}-${Math.random().toString(36).slice(2)}`).current;

  const confirm = async () => {
    if (!params.slotId) return setToast('The selected slot is missing. Please choose it again.');
    setLoading(true);
    try {
      const pendingBooking = await createBooking(params.slotId, idempotencyKey);
      const booking = await confirmMockBooking(pendingBooking.id, reference);
      router.replace({ pathname: '/(player)/booking-confirmation', params: { bookingId: booking.id, ground: booking.ground_title, address: booking.ground_address, date: booking.date, startTime: booking.start_time, endTime: booking.end_time, amount: String(booking.total_amount), bookingNumber: booking.booking_number } });
    } catch (error: any) { setToast(error?.message || 'This slot is no longer available.'); }
    finally { setLoading(false); }
  };

  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><View className="flex-row items-center bg-white px-5 py-4 border-b border-[#E5E5E5]"><TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"><Ionicons name="arrow-back" size={22} color="#1A1A2E" /></TouchableOpacity><Text className="text-xl font-bold text-[#1A1A2E] ml-3">Confirm booking</Text></View><View className="p-5"><View className="bg-white rounded-2xl p-5 border border-[#E5E5E5]"><Text className="text-xl font-bold text-[#1A1A2E]">{params.groundTitle}</Text><Text className="text-[#737373] mt-1">{params.groundAddress}</Text><View className="border-t border-[#F5F5F5] mt-4 pt-4"><Text className="text-[#737373]">{params.date}</Text><Text className="text-[#1A1A2E] font-bold mt-1">{params.startTime} - {params.endTime}</Text><Text className="text-[#4CAF50] text-2xl font-bold mt-4">PKR {params.amount}</Text></View></View><View className="bg-[#FFF8E1] rounded-2xl p-4 mt-4"><Text className="text-[#8A6100] font-bold">Mock payment mode</Text><Text className="text-[#8A6100] text-sm mt-1">Payment gateway integration will be added later. You can enter a reference now and confirm the booking.</Text><TextInput className="bg-white rounded-xl px-4 py-3 mt-3" placeholder="Optional payment reference" value={reference} onChangeText={setReference} /></View><TouchableOpacity disabled={loading} onPress={confirm} className="bg-[#4CAF50] rounded-full py-4 items-center mt-6">{loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">{`Confirm booking · PKR ${params.amount}`}</Text>}</TouchableOpacity></View><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
