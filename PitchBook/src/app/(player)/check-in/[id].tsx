import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { getBooking, getCheckInToken } from '@/lib/api/bookings';
import { shortBookingReference } from '@/lib/booking-reference';
import { goBackOrReplace } from '@/lib/navigation';

export default function PlayerCheckIn() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [ground, setGround] = useState('');
  const [reference, setReference] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const booking = await getBooking(id);
      setGround(booking.ground_title);
      setReference(shortBookingReference(booking.booking_number));
      setCheckedIn(Boolean(booking.checked_in_at));
      if (booking.checked_in_at) { setToken(''); setError(''); return; }
      const issued = await getCheckInToken(id);
      setToken(issued.token);
      setCode(issued.code);
      setExpiresAt(issued.expires_at);
      setError('');
    } catch (caught: any) { setToken(''); setError(caught?.message || 'Unable to load your check-in QR.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 90_000); return () => clearInterval(timer); }, [refresh]);
  return <SafeAreaView className="flex-1 bg-[#10120F]" edges={['top', 'bottom', 'left', 'right']}>
    <View className="flex-row items-center px-5 pt-3"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBackOrReplace(`/(player)/booking/${id}` as never)} className="w-11 h-11 justify-center"><Ionicons name="arrow-back" size={24} color="#F5F5F0" /></TouchableOpacity><Text className="text-[#F5F5F0] text-xl font-bold ml-2">Ground check-in</Text></View>
    <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}><Text className="text-[#F5F5F0] text-xl font-bold text-center">{ground || 'Your match'}</Text><Text className="text-[#A6ACA3] text-sm mt-2 text-center">Show this QR to the manager when you arrive at the ground.</Text>
      {loading ? <ActivityIndicator color="#42B84F" className="mt-12" /> : checkedIn ? <View className="bg-[#17301B] rounded-2xl p-6 mt-8"><Text className="text-[#75D67E] font-bold text-center">Your arrival is confirmed</Text></View> : token ? <View className="bg-white rounded-3xl p-6 mt-8"><QRCode value={token} size={220} /></View> : <Text className="text-[#F4B844] text-center mt-8">{error}</Text>}
      {token ? <Text className="text-[#9CA198] text-xs mt-4 text-center">QR refreshes automatically. Valid until {new Date(expiresAt).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}.</Text> : null}
      {token ? <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl px-7 py-5 items-center mt-6"><Text className="text-[#A6ACA3] text-xs">If scanning fails, tell the manager this code</Text><Text selectable className="text-[#F5F5F0] text-2xl tracking-[5px] font-bold mt-2">{code}</Text></View> : null}
      <Text className="text-[#A6ACA3] text-sm mt-7">Booking reference: #{reference || '—'}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => void refresh()} className="rounded-full bg-[#42B84F] px-7 py-3 mt-8"><Text className="text-[#102110] font-bold">Refresh check-in</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
