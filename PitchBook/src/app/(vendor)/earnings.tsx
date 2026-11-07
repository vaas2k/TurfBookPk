import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  EarningsEntry,
  EarningsSummary,
  getVendorEarnings,
} from "@/lib/api/vendors";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";
import { shortBookingReference } from "@/lib/booking-reference";

const emptySummary: EarningsSummary = {
  available_to_withdraw: 0,
  pending_earnings: 0,
  total_paid_out: 0,
  pending_refunds: 0,
};
const money = (value: number) => `PKR ${Math.abs(value).toLocaleString()}`;

function describe(entry: EarningsEntry) {
  if (entry.status === "reversed")
    return {
      title: "Earning reversed",
      detail:
        "The booking was cancelled, so this pending earning is no longer payable.",
      color: "#6B7280",
      icon: "arrow-undo-outline" as const,
    };
  if (entry.type === "refund")
    return {
      title:
        entry.status === "pending"
          ? "Player refund awaiting processing"
          : "Player refund processed",
      detail:
        "This is money returned to the player, not an extra vendor charge.",
      color: "#DC2626",
      icon: "return-down-back-outline" as const,
    };
  if (entry.type === "payout")
    return {
      title: "Settlement recorded",
      detail: "A payment settlement was recorded for this booking.",
      color: "#1A1A2E",
      icon: "wallet-outline" as const,
    };
  if (entry.type === "adjustment")
    return {
      title: "Balance adjustment",
      detail: "An adjustment was recorded for this booking.",
      color: entry.amount < 0 ? "#DC2626" : "#2E7D32",
      icon: "options-outline" as const,
    };
  if (entry.status === "pending")
    return {
      title: "Earning pending match completion",
      detail: "It becomes available after the booked slot ends.",
      color: "#C56A00",
      icon: "time-outline" as const,
    };
  return {
    title: entry.description.startsWith("Cancellation fee")
      ? "Cancellation fee earned"
      : "Earning available",
    detail: "This completed booking income is recorded for your venue.",
    color: "#2E7D32",
    icon: "checkmark-circle-outline" as const,
  };
}

export default function VendorEarnings() {
  const [summary, setSummary] = useState<EarningsSummary>(emptySummary);
  const [entries, setEntries] = useState<EarningsEntry[]>([]);
  const [period, setPeriod] = useState<'all' | 'week' | 'month'>('all');
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<'all' | 'available' | 'refunds' | 'payouts'>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EarningsEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getVendorEarnings(1);
      setSummary(result.summary);
      setEntries(result.entries);
      setPage(result.pagination.page);
      setHasMore(result.pagination.has_more);
    } catch (error: any) {
      setToast(error?.message || "Unable to load earnings.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await getVendorEarnings(page + 1);
      setEntries((current) => [...current, ...result.entries]);
      setPage(result.pagination.page);
      setHasMore(result.pagination.has_more);
    } catch (error: any) {
      setToast(error?.message || "Unable to load more earnings.");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, page]);
  const visibleEntries = entries.filter((entry) => {
    if (period === 'all') return true;
    const age = Date.now() - new Date(entry.posted_at || entry.created_at).getTime();
    return age <= (period === 'week' ? 7 : 31) * 86_400_000;
  });
  const filteredActivity = visibleEntries.filter((entry) => {
    if (activityFilter === 'all') return true;
    if (activityFilter === 'available') return entry.type === 'booking_earning' && entry.status === 'posted';
    if (activityFilter === 'refunds') return entry.type === 'refund';
    return entry.type === 'payout';
  });
  const earningsEntries = visibleEntries.filter(
    (entry) => entry.type === "booking_earning" && entry.status !== "reversed",
  );
  const periodRevenue = earningsEntries.reduce(
    (total, entry) => total + Math.max(0, entry.amount),
    0,
  );
  const dailyRevenue = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const value = earningsEntries
      .filter((entry) => {
        const posted = new Date(entry.posted_at || entry.created_at);
        return (
          posted.getFullYear() === date.getFullYear() &&
          posted.getMonth() === date.getMonth() &&
          posted.getDate() === date.getDate()
        );
      })
      .reduce((total, entry) => total + Math.max(0, entry.amount), 0);
    return { label: date.toLocaleDateString("en-PK", { weekday: "narrow" }), value };
  });
  const maxDailyRevenue = Math.max(...dailyRevenue.map((item) => item.value), 1);
  const groundPerformance = Object.values(
    earningsEntries.reduce<Record<string, { title: string; total: number; bookings: number }>>(
      (result, entry) => {
        const key = entry.ground_title || "Your ground";
        const current = result[key] || { title: key, total: 0, bookings: 0 };
        current.total += Math.max(0, entry.amount);
        current.bookings += 1;
        result[key] = current;
        return result;
      },
      {},
    ),
  )
    .sort((left, right) => right.total - left.total)
    .slice(0, 3);
  const maxGroundRevenue = Math.max(...groundPerformance.map((item) => item.total), 1);
  return (
    <SafeAreaView className="flex-1 bg-[#10120F]">
      <View className="px-6 pt-5 flex-row items-center justify-between">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace("/(vendor)")}
          className="hidden"
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 27 }} className="text-[#F5F5F0]">EARNINGS</Text><Text className="text-xs text-[#AFAFA9] mt-0.5">Your money at a glance</Text></View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose earnings date range" accessibilityState={{ expanded: periodPickerOpen }} onPress={() => setPeriodPickerOpen(true)} className="min-h-[44px] bg-[#1B1F19] border border-[#3A4436] rounded-xl px-4 flex-row items-center justify-center"><Text className="text-[#F5F5F0] font-bold text-sm">{period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'All time'}</Text><Ionicons name="chevron-down" size={16} color="#AFAFA9" style={{ marginLeft: 7 }} /></TouchableOpacity>
      </View>
      <ScrollView
        className="flex-1 px-6 pt-5"
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            colors={["#4CAF50"]}
          />
        }
      >
        <View className="bg-[#1B1F19] border border-[#30372B] rounded-[20px] p-5">
          <Text className="text-[#AFAFA9] text-sm font-bold">BOOKING EARNINGS</Text>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0] text-[36px] mt-2">
            {money(periodRevenue)}
          </Text>
          <Text className="text-[#92978F] text-xs mt-1">Income recorded for the selected time period</Text>
          <View className="flex-row mt-5 pt-4 border-t border-[#30372B]"><View className="flex-1 mr-3"><Text className="text-[#92978F] text-xs">Available now</Text><Text className="text-[#F5F5F0] font-bold mt-1">{money(summary.available_to_withdraw)}</Text><Text className="text-[#737A71] text-[10px] mt-1">Ready for payout</Text></View><View className="flex-1 px-3 border-l border-r border-[#30372B]"><Text className="text-[#92978F] text-xs">Still pending</Text><Text className="text-[#F5C76B] font-bold mt-1">{money(summary.pending_earnings)}</Text><Text className="text-[#737A71] text-[10px] mt-1">Waiting for completion</Text></View><View className="flex-1 ml-3"><Text className="text-[#92978F] text-xs">Paid out</Text><Text className="text-[#50C15B] font-bold mt-1">{money(summary.total_paid_out)}</Text><Text className="text-[#737A71] text-[10px] mt-1">Already settled</Text></View></View>
        </View>
        <View className="mt-4 bg-[#1B1F19] border border-[#30372B] rounded-[20px] p-5">
          <Text className="text-[#F5F5F0] text-base font-bold">Revenue by day</Text>
          <View className="h-36 flex-row items-end justify-between mt-5 px-1">
            {dailyRevenue.map((item, index) => <View key={`${item.label}-${index}`} className="items-center flex-1 h-full justify-end"><View style={{ height: Math.max(5, (item.value / maxDailyRevenue) * 94) }} className="w-5 rounded-t-md bg-[#50C15B]" /><Text className="text-[#92978F] text-[10px] mt-2">{item.label}</Text></View>)}
          </View>
          <Text className="text-[#92978F] text-xs mt-1">Booking income recorded each day</Text>
        </View>
        <View className="mt-4 bg-[#1B1F19] border border-[#30372B] rounded-[20px] p-5">
          <Text className="text-[#F5F5F0] text-base font-bold">Bookings by ground</Text>
          {groundPerformance.length ? groundPerformance.map((ground) => <View key={ground.title} className="mt-4"><View className="flex-row justify-between mb-2"><Text numberOfLines={1} className="text-[#D9DBD5] text-sm flex-1 mr-3">{ground.title}</Text><Text className="text-[#AFAFA9] text-xs">{ground.bookings} bookings</Text></View><View className="h-2 rounded-full bg-[#30372B] overflow-hidden"><View style={{ width: `${Math.max(8, (ground.total / maxGroundRevenue) * 100)}%` }} className="h-full rounded-full bg-[#50C15B]" /></View></View>) : <Text className="text-[#92978F] text-sm mt-3">Your completed booking income will appear here.</Text>}
        </View>
        {summary.pending_refunds > 0 && (
          <View className="mt-3 bg-[#38201E] rounded-2xl p-4 border border-[#69332C] flex-row">
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#DC2626"
            />
            <View className="flex-1 ml-3">
              <Text className="text-[#FFD1CB] font-bold">
                Player refunds being processed: {money(summary.pending_refunds)}
              </Text>
              <Text className="text-[#E9A49B] text-xs mt-1">
                This is separate from your available balance.
              </Text>
            </View>
          </View>
        )}
        <View className="flex-row items-end justify-between mt-7 mb-3">
          <View>
            <Text className="text-lg font-bold text-[#F5F5F0]">Activity</Text>
            <Text className="text-xs text-[#92978F] mt-0.5">
              Newest transactions first
            </Text>
          </View>
          <Text className="text-xs font-semibold text-[#AFAFA9]">
            {filteredActivity.length}{hasMore ? "+" : ""} entries
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4" contentContainerStyle={{ paddingRight: 12 }}>
          {([['all', 'All'], ['available', 'Available'], ['payouts', 'Payouts'], ['refunds', 'Refunds']] as const).map(([key, label]) => <TouchableOpacity key={key} accessibilityRole="tab" accessibilityState={{ selected: activityFilter === key }} onPress={() => setActivityFilter(key)} className={`mr-2 min-h-[44px] justify-center rounded-full px-5 ${activityFilter === key ? 'bg-[#50C15B]' : 'bg-transparent border border-[#3A4436]'}`}><Text className={activityFilter === key ? 'text-[#0C170D] text-xs font-bold' : 'text-[#D9DBD5] text-xs font-bold'}>{label}</Text></TouchableOpacity>)}
        </ScrollView>
        {loading && entries.length === 0 ? (
          <ActivityIndicator color="#4CAF50" />
        ) : filteredActivity.length === 0 ? (
          <View className="bg-[#1B1F19] rounded-2xl p-8 items-center border border-[#30372B]">
            <Ionicons name="wallet-outline" size={36} color="#9CA3AF" />
            <Text className="text-[#F5F5F0] font-bold mt-3">
              No {activityFilter === 'all' ? 'earnings activity' : activityFilter} activity
            </Text>
            <Text className="text-[#92978F] text-sm text-center mt-1">
              Try another status or time period.
            </Text>
          </View>
        ) : (
          filteredActivity.map((entry) => {
            const copy = describe(entry);
            const date = new Date(
              entry.posted_at || entry.created_at,
            ).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const state =
              entry.status === "posted"
                ? "Available"
                : entry.status === "reversed"
                  ? "Reversed"
                  : "Pending";
            return (
              <TouchableOpacity
                key={entry.id}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${copy.title}`}
                onPress={() => setSelectedEntry(entry)}
                className="bg-[#1B1F19] rounded-2xl p-4 mb-3 border border-[#30372B]"
              >
                <View className="flex-row">
                  <View className="h-10 w-10 rounded-full bg-[#282E25] items-center justify-center mr-3">
                    <Ionicons name={copy.icon} size={20} color={copy.color} />
                  </View>
                  <View className="flex-1 mr-2">
                    <Text className="text-[#F5F5F0] font-bold">
                      {copy.title}
                    </Text>
                    <Text className="text-[#AFAFA9] text-xs mt-1">
                      {entry.ground_title} · #{shortBookingReference(entry.booking_number)}
                    </Text>
                  </View>
                  <Text style={{ color: copy.color }} className="font-bold">
                    {entry.amount < 0 ? "−" : "+"}
                    {money(entry.amount)}
                  </Text>
                </View>
                <Text className="text-[#B8BBB5] text-xs leading-5 mt-3">
                  {copy.detail}
                </Text>
                <View className="flex-row justify-between mt-3 pt-3 border-t border-[#30372B]">
                  <Text className="text-[#AFAFA9] text-xs">{date}</Text>
                  <Text
                    style={{ color: copy.color }}
                    className="text-xs font-bold uppercase"
                  >
                    {state}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        {hasMore && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Load more earnings activity"
            disabled={loadingMore}
            onPress={loadMore}
            className="mt-1 min-h-12 items-center justify-center rounded-xl border border-[#3D563A] bg-[#1B1F19]"
          >
            {loadingMore ? (
              <ActivityIndicator color="#4CAF50" />
            ) : (
              <Text className="text-sm font-bold text-[#2E7D32]">
                Load more activity
              </Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
      <Modal
        visible={periodPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPeriodPickerOpen(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => setPeriodPickerOpen(false)} className="flex-1 justify-end bg-black/60">
          <TouchableOpacity activeOpacity={1} onPress={() => undefined} className="rounded-t-3xl border-t border-[#30372B] bg-[#1B1F19] px-6 pb-9 pt-4">
            <View className="h-1 w-11 self-center rounded-full bg-[#60665E]" />
            <Text className="mt-5 text-xl font-bold text-[#F5F5F0]">Show earnings from</Text>
            <Text className="mt-1 text-sm text-[#92978F]">This changes booking income, charts, and activity. Your current balances stay visible.</Text>
            {([['all', 'All time', 'Your complete earnings history'], ['week', 'Last 7 days', 'A quick view of this week'], ['month', 'Last 30 days', 'Your recent monthly performance']] as const).map(([key, label, detail]) => {
              const selected = period === key;
              return <TouchableOpacity key={key} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setPeriod(key); setPeriodPickerOpen(false); }} className={`mt-3 min-h-[62px] flex-row items-center rounded-2xl border px-4 ${selected ? 'border-[#50C15B] bg-[#203B24]' : 'border-[#30372B] bg-[#252A22]'}`}><View className={`h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-[#50C15B]' : 'border-[#747A71]'}`}>{selected ? <View className="h-2.5 w-2.5 rounded-full bg-[#50C15B]" /> : null}</View><View className="ml-3 flex-1"><Text className="font-bold text-[#F5F5F0]">{label}</Text><Text className="mt-0.5 text-xs text-[#92978F]">{detail}</Text></View></TouchableOpacity>;
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={selectedEntry !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          {selectedEntry && (() => {
            const copy = describe(selectedEntry);
            const date = new Date(selectedEntry.posted_at || selectedEntry.created_at).toLocaleString("en-PK", {
              day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
            });
            const status = selectedEntry.status === "posted" ? "Available" : selectedEntry.status === "reversed" ? "Reversed" : "Pending";
            return (
              <View className="bg-[#1B1F19] border-t border-[#30372B] rounded-t-3xl px-6 pt-5 pb-9">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xl font-bold text-[#F5F5F0]">Transaction details</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Close transaction details"
                    onPress={() => setSelectedEntry(null)}
                    className="h-11 w-11 items-center justify-center rounded-full bg-[#252A22]"
                  >
                    <Ionicons name="close" size={22} color="#F5F5F0" />
                  </TouchableOpacity>
                </View>
                <View className="mt-5 rounded-2xl bg-[#252A22] p-4">
                  <Text style={{ color: copy.color }} className="text-2xl font-bold">
                    {selectedEntry.amount < 0 ? "−" : "+"}{money(selectedEntry.amount)}
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-[#F5F5F0]">{copy.title}</Text>
                  <Text className="mt-1 text-sm leading-5 text-[#AFAFA9]">{copy.detail}</Text>
                </View>
                <View className="mt-5 gap-4">
                  <View><Text className="text-xs font-bold text-[#92978F]">GROUND</Text><Text className="mt-1 text-base text-[#F5F5F0]">{selectedEntry.ground_title}</Text></View>
                  <View><Text className="text-xs font-bold text-[#92978F]">BOOKING</Text><Text className="mt-1 text-base text-[#F5F5F0]">#{shortBookingReference(selectedEntry.booking_number)}</Text></View>
                  <View><Text className="text-xs font-bold text-[#737373]">STATUS</Text><Text style={{ color: copy.color }} className="mt-1 text-base font-bold">{status}</Text></View>
                  <View><Text className="text-xs font-bold text-[#92978F]">RECORDED</Text><Text className="mt-1 text-base text-[#F5F5F0]">{date}</Text></View>
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
