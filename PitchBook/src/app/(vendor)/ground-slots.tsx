import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  createGroundBlackouts,
  deleteGroundBlackout,
  deleteGroundSlot,
  GroundBlackout,
  listGroundBlackouts,
  listGroundSlots,
  Slot,
} from "@/lib/api/vendors";
import { Ionicons } from "@expo/vector-icons";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";

const pakistanDate = () =>
  new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Plain-language daily manager. The older editor remains below temporarily for
 * compatibility, but is deliberately not rendered. */
export default function GroundSlots() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blackouts, setBlackouts] = useState<GroundBlackout[]>([]);
  const [date, setDate] = useState(pakistanDate());
  const [calendarMonth, setCalendarMonth] = useState(
    pakistanDate().slice(0, 7),
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Slot | null>(null);
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [currentSlots, currentBlackouts] = await Promise.all([
        listGroundSlots(id),
        listGroundBlackouts(id),
      ]);
      setSlots(currentSlots);
      setBlackouts(currentBlackouts);
    } catch (error: any) {
      const message = error?.message || "Unable to load slots.";
      setLoadError(message);
      setToast(message);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const remove = async () => {
    if (!id || !removing) return;
    try {
      await deleteGroundSlot(id, removing.id);
      setRemoving(null);
      await load();
      setToast("Slot removed.");
    } catch (error: any) {
      setRemoving(null);
      setToast(error?.message || "Unable to remove this slot.");
    }
  };
  const toggleBlackout = async () => {
    if (!id) return;
    const existing = blackouts.find((item) => item.date === date);
    try {
      if (existing) {
        await deleteGroundBlackout(id, date);
        setToast(`${date} is open again.`);
      } else {
        await createGroundBlackouts(id, [date], "Venue closed");
        setToast(`${date} is marked closed.`);
      }
      await load();
    } catch (error: any) {
      setToast(error?.message || "Unable to change this closure.");
    }
  };
  const monthStart = new Date(`${calendarMonth}-01T00:00:00Z`);
  const daysInMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const days = Array.from(
    { length: monthStart.getUTCDay() + daysInMonth },
    (_, index) => {
      if (index < monthStart.getUTCDay()) return null;
      const number = index - monthStart.getUTCDay() + 1;
      const key = `${calendarMonth}-${String(number).padStart(2, "0")}`;
      return { key, number };
    },
  );
  const moveCalendarMonth = (direction: number) => {
    const next = new Date(
      Date.UTC(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth() + direction,
        1,
      ),
    );
    const nextMonth = next.toISOString().slice(0, 7);
    setCalendarMonth(nextMonth);
    setDate(`${nextMonth}-01`);
  };
  const todaySlots = slots
    .filter((slot) => slot.date === date)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const isBlackout = blackouts.some((item) => item.date === date);
  const available = todaySlots.filter(
    (slot) => !slot.is_booked && !slot.is_blocked,
  ).length;
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      className="flex-1 bg-[#10120F]"
    >
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center pt-5 pb-4">
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(vendor)/grounds")}
            className="h-10 w-10 items-center justify-center -ml-2"
          >
            <Ionicons name="chevron-back" size={28} color="#F5F5F0" />
          </TouchableOpacity>
          <View className="flex-1 ml-3">
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[20px] text-[#F5F5F0]"
              numberOfLines={1}
            >
              {title || "Slot management"}
            </Text>
            <Text className="text-[#92978F] text-sm">
              Choose a day, then take action.
            </Text>
          </View>
        </View>
        {loadError && slots.length === 0 && !loading && (
          <View className="mb-5 items-center rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-6 py-7">
            <Ionicons name="cloud-offline-outline" size={36} color="#DC2626" />
            <Text className="mt-3 text-center text-lg font-bold text-[#991B1B]">
              Could not load slots
            </Text>
            <Text className="mt-1 text-center text-sm text-[#B91C1C]">
              Check your connection, then try again.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Retry loading slots"
              onPress={load}
              className="mt-4 min-h-11 justify-center rounded-xl bg-[#DC2626] px-5"
            >
              <Text className="font-bold text-white">Try again</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/(vendor)/setup-schedule",
              params: { id, title },
            })
          }
          className="bg-[#1B251B] border border-[#315536] rounded-2xl p-4 mb-5 flex-row items-center"
        >
          <View className="h-11 w-11 rounded-xl bg-[#42B84F] items-center justify-center">
            <Ionicons name="repeat" size={21} color="#102110" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="font-bold text-[#F5F5F0]">
              Change regular booking times
            </Text>
            <Text className="text-[#9ACB9F] text-xs mt-1">
              Use this only to change your repeating daily schedule.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#57CC63" />
        </TouchableOpacity>
        <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-3 mb-4">
          <Text className="text-[#1A1A2E] font-bold mb-3">
            Calendar â€” next 31 days
          </Text>
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => moveCalendarMonth(-1)}
              className="h-10 w-10 rounded-xl bg-[#282E25] items-center justify-center"
            >
              <Ionicons name="chevron-back" size={20} color="#F5F5F0" />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#F5F5F0] text-base"
            >
              {monthStart.toLocaleDateString("en-PK", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => moveCalendarMonth(1)}
              className="h-10 w-10 rounded-xl bg-[#282E25] items-center justify-center"
            >
              <Ionicons name="chevron-forward" size={20} color="#F5F5F0" />
            </TouchableOpacity>
          </View>
          <View className="flex-row mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
              <Text
                key={`${label}-${index}`}
                className="w-[14.28%] text-center text-[#777D74] text-[11px] font-bold"
              >
                {label}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {days.map((item, index) => {
              if (!item)
                return (
                  <View
                    key={`blank-${index}`}
                    className="w-[14.28%] h-[68px]"
                  />
                );
              const count = slots.filter(
                (slot) => slot.date === item.key,
              ).length;
              const active = date === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setDate(item.key)}
                  className={`w-[14.28%] h-[68px] justify-center rounded-xl items-center ${active ? "bg-[#42B84F]" : blackouts.some((blackout) => blackout.date === item.key) ? "bg-[#38201E] border border-[#69332C]" : "bg-[#252A22]"}`}
                >
                  <Text
                    className={
                      active
                        ? "text-white text-xs font-bold"
                        : "text-[#92978F] text-xs"
                    }
                  >
                    {item.key === pakistanDate()
                      ? "Today"
                      : blackouts.some((blackout) => blackout.date === item.key)
                        ? "Closed"
                        : count
                          ? `${count} slots`
                          : ""}
                  </Text>
                  <Text
                    className={
                      active
                        ? "text-white text-lg font-bold mt-1"
                        : "text-[#F5F5F0] text-lg font-bold mt-1"
                    }
                  >
                    {item.number}
                  </Text>
                  <Text
                    className={
                      active
                        ? "text-white text-[10px]"
                        : "text-[#92978F] text-[10px]"
                    }
                  >
                    {blackouts.some((blackout) => blackout.date === item.key)
                      ? "Closed"
                      : `${count} slots`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Manage selected day slots"
          onPress={() =>
            router.push({
              pathname: "/(vendor)/ground-slot-day",
              params: { id, title, date },
            })
          }
          className="bg-[#42B84F] rounded-2xl p-4 mb-4 flex-row items-center justify-between"
        >
          <View>
            <Text className="text-[#102110] font-bold text-base">
              Manage this day
            </Text>
            <Text className="text-[#17351A] text-xs mt-1">
              {todaySlots.length} slots for {date}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#102110" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleBlackout}
          className={`rounded-2xl p-4 mb-5 flex-row items-center border ${isBlackout ? "bg-[#17301B] border-[#315536]" : "bg-[#38201E] border-[#69332C]"}`}
        >
          <View
            className={`h-11 w-11 rounded-xl items-center justify-center ${isBlackout ? "bg-[#42B84F]" : "bg-[#DC2626]"}`}
          >
            <Ionicons
              name={isBlackout ? "lock-open-outline" : "lock-closed-outline"}
              size={21}
              color="#F5F5F0"
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-[#F5F5F0] font-bold">
              {isBlackout ? `Reopen ${date}` : `Close ground on ${date}`}
            </Text>
            <Text className="text-[#B8BBB5] text-xs mt-1">
              {isBlackout
                ? "Players can book this day again."
                : "Closes all unbooked slots for this whole day."}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={isBlackout ? "#2E7D32" : "#DC2626"}
          />
        </TouchableOpacity>
        <View className="flex-row mb-4">
          <View className="flex-1 bg-[#1B1F19] border border-[#30372B] rounded-xl p-3 mr-2">
            <Text className="text-[#92978F] text-xs">Available</Text>
            <Text className="text-[#57CC63] text-xl font-bold mt-1">
              {available}
            </Text>
          </View>
          <View className="flex-1 bg-[#1B1F19] border border-[#30372B] rounded-xl p-3 mr-2">
            <Text className="text-[#92978F] text-xs">Booked</Text>
            <Text className="text-[#DC2626] text-xl font-bold mt-1">
              {todaySlots.filter((slot) => slot.is_booked).length}
            </Text>
          </View>
          <View className="flex-1 bg-[#1B1F19] border border-[#30372B] rounded-xl p-3">
            <Text className="text-[#92978F] text-xs">Unavailable</Text>
            <Text className="text-[#C56A00] text-xl font-bold mt-1">
              {todaySlots.filter((slot) => slot.is_blocked).length}
            </Text>
          </View>
        </View>
        <Text className="text-[#F5F5F0] text-lg font-bold mb-3">
          {new Date(`${date}T12:00:00`).toLocaleDateString("en-PK", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
        {loading ? (
          <ActivityIndicator className="mt-8" color="#4CAF50" />
        ) : todaySlots.length === 0 ? (
          <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-7 items-center">
            <Ionicons name="calendar-outline" size={36} color="#9CA3AF" />
            <Text className="text-[#F5F5F0] font-bold mt-3">
              No slots on this day
            </Text>
            <Text className="text-[#92978F] text-center mt-1">
              Change your regular booking times to add slots.
            </Text>
          </View>
        ) : (
          <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-5 items-center">
            <Ionicons
              name="checkmark-circle-outline"
              size={30}
              color="#57CC63"
            />
            <Text className="text-[#F5F5F0] font-bold mt-2">
              Daily slots are ready
            </Text>
            <Text className="text-[#92978F] text-sm text-center mt-1">
              Open day management to block, reserve for your club, or remove
              individual slots.
            </Text>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={Boolean(removing)}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoving(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-7">
          <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-6 w-full">
            <Text className="text-xl font-bold text-[#F5F5F0]">
              Remove this slot?
            </Text>
            <Text className="text-[#AFAFA9] mt-2">
              Players will no longer be able to book it.
            </Text>
            <View className="flex-row justify-end mt-6">
              <TouchableOpacity
                onPress={() => setRemoving(null)}
                className="px-4 py-3"
              >
                <Text className="text-[#D9DBD5] font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={remove}
                className="bg-[#DC2626] rounded-xl px-4 py-3"
              >
                <Text className="text-white font-bold">Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
