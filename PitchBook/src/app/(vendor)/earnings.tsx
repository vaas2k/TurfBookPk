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
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <View className="px-5 py-4 bg-white border-b border-[#E5E5E5] flex-row items-center">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace("/(vendor)")}
          className="w-11 h-11 rounded-full bg-[#F5F5F5] items-center justify-center mr-3"
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A2E" />
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-bold text-[#1A1A2E]">Earnings</Text>
          <Text className="text-xs text-[#737373] mt-0.5">
            Booking income overview
          </Text>
        </View>
      </View>
      <ScrollView
        className="flex-1 px-5 pt-5"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            colors={["#4CAF50"]}
          />
        }
      >
        <View className="bg-[#1A1A2E] rounded-3xl p-6">
          <Text className="text-white/70 text-sm">Available to withdraw</Text>
          <Text className="text-white text-3xl font-bold mt-1">
            {money(summary.available_to_withdraw)}
          </Text>
          <Text className="text-white/70 text-xs mt-3">
            Completed bookings become available here. Payout requests will be
            added when payments are live.
          </Text>
        </View>
        <View className="flex-row mt-4 gap-3">
          <View className="flex-1 bg-[#FFF7ED] rounded-2xl p-4 border border-[#FED7AA]">
            <Text className="text-[#9A3412] text-xs font-semibold">
              PENDING AFTER MATCH
            </Text>
            <Text className="text-[#9A3412] text-lg font-bold mt-1">
              {money(summary.pending_earnings)}
            </Text>
            <Text className="text-[#9A3412] text-xs mt-1">
              Not withdrawable yet
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl p-4 border border-[#E5E5E5]">
            <Text className="text-[#4B5563] text-xs font-semibold">
              PAID OUT
            </Text>
            <Text className="text-[#1A1A2E] text-lg font-bold mt-1">
              {money(summary.total_paid_out)}
            </Text>
            <Text className="text-[#737373] text-xs mt-1">
              Total sent to you
            </Text>
          </View>
        </View>
        {summary.pending_refunds > 0 && (
          <View className="mt-3 bg-[#FEF2F2] rounded-2xl p-4 border border-[#FECACA] flex-row">
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#DC2626"
            />
            <View className="flex-1 ml-3">
              <Text className="text-[#991B1B] font-bold">
                Player refunds being processed: {money(summary.pending_refunds)}
              </Text>
              <Text className="text-[#B91C1C] text-xs mt-1">
                This is separate from your available balance.
              </Text>
            </View>
          </View>
        )}
        <View className="flex-row items-end justify-between mt-7 mb-3">
          <View>
            <Text className="text-lg font-bold text-[#1A1A2E]">Activity</Text>
            <Text className="text-xs text-[#737373] mt-0.5">
              Newest transactions first
            </Text>
          </View>
          <Text className="text-xs font-semibold text-[#4B5563]">
            {visibleEntries.length}{hasMore ? "+" : ""} entries
          </Text>
        </View>
        <View className="flex-row mb-4">{([['all', 'All time'], ['week', 'Last 7 days'], ['month', 'Last 31 days']] as const).map(([key, label]) => <TouchableOpacity key={key} onPress={() => setPeriod(key)} className={`mr-2 rounded-full px-4 py-2 ${period === key ? 'bg-[#1A1A2E]' : 'bg-white border border-[#E5E5E5]'}`}><Text className={period === key ? 'text-white text-xs font-bold' : 'text-[#4B5563] text-xs font-bold'}>{label}</Text></TouchableOpacity>)}</View>
        {loading && entries.length === 0 ? (
          <ActivityIndicator color="#4CAF50" />
        ) : visibleEntries.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-[#E5E5E5]">
            <Ionicons name="wallet-outline" size={36} color="#9CA3AF" />
            <Text className="text-[#1A1A2E] font-bold mt-3">
              No earnings activity yet
            </Text>
            <Text className="text-[#737373] text-sm text-center mt-1">
              Confirmed bookings will appear here.
            </Text>
          </View>
        ) : (
          visibleEntries.map((entry) => {
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
                className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"
              >
                <View className="flex-row">
                  <View className="h-10 w-10 rounded-full bg-[#F5F5F5] items-center justify-center mr-3">
                    <Ionicons name={copy.icon} size={20} color={copy.color} />
                  </View>
                  <View className="flex-1 mr-2">
                    <Text className="text-[#1A1A2E] font-bold">
                      {copy.title}
                    </Text>
                    <Text className="text-[#737373] text-xs mt-1">
                      {entry.ground_title} · #{entry.booking_number}
                    </Text>
                  </View>
                  <Text style={{ color: copy.color }} className="font-bold">
                    {entry.amount < 0 ? "−" : "+"}
                    {money(entry.amount)}
                  </Text>
                </View>
                <Text className="text-[#5F6368] text-xs leading-5 mt-3">
                  {copy.detail}
                </Text>
                <View className="flex-row justify-between mt-3 pt-3 border-t border-[#F5F5F5]">
                  <Text className="text-[#737373] text-xs">{date}</Text>
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
            className="mt-1 min-h-12 items-center justify-center rounded-xl border border-[#D1D5DB] bg-white"
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
              <View className="bg-white rounded-t-3xl px-6 pt-5 pb-9">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xl font-bold text-[#1A1A2E]">Transaction details</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Close transaction details"
                    onPress={() => setSelectedEntry(null)}
                    className="h-11 w-11 items-center justify-center rounded-full bg-[#F5F5F5]"
                  >
                    <Ionicons name="close" size={22} color="#1A1A2E" />
                  </TouchableOpacity>
                </View>
                <View className="mt-5 rounded-2xl bg-[#F8F9FA] p-4">
                  <Text style={{ color: copy.color }} className="text-2xl font-bold">
                    {selectedEntry.amount < 0 ? "−" : "+"}{money(selectedEntry.amount)}
                  </Text>
                  <Text className="mt-1 text-sm font-bold text-[#1A1A2E]">{copy.title}</Text>
                  <Text className="mt-1 text-sm leading-5 text-[#5F6368]">{copy.detail}</Text>
                </View>
                <View className="mt-5 gap-4">
                  <View><Text className="text-xs font-bold text-[#737373]">GROUND</Text><Text className="mt-1 text-base text-[#1A1A2E]">{selectedEntry.ground_title}</Text></View>
                  <View><Text className="text-xs font-bold text-[#737373]">BOOKING</Text><Text className="mt-1 text-base text-[#1A1A2E]">#{selectedEntry.booking_number}</Text></View>
                  <View><Text className="text-xs font-bold text-[#737373]">STATUS</Text><Text style={{ color: copy.color }} className="mt-1 text-base font-bold">{status}</Text></View>
                  <View><Text className="text-xs font-bold text-[#737373]">RECORDED</Text><Text className="mt-1 text-base text-[#1A1A2E]">{date}</Text></View>
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
