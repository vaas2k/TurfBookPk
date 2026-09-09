import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EarningsEntry, getVendorEarnings } from '@/lib/api/vendors';
import { Toast } from '@/components/ui/toast';

export default function VendorEarnings() {
  const [summary, setSummary] = useState({ total_earnings: 0, pending_earnings: 0, total_withdrawn: 0 });
  const [entries, setEntries] = useState<EarningsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const result = await getVendorEarnings(); setSummary(result.summary); setEntries(result.entries); }
    catch (error: any) { setToast(error?.message || 'Unable to load earnings.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <View className="px-6 py-5 bg-white border-b border-[#E5E5E5]"><Text className="text-2xl font-bold text-[#1A1A2E]">Earnings</Text></View>
      <ScrollView className="flex-1 px-5 pt-5" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <View className="bg-[#1A1A2E] rounded-2xl p-5"><Text className="text-white/70">Available earnings</Text><Text className="text-white text-3xl font-bold mt-2">PKR {summary.total_earnings}</Text><Text className="text-white/70 mt-3">Pending: PKR {summary.pending_earnings} · Withdrawn: PKR {summary.total_withdrawn}</Text></View>
        <Text className="text-lg font-bold text-[#1A1A2E] mt-6 mb-3">Ledger activity</Text>
        {loading && entries.length === 0 ? <ActivityIndicator color="#4CAF50" /> : entries.length === 0 ? <Text className="text-[#737373] text-center py-10">No earnings activity yet.</Text> : entries.map((entry) => <View key={entry.id} className="bg-white rounded-xl p-4 mb-3 border border-[#E5E5E5]"><View className="flex-row justify-between"><Text className="text-[#1A1A2E] font-semibold flex-1">{entry.description}</Text><Text className={entry.amount >= 0 ? 'text-[#4CAF50] font-bold' : 'text-[#DC2626] font-bold'}>PKR {entry.amount}</Text></View><Text className="text-[#737373] text-xs mt-2">{entry.status.replaceAll('_', ' ')} · {new Date(entry.created_at).toLocaleDateString()}</Text></View>)}
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
