import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { EarningsEntry, EarningsSummary, getVendorEarnings } from '@/lib/api/vendors';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';

const emptySummary: EarningsSummary = { available_to_withdraw: 0, pending_earnings: 0, total_paid_out: 0, pending_refunds: 0 };
const money = (value: number) => `PKR ${Math.abs(value).toLocaleString()}`;

function describe(entry: EarningsEntry) {
  if (entry.status === 'reversed') return { title: 'Earning reversed', detail: 'The booking was cancelled, so this pending earning is no longer payable.', color: '#6B7280', icon: 'arrow-undo-outline' as const };
  if (entry.type === 'refund') return { title: entry.status === 'pending' ? 'Player refund awaiting processing' : 'Player refund processed', detail: 'This is money returned to the player, not an extra vendor charge.', color: '#DC2626', icon: 'return-down-back-outline' as const };
  if (entry.type === 'payout') return { title: 'Payout sent', detail: 'Funds were sent from your available balance.', color: '#1A1A2E', icon: 'wallet-outline' as const };
  if (entry.type === 'adjustment') return { title: 'Balance adjustment', detail: 'An adjustment was recorded for this booking.', color: entry.amount < 0 ? '#DC2626' : '#2E7D32', icon: 'options-outline' as const };
  if (entry.status === 'pending') return { title: 'Earning pending match completion', detail: 'It becomes available after the booked slot ends.', color: '#C56A00', icon: 'time-outline' as const };
  return { title: entry.description.startsWith('Cancellation fee') ? 'Cancellation fee earned' : 'Earning available', detail: 'This amount is available for a future payout.', color: '#2E7D32', icon: 'checkmark-circle-outline' as const };
}

export default function VendorEarnings() {
  const [summary, setSummary] = useState<EarningsSummary>(emptySummary);
  const [entries, setEntries] = useState<EarningsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const load = useCallback(async () => { try { const result = await getVendorEarnings(); setSummary(result.summary); setEntries(result.entries); } catch (error: any) { setToast(error?.message || 'Unable to load earnings.'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <SafeAreaView className="flex-1 bg-[#F8F9FA]">
    <View className="px-5 py-4 bg-white border-b border-[#E5E5E5] flex-row items-center"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOrReplace('/(vendor)')} className="w-11 h-11 rounded-full bg-[#F5F5F5] items-center justify-center mr-3"><Ionicons name="arrow-back" size={20} color="#1A1A2E" /></TouchableOpacity><View><Text className="text-2xl font-bold text-[#1A1A2E]">Earnings</Text><Text className="text-xs text-[#737373] mt-0.5">Booking income and payout balance</Text></View></View>
    <ScrollView className="flex-1 px-5 pt-5" contentContainerStyle={{ paddingBottom: 32 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#4CAF50']} />}>
      <View className="bg-[#1A1A2E] rounded-3xl p-6"><Text className="text-white/70 text-sm">Available to withdraw</Text><Text className="text-white text-3xl font-bold mt-1">{money(summary.available_to_withdraw)}</Text><Text className="text-white/70 text-xs mt-3">Completed bookings become available here. Payout requests will be added when payments are live.</Text></View>
      <View className="flex-row mt-4 gap-3"><View className="flex-1 bg-[#FFF7ED] rounded-2xl p-4 border border-[#FED7AA]"><Text className="text-[#9A3412] text-xs font-semibold">PENDING AFTER MATCH</Text><Text className="text-[#9A3412] text-lg font-bold mt-1">{money(summary.pending_earnings)}</Text><Text className="text-[#9A3412] text-xs mt-1">Not withdrawable yet</Text></View><View className="flex-1 bg-white rounded-2xl p-4 border border-[#E5E5E5]"><Text className="text-[#4B5563] text-xs font-semibold">PAID OUT</Text><Text className="text-[#1A1A2E] text-lg font-bold mt-1">{money(summary.total_paid_out)}</Text><Text className="text-[#737373] text-xs mt-1">Total sent to you</Text></View></View>
      {summary.pending_refunds > 0 && <View className="mt-3 bg-[#FEF2F2] rounded-2xl p-4 border border-[#FECACA] flex-row"><Ionicons name="information-circle-outline" size={20} color="#DC2626" /><View className="flex-1 ml-3"><Text className="text-[#991B1B] font-bold">Player refunds being processed: {money(summary.pending_refunds)}</Text><Text className="text-[#B91C1C] text-xs mt-1">This is separate from your available balance.</Text></View></View>}
      <View className="flex-row items-end justify-between mt-7 mb-3"><View><Text className="text-lg font-bold text-[#1A1A2E]">Activity</Text><Text className="text-xs text-[#737373] mt-0.5">Newest transactions first</Text></View><Text className="text-xs font-semibold text-[#4B5563]">{entries.length} entries</Text></View>
      {loading && entries.length === 0 ? <ActivityIndicator color="#4CAF50" /> : entries.length === 0 ? <View className="bg-white rounded-2xl p-8 items-center border border-[#E5E5E5]"><Ionicons name="wallet-outline" size={36} color="#9CA3AF" /><Text className="text-[#1A1A2E] font-bold mt-3">No earnings activity yet</Text><Text className="text-[#737373] text-sm text-center mt-1">Confirmed bookings will appear here.</Text></View> : entries.map((entry) => { const copy = describe(entry); const date = new Date(entry.posted_at || entry.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }); const state = entry.status === 'posted' ? 'Available' : entry.status === 'reversed' ? 'Reversed' : 'Pending'; return <View key={entry.id} className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"><View className="flex-row"><View className="h-10 w-10 rounded-full bg-[#F5F5F5] items-center justify-center mr-3"><Ionicons name={copy.icon} size={20} color={copy.color} /></View><View className="flex-1 mr-2"><Text className="text-[#1A1A2E] font-bold">{copy.title}</Text><Text className="text-[#737373] text-xs mt-1">{entry.ground_title} · #{entry.booking_number}</Text></View><Text style={{ color: copy.color }} className="font-bold">{entry.amount < 0 ? '−' : '+'}{money(entry.amount)}</Text></View><Text className="text-[#5F6368] text-xs leading-5 mt-3">{copy.detail}</Text><View className="flex-row justify-between mt-3 pt-3 border-t border-[#F5F5F5]"><Text className="text-[#737373] text-xs">{date}</Text><Text style={{ color: copy.color }} className="text-xs font-bold uppercase">{state}</Text></View></View>; })}
    </ScrollView><Toast message={toast} tone="error" onHide={() => setToast(null)} />
  </SafeAreaView>;
}
