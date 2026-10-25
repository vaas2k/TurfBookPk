import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { getPaymentAttempt, PaymentAttempt } from '@/lib/api/bookings';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';

function isTerminal(payment: PaymentAttempt) { return ['paid', 'confirmed', 'failed'].includes(payment.status) || ['expired', 'paid_unallocated'].includes(payment.provider_status); }

function formatCountdown(expiresAt: string | null, now: number) {
  if (!expiresAt) return '--:--';
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function stateCopy(payment: PaymentAttempt) {
  if (payment.status === 'paid' || payment.status === 'confirmed') return { title: 'Payment confirmed', detail: 'Your booking is confirmed.', color: '#3DB54A', icon: 'checkmark-circle' as const };
  if (payment.provider_status === 'expired') return { title: 'Reference expired', detail: 'This payment window has ended. Return to the booking to try again when allowed.', color: '#F59E0B', icon: 'time' as const };
  if (payment.status === 'failed') return { title: 'Reference failed', detail: payment.provider_error || 'The provider could not generate or process this reference.', color: '#EF4444', icon: 'close-circle' as const };
  if (payment.provider_status === 'unknown' || payment.review_status === 'manual_review' || payment.provider_status === 'paid_unallocated') return { title: 'Payment under review', detail: 'We could not safely confirm this payment automatically. Your payment is recorded and support will review it.', color: '#F59E0B', icon: 'alert-circle' as const };
  return { title: 'Waiting for payment', detail: 'Complete payment in a supported bank or wallet app, then check the status.', color: '#60A5FA', icon: 'hourglass' as const };
}

export default function PaymentInstructionsScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const [payment, setPayment] = useState<PaymentAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [sandboxPaymentSent, setSandboxPaymentSent] = useState(false);
  const shouldPoll = Boolean(payment && !isTerminal(payment));

  const refresh = useCallback(async (quiet = false, announce = false) => {
    if (!paymentId) return;
    if (!quiet) setRefreshing(true);
    try { const latest = await getPaymentAttempt(paymentId); setPayment(latest); if (announce) setToast(`Payment status refreshed: ${latest.provider_status.replaceAll('_', ' ')}.`); }
    catch (error: any) { if (!quiet) setToast(error?.message || 'Unable to check payment status.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [paymentId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!shouldPoll) return;
    let delay = 4_000;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (cancelled) return;
      await refresh(true);
      delay = Math.min(Math.round(delay * 1.5), 20_000);
      timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [shouldPoll, payment?.id, refresh]);

  const status = useMemo(() => payment ? stateCopy(payment) : null, [payment]);
  const amount = payment?.final_payable_amount ?? payment?.amount ?? 0;

  if (loading) return <SafeAreaView className="flex-1 bg-[#10120F] items-center justify-center"><StatusBar barStyle="light-content" /><ActivityIndicator size="large" color="#3DB54A" /><Text className="text-[#AFAFA9] mt-4">Loading payment instructions…</Text></SafeAreaView>;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />
      <View className="flex-row items-center px-5 py-4"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOrReplace('/(player)/bookings')} className="w-11 h-11 rounded-full border border-[#30372B] items-center justify-center"><Ionicons name="arrow-back" size={22} color="#F8F7F0" /></TouchableOpacity><Text className="text-[#F8F7F0] text-xl font-bold ml-4">1-Bill payment</Text></View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="rounded-[24px] bg-[#181C16] border border-[#343A30] p-5 items-center">
          {status && <><Ionicons name={status.icon} size={38} color={status.color} /><Text className="text-[#F8F7F0] text-xl font-bold mt-3">{status.title}</Text><Text className="text-[#AFAFA9] text-sm text-center leading-5 mt-2">{status.detail}</Text></>}
          <View className="w-full border-t border-[#30372B] mt-5 pt-5 flex-row justify-between"><Text className="text-[#AFAFA9]">Booking amount</Text><Text className="text-[#F8F7F0] font-bold">PKR {Number(payment?.amount || 0).toLocaleString()}</Text></View>
          {payment?.service_charge != null && <View className="w-full flex-row justify-between mt-3"><Text className="text-[#AFAFA9]">Service charge</Text><Text className="text-[#F8F7F0]">PKR {Number(payment.service_charge).toLocaleString()}</Text></View>}
          <View className="w-full flex-row justify-between mt-3"><Text className="text-[#F8F7F0] font-bold">Payable</Text><Text className="text-[#3DB54A] text-xl font-bold">PKR {Number(amount).toLocaleString()}</Text></View>
        </View>

        {payment?.consumer_number && !isTerminal(payment) && <View className="rounded-[24px] bg-[#F8F7F0] p-5 mt-5 items-center"><Text className="text-[#1A1A1A] font-bold text-lg">1-Bill consumer number</Text><View className="bg-white rounded-2xl p-4 mt-4"><QRCode value={payment.consumer_number} size={180} backgroundColor="#FFFFFF" color="#10120F" /></View><Text selectable className="text-[#10120F] text-xl font-bold tracking-wider mt-4">{payment.consumer_number}</Text><TouchableOpacity accessibilityRole="button" onPress={async () => { await Clipboard.setStringAsync(payment.consumer_number!); setToast('Consumer number copied.'); }} className="mt-4 border border-[#3DB54A] rounded-full px-6 py-3 flex-row items-center"><Ionicons name="copy-outline" size={18} color="#237C2B" /><Text className="text-[#237C2B] font-bold ml-2">Copy number</Text></TouchableOpacity><Text className="text-[#737373] text-xs mt-5">Local payment window</Text><Text className="text-[#10120F] text-3xl font-bold mt-1">{formatCountdown(payment.expires_at, now)}</Text></View>}

        <View className="rounded-[20px] bg-[#2A2413] border border-[#5B4A16] p-4 mt-5"><Text className="text-[#F7D774] font-bold">Sandbox payment notice</Text><Text className="text-[#D8C995] text-sm leading-5 mt-2">Clink may add a service charge. The current generation API does not return the exact charge, so verify the final amount shown in your bank or wallet before paying.</Text></View>
        <View className="rounded-[20px] bg-[#181C16] border border-[#343A30] p-5 mt-5"><Text className="text-[#F8F7F0] font-bold text-base">How to pay</Text><Text className="text-[#AFAFA9] text-sm leading-6 mt-3">1. Open a supported banking or wallet app.{`\n`}2. Choose 1-Bill / invoice payment.{`\n`}3. Enter or scan the consumer number above.{`\n`}4. Confirm the amount and complete payment.{`\n`}5. Return here and check the payment status.</Text></View>
        <TouchableOpacity disabled={refreshing} onPress={() => void refresh(false, true)} accessibilityRole="button" className="bg-[#3DB54A] rounded-full py-4 items-center mt-6">{refreshing ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Refresh payment status</Text>}</TouchableOpacity>
        {payment?.manual_acknowledgment_test_enabled && !isTerminal(payment) && <TouchableOpacity disabled={sandboxPaymentSent} onPress={() => { setSandboxPaymentSent(true); setToast('Test payment sent. Waiting for provider acknowledgment.'); }} accessibilityRole="button" accessibilityState={{ disabled: sandboxPaymentSent }} className="border border-[#F7D774] rounded-full py-4 items-center mt-3"><Text className="text-[#F7D774] font-bold">{sandboxPaymentSent ? 'Waiting for acknowledgment…' : 'Simulate payment sent'}</Text></TouchableOpacity>}
        {(payment?.status === 'paid' || payment?.status === 'confirmed') && <TouchableOpacity onPress={() => router.replace('/(player)/bookings')} className="border border-[#3DB54A] rounded-full py-4 items-center mt-3"><Text className="text-[#3DB54A] font-bold">View my bookings</Text></TouchableOpacity>}
      </ScrollView>
      <Toast message={toast} tone={toast && (toast.includes('copied') || toast.includes('successfully') || toast.includes('refreshed')) ? 'success' : 'error'} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
