import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  bulkUpdateGroundSlots,
  createGroundBlackouts,
  createGroundSlot,
  createRecurringGroundSlots,
  deleteGroundBlackout,
  deleteGroundSlot,
  Ground,
  GroundBlackout,
  listGroundBlackouts,
  listGroundSlots,
  listVendorGrounds,
  Slot,
  updateGroundSlot,
} from "@/lib/api/vendors";
import { Ionicons } from "@expo/vector-icons";
import { formatTimeRange12 } from "@/lib/time";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";

const fieldClass =
  "bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]";
const pakistanDate = () =>
  new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

function normalizedTime(value: string): string | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

/** Plain-language daily manager. The older editor remains below temporarily for
 * compatibility, but is deliberately not rendered. */
export default function GroundSlots() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [blackouts, setBlackouts] = useState<GroundBlackout[]>([]);
  const [date, setDate] = useState(pakistanDate());
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
  const update = async (slot: Slot, data: Partial<Slot>, message: string) => {
    if (!id) return;
    try {
      await updateGroundSlot(id, slot.id, data);
      await load();
      setToast(message);
    } catch (error: any) {
      setToast(error?.message || "Unable to update this slot.");
    }
  };
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
  const days = Array.from({ length: 31 }, (_, index) => {
    const value = new Date(`${pakistanDate()}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + index);
    return {
      key: value.toISOString().slice(0, 10),
      label: value.toLocaleDateString("en-PK", { weekday: "short" }),
      number: value.getUTCDate(),
    };
  });
  const todaySlots = slots
    .filter((slot) => slot.date === date)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const isBlackout = blackouts.some((item) => item.date === date);
  const available = todaySlots.filter(
    (slot) => !slot.is_booked && !slot.is_blocked,
  ).length;
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center py-4">
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(vendor)/grounds")}
            className="h-11 w-11 rounded-full bg-white border border-[#E5E5E5] items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <View className="flex-1 ml-3">
            <Text
              className="text-xl font-bold text-[#1A1A2E]"
              numberOfLines={1}
            >
              {title || "Slot management"}
            </Text>
            <Text className="text-[#737373] text-sm">
              Choose a day, then take action.
            </Text>
          </View>
        </View>
        {loadError && slots.length === 0 && !loading && (
          <View className="mb-5 items-center rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-6 py-7">
            <Ionicons name="cloud-offline-outline" size={36} color="#DC2626" />
            <Text className="mt-3 text-center text-lg font-bold text-[#991B1B]">Could not load slots</Text>
            <Text className="mt-1 text-center text-sm text-[#B91C1C]">Check your connection, then try again.</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry loading slots" onPress={load} className="mt-4 min-h-11 justify-center rounded-xl bg-[#DC2626] px-5">
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
          className="bg-[#E8F5E9] rounded-2xl p-4 mb-5 flex-row items-center"
        >
          <View className="h-11 w-11 rounded-xl bg-[#4CAF50] items-center justify-center">
            <Ionicons name="repeat" size={21} color="white" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="font-bold text-[#1A1A2E]">
              Change regular booking times
            </Text>
            <Text className="text-[#39723C] text-xs mt-1">
              Use this only to change your repeating daily schedule.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#2E7D32" />
        </TouchableOpacity>
        <View className="bg-white border border-[#E5E5E5] rounded-2xl p-3 mb-4">
          <Text className="text-[#1A1A2E] font-bold mb-3">Calendar — next 31 days</Text>
          <View className="flex-row flex-wrap">
          {days.map((item) => {
            const count = slots.filter((slot) => slot.date === item.key).length;
            const active = date === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setDate(item.key)}
                className={`w-[14.28%] py-2 rounded-xl items-center ${active ? "bg-[#4CAF50]" : isBlackout && item.key === date ? "bg-[#FEE2E2]" : "bg-white"}`}
              >
                <Text
                  className={
                    active
                      ? "text-white text-xs font-bold"
                      : "text-[#737373] text-xs"
                  }
                >
                  {item.key === pakistanDate() ? "Today" : item.label}
                </Text>
                <Text
                  className={
                    active
                      ? "text-white text-lg font-bold mt-1"
                      : "text-[#1A1A2E] text-lg font-bold mt-1"
                  }
                >
                  {item.number}
                </Text>
                <Text
                  className={
                    active
                      ? "text-white text-[10px]"
                      : "text-[#737373] text-[10px]"
                  }
                >
                  {blackouts.some((blackout) => blackout.date === item.key) ? "Closed" : `${count} slots`}
                </Text>
              </TouchableOpacity>
            );
          })}
          </View>
        </View>
        <TouchableOpacity onPress={toggleBlackout} className={`rounded-2xl p-4 mb-5 flex-row items-center ${isBlackout ? "bg-[#E8F5E9]" : "bg-[#FEF2F2]"}`}>
          <View className={`h-11 w-11 rounded-xl items-center justify-center ${isBlackout ? "bg-[#4CAF50]" : "bg-[#DC2626]"}`}><Ionicons name={isBlackout ? "lock-open-outline" : "lock-closed-outline"} size={21} color="white" /></View>
          <View className="flex-1 ml-3"><Text className="text-[#1A1A2E] font-bold">{isBlackout ? `Reopen ${date}` : `Close ground on ${date}`}</Text><Text className="text-[#737373] text-xs mt-1">{isBlackout ? "Players can book this day again." : "Closes all unbooked slots for this whole day."}</Text></View>
          <Ionicons name="chevron-forward" size={20} color={isBlackout ? "#2E7D32" : "#DC2626"} />
        </TouchableOpacity>
        <View className="flex-row mb-4">
          <View className="flex-1 bg-white border border-[#E5E5E5] rounded-xl p-3 mr-2">
            <Text className="text-[#737373] text-xs">Available</Text>
            <Text className="text-[#2E7D32] text-xl font-bold mt-1">
              {available}
            </Text>
          </View>
          <View className="flex-1 bg-white border border-[#E5E5E5] rounded-xl p-3 mr-2">
            <Text className="text-[#737373] text-xs">Booked</Text>
            <Text className="text-[#DC2626] text-xl font-bold mt-1">
              {todaySlots.filter((slot) => slot.is_booked).length}
            </Text>
          </View>
          <View className="flex-1 bg-white border border-[#E5E5E5] rounded-xl p-3">
            <Text className="text-[#737373] text-xs">Unavailable</Text>
            <Text className="text-[#C56A00] text-xl font-bold mt-1">
              {todaySlots.filter((slot) => slot.is_blocked).length}
            </Text>
          </View>
        </View>
        <Text className="text-[#1A1A2E] text-lg font-bold mb-3">{date}</Text>
        {loading ? (
          <ActivityIndicator className="mt-8" color="#4CAF50" />
        ) : todaySlots.length === 0 ? (
          <View className="bg-white border border-[#E5E5E5] rounded-2xl p-7 items-center">
            <Ionicons name="calendar-outline" size={36} color="#9CA3AF" />
            <Text className="text-[#1A1A2E] font-bold mt-3">
              No slots on this day
            </Text>
            <Text className="text-[#737373] text-center mt-1">
              Change your regular booking times to add slots.
            </Text>
          </View>
        ) : (
          todaySlots.map((slot) => {
            const status = slot.is_booked
              ? "Booked by player"
              : slot.is_club_reserved
                ? "Reserved for your club"
                : slot.is_blocked
                  ? "Blocked"
                  : "Available to players";
            const color = slot.is_booked
              ? "#DC2626"
              : slot.is_club_reserved
                ? "#7C3AED"
                : slot.is_blocked
                  ? "#C56A00"
                  : "#2E7D32";
            return (
              <View
                key={slot.id}
                className="bg-white border border-[#E5E5E5] rounded-2xl p-4 mb-3"
              >
                <View className="flex-row justify-between items-start">
                  <View>
                    <Text className="text-[#1A1A2E] text-xl font-bold">
                      {formatTimeRange12(slot.start_time, slot.end_time)}
                    </Text>
                    <Text className="text-[#737373] mt-1">
                      PKR {slot.price}
                    </Text>
                  </View>
                  <Text style={{ color }} className="font-bold text-sm">
                    {status}
                  </Text>
                </View>
                {!slot.is_booked && (
                  <View className="flex-row flex-wrap mt-4">
                    <TouchableOpacity
                      onPress={() =>
                        update(
                          slot,
                          {
                            is_blocked: !slot.is_blocked,
                            is_club_reserved: false,
                          },
                          slot.is_blocked
                            ? "Slot is available again."
                            : "Slot blocked.",
                        )
                      }
                      className="rounded-xl bg-[#FFF7ED] px-4 py-3 mr-2 mb-2"
                    >
                      <Text className="text-[#A44C00] font-bold">
                        {slot.is_blocked && !slot.is_club_reserved
                          ? "Make available"
                          : "Block"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        update(
                          slot,
                          {
                            is_club_reserved: !slot.is_club_reserved,
                            reservation_note: !slot.is_club_reserved
                              ? "Reserved by venue"
                              : null,
                          },
                          slot.is_club_reserved
                            ? "Club reservation released."
                            : "Reserved for your club.",
                        )
                      }
                      className="rounded-xl bg-[#F3E8FF] px-4 py-3 mr-2 mb-2"
                    >
                      <Text className="text-[#6B21A8] font-bold">
                        {slot.is_club_reserved
                          ? "Release club"
                          : "Reserve club"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setRemoving(slot)}
                      className="rounded-xl bg-[#FEF2F2] px-4 py-3 mb-2"
                    >
                      <Text className="text-[#B91C1C] font-bold">Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
      <Modal
        visible={Boolean(removing)}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoving(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-7">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-xl font-bold text-[#1A1A2E]">
              Remove this slot?
            </Text>
            <Text className="text-[#737373] mt-2">
              Players will no longer be able to book it.
            </Text>
            <View className="flex-row justify-end mt-6">
              <TouchableOpacity
                onPress={() => setRemoving(null)}
                className="px-4 py-3"
              >
                <Text className="text-[#737373] font-bold">Cancel</Text>
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

function normalizedPrice(value: string): number | null {
  const clean = value.trim().replaceAll(",", "");
  if (!/^\d+$/.test(clean)) return null;
  const price = Number(clean);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function normalizedDate(value: string): string | null {
  const clean = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  const parsed = new Date(`${clean}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === clean
    ? clean
    : null;
}

function LegacyGroundSlots() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [ground, setGround] = useState<Ground | null>(null);
  const [form, setForm] = useState({
    date: pakistanDate(),
    start_time: "18:00",
    end_time: "19:00",
    price: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Slot | null>(null);
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null);
  const [repeatEveryDays, setRepeatEveryDays] = useState("7");
  const [occurrences, setOccurrences] = useState("4");
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [calendarDate, setCalendarDate] = useState(pakistanDate());

  const load = useCallback(async () => {
    if (typeof id !== "string") return;
    setLoading(true);
    try {
      const [currentSlots, grounds] = await Promise.all([
        listGroundSlots(id),
        listVendorGrounds(),
      ]);
      setSlots(currentSlots);
      setGround(grounds.find((item) => item.id === id) || null);
    } catch (error: any) {
      setToast(error?.message || "Unable to load slots.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (typeof id !== "string" || !id)
      return setToast(
        "Ground information is missing. Please reopen this screen.",
      );
    const date = normalizedDate(form.date);
    if (!date)
      return setToast("Enter the date as YYYY-MM-DD, for example 2026-09-20.");
    const startTime = normalizedTime(form.start_time);
    if (!startTime)
      return setToast("Enter a valid start time from 00:00 to 23:59.");
    const endTime = normalizedTime(form.end_time);
    if (!endTime)
      return setToast("Enter a valid end time from 00:00 to 23:59.");
    if (startTime >= endTime)
      return setToast("End time must be later than start time.");
    const price = normalizedPrice(form.price);
    if (price === null)
      return setToast("Enter a positive whole-number price, for example 2000.");
    setSaving(true);
    try {
      if (editingSlot)
        await updateGroundSlot(id, editingSlot.id, {
          date,
          start_time: startTime,
          end_time: endTime,
          price,
        });
      else
        await createGroundSlot(id, {
          date,
          start_time: startTime,
          end_time: endTime,
          price,
        });
      const successMessage = editingSlot ? "Slot updated." : "Slot added.";
      setEditingSlot(null);
      setForm((current) => ({
        ...current,
        date,
        start_time: endTime,
        end_time: "",
        price: "",
      }));
      await load();
      setToast(successMessage);
    } catch (error: any) {
      setToast(
        error?.message || `Unable to ${editingSlot ? "update" : "add"} slot.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (slot: Slot) => {
    setEditingSlot(slot);
    setForm({
      date: slot.date,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
      price: String(slot.price),
    });
  };

  const addRecurring = async () => {
    if (typeof id !== "string" || !id)
      return setToast(
        "Ground information is missing. Please reopen this screen.",
      );
    if (editingSlot)
      return setToast(
        "Finish or cancel slot editing before creating a recurring schedule.",
      );
    const date = normalizedDate(form.date);
    const startTime = normalizedTime(form.start_time);
    const endTime = normalizedTime(form.end_time);
    const price = normalizedPrice(form.price);
    const intervalDays = Number(repeatEveryDays);
    const count = Number(occurrences);
    if (
      !date ||
      !startTime ||
      !endTime ||
      price === null ||
      startTime >= endTime
    )
      return setToast(
        "Complete valid date, times, and price before creating recurrence.",
      );
    if (
      !Number.isSafeInteger(intervalDays) ||
      intervalDays < 1 ||
      !Number.isSafeInteger(count) ||
      count < 1 ||
      count > 60
    )
      return setToast(
        "Repeat interval must be at least 1 day; occurrences must be between 1 and 60.",
      );
    setSaving(true);
    try {
      const created = await createRecurringGroundSlots(id, {
        start_date: date,
        start_time: startTime,
        end_time: endTime,
        price,
        interval_days: intervalDays,
        occurrences: count,
      });
      await load();
      setToast(`${created.length} recurring slots added.`);
    } catch (error: any) {
      setToast(error?.message || "Unable to create recurring slots.");
    } finally {
      setSaving(false);
    }
  };
  const addDailySchedule = async () => {
    setRepeatEveryDays("1");
    setOccurrences("60");
    setToast(
      "Daily schedule is set for the next 60 days. Complete the slot fields, then tap Create Recurring Slots.",
    );
  };

  const toggleBlocked = async (slot: Slot) => {
    if (!id || slot.is_booked) return;
    try {
      await updateGroundSlot(id, slot.id, { is_blocked: !slot.is_blocked });
      await load();
      setToast(slot.is_blocked ? "Slot unblocked." : "Slot blocked.");
    } catch (error: any) {
      setToast(error?.message || "Unable to update slot.");
    }
  };

  const remove = async () => {
    if (!id || !pendingRemove) return;
    try {
      await deleteGroundSlot(id, pendingRemove.id);
      setPendingRemove(null);
      await load();
      setToast("Slot removed.");
    } catch (error: any) {
      setPendingRemove(null);
      setToast(error?.message || "Unable to remove slot.");
    }
  };
  const bulk = async (action: "block" | "unblock" | "delete") => {
    if (!id || !selectedSlotIds.length) return;
    setSaving(true);
    try {
      await bulkUpdateGroundSlots(id, selectedSlotIds, action);
      setSelectedSlotIds([]);
      await load();
      setToast(`${selectedSlotIds.length} slots updated.`);
    } catch (error: any) {
      setToast(error?.message || "Unable to update selected slots.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center py-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-11 h-11 rounded-full bg-white items-center justify-center mr-3 border border-[#E5E5E5]"
            onPress={() => goBackOrReplace("/(vendor)/grounds")}
          >
            <Ionicons name="arrow-back" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text
              className="text-xl font-bold text-[#1A1A2E]"
              numberOfLines={1}
            >
              {title || "Ground slots"}
            </Text>
            <Text className="text-[#737373] text-sm mt-1">
              Availability and schedule
            </Text>
          </View>
        </View>
        <View className="flex-row mb-5">
          <View className="flex-1 bg-white rounded-xl p-3 mr-2 border border-[#E5E5E5]">
            <Text className="text-[#737373] text-xs">Available</Text>
            <Text className="text-[#4CAF50] text-xl font-bold mt-1">
              {
                slots.filter((slot) => !slot.is_booked && !slot.is_blocked)
                  .length
              }
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-3 mr-2 border border-[#E5E5E5]">
            <Text className="text-[#737373] text-xs">Blocked</Text>
            <Text className="text-[#F59E0B] text-xl font-bold mt-1">
              {slots.filter((slot) => slot.is_blocked).length}
            </Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-3 border border-[#E5E5E5]">
            <Text className="text-[#737373] text-xs">Booked</Text>
            <Text className="text-[#DC2626] text-xl font-bold mt-1">
              {slots.filter((slot) => slot.is_booked).length}
            </Text>
          </View>
        </View>
        {ground && (
          <View className="bg-[#EFF6FF] rounded-2xl p-4 border border-[#BFDBFE] mb-5">
            <View className="flex-row items-center">
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#2563EB"
              />
              <Text className="text-[#1E3A8A] font-bold ml-2">
                Scheduling policy
              </Text>
            </View>
            <Text className="text-[#1E40AF] text-xs leading-5 mt-2">
              Hours: {ground.operating_hours.open}–
              {ground.operating_hours.close} · Maximum slot:{" "}
              {ground.scheduling_policy.max_slot_duration_minutes} minutes ·
              Create up to {ground.scheduling_policy.max_advance_booking_days}{" "}
              days ahead.
            </Text>
          </View>
        )}
        <View className="bg-white rounded-2xl p-4 border border-[#E5E5E5] mb-5">
          <Text className="text-lg font-bold text-[#1A1A2E] mb-3">
            {editingSlot ? "Edit slot" : "Add slot"}
          </Text>
          {(
            [
              ["date", "Date (YYYY-MM-DD)"],
              ["start_time", "Start time (HH:MM)"],
              ["end_time", "End time (HH:MM)"],
              ["price", "Price"],
            ] as const
          ).map(([key, label]) => (
            <View key={key} className="mb-3">
              <Text className="text-[#1A1A2E] mb-1">{label}</Text>
              <TextInput
                accessibilityLabel={label}
                editable={!saving}
                className={fieldClass}
                value={form[key]}
                onChangeText={(value) => setForm({ ...form, [key]: value })}
                keyboardType={key === "price" ? "numeric" : "default"}
              />
            </View>
          ))}
          <TouchableOpacity
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={editingSlot ? "Update slot" : "Add slot"}
            onPress={add}
            className={`rounded-xl py-3 items-center ${saving ? "bg-[#9CA3AF]" : "bg-[#4CAF50]"}`}
          >
            <Text className="text-white font-bold">
              {saving ? "Saving..." : editingSlot ? "Update Slot" : "Add Slot"}
            </Text>
          </TouchableOpacity>
          {editingSlot && (
            <TouchableOpacity
              disabled={saving}
              onPress={() => setEditingSlot(null)}
              className="py-3 items-center mt-1"
            >
              <Text className="text-[#737373] font-medium">Cancel editing</Text>
            </TouchableOpacity>
          )}
        </View>
        {!editingSlot && (
          <View className="bg-[#F0FDF4] rounded-2xl p-4 border border-[#BBF7D0] mb-5">
            <Text className="text-lg font-bold text-[#1A1A2E]">
              Repeat this slot
            </Text>
            <Text className="text-[#4B5563] text-xs mt-1">
              Create the same date/time/price on a repeating schedule.
            </Text>
            <View className="flex-row mt-3">
              <View className="flex-1 mr-2">
                <Text className="text-[#1A1A2E] text-xs mb-1">
                  Every (days)
                </Text>
                <TextInput
                  accessibilityLabel="Repeat every days"
                  editable={!saving}
                  value={repeatEveryDays}
                  onChangeText={setRepeatEveryDays}
                  keyboardType="numeric"
                  className={fieldClass}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[#1A1A2E] text-xs mb-1">Occurrences</Text>
                <TextInput
                  accessibilityLabel="Number of occurrences"
                  editable={!saving}
                  value={occurrences}
                  onChangeText={setOccurrences}
                  keyboardType="numeric"
                  className={fieldClass}
                />
              </View>
            </View>
            <TouchableOpacity
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Create recurring slots"
              onPress={addRecurring}
              className={`rounded-xl py-3 items-center mt-3 ${saving ? "bg-[#9CA3AF]" : "bg-[#1A1A2E]"}`}
            >
              <Text className="text-white font-bold">
                {saving ? "Saving..." : "Create Recurring Slots"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {!editingSlot && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/(vendor)/setup-schedule",
                params: { id, title },
              })
            }
            className="mb-5 rounded-xl border border-[#4CAF50] bg-white py-3 items-center"
          >
            <Text className="text-[#2E7D32] font-bold">
              Change repeating schedule
            </Text>
          </TouchableOpacity>
        )}
        <View className="mb-4">
          <Text className="text-lg font-bold text-[#1A1A2E] mb-2">
            Week calendar
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Array.from({ length: 7 }, (_, index) => {
              const date = new Date(`${pakistanDate()}T00:00:00Z`);
              date.setUTCDate(date.getUTCDate() + index);
              const value = date.toISOString().slice(0, 10);
              const count = slots.filter((slot) => slot.date === value).length;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setCalendarDate(value)}
                  className={`mr-2 w-16 rounded-xl py-3 items-center ${calendarDate === value ? "bg-[#4CAF50]" : "bg-white border border-[#E5E5E5]"}`}
                >
                  <Text
                    className={
                      calendarDate === value
                        ? "text-white text-xs font-bold"
                        : "text-[#4B5563] text-xs"
                    }
                  >
                    {index === 0
                      ? "Today"
                      : date.toLocaleDateString("en-PK", { weekday: "short" })}
                  </Text>
                  <Text
                    className={
                      calendarDate === value
                        ? "text-white font-bold mt-1"
                        : "text-[#1A1A2E] font-bold mt-1"
                    }
                  >
                    {date.getUTCDate()}
                  </Text>
                  <Text
                    className={
                      calendarDate === value
                        ? "text-white text-[10px] mt-1"
                        : "text-[#737373] text-[10px] mt-1"
                    }
                  >
                    {count} slots
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <Text className="text-lg font-bold text-[#1A1A2E] mb-3">
          Scheduled slots for {calendarDate}
        </Text>
        <TouchableOpacity
          onPress={() =>
            setSelectedSlotIds(
              slots
                .filter((slot) => !slot.is_booked && !slot.is_held)
                .map((slot) => slot.id),
            )
          }
          className="self-start mb-3 rounded-lg border border-[#4CAF50] px-3 py-2"
        >
          <Text className="text-[#2E7D32] font-semibold">
            Select all editable slots
          </Text>
        </TouchableOpacity>
        {selectedSlotIds.length > 0 && (
          <View className="bg-[#1A1A2E] rounded-xl p-3 mb-3">
            <Text className="text-white font-bold">
              {selectedSlotIds.length} selected
            </Text>
            <View className="flex-row mt-2">
              <TouchableOpacity
                disabled={saving}
                onPress={() => bulk("block")}
                className="bg-white rounded-lg px-3 py-2 mr-2"
              >
                <Text>Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={saving}
                onPress={() => bulk("unblock")}
                className="bg-white rounded-lg px-3 py-2 mr-2"
              >
                <Text>Unblock</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={saving}
                onPress={() => bulk("delete")}
                className="bg-[#DC2626] rounded-lg px-3 py-2"
              >
                <Text className="text-white">Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {slots.map((slot) => (
          <View
            key={slot.id}
            className="bg-white rounded-xl p-4 mb-3 border border-[#E5E5E5]"
          >
            <View className="flex-row justify-between">
              <View>
                <Text className="font-bold text-[#1A1A2E]">{slot.date}</Text>
                <Text className="text-[#737373] mt-1">
                  {slot.start_time} - {slot.end_time} · Rs {slot.price}
                </Text>
              </View>
              <Text
                className={`font-medium ${slot.is_booked ? "text-[#DC2626]" : slot.is_blocked ? "text-[#F59E0B]" : "text-[#4CAF50]"}`}
              >
                {slot.is_booked
                  ? "Booked"
                  : slot.is_blocked
                    ? "Blocked"
                    : "Available"}
              </Text>
            </View>
            {!slot.is_booked && (
              <View className="flex-row mt-3">
                <TouchableOpacity
                  onPress={() => beginEdit(slot)}
                  className="bg-[#E8F5E9] rounded-lg px-3 py-2 mr-2"
                >
                  <Text className="text-[#2E7D32]">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleBlocked(slot)}
                  className="bg-[#F5F5F5] rounded-lg px-3 py-2 mr-2"
                >
                  <Text>{slot.is_blocked ? "Unblock" : "Block"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPendingRemove(slot)}
                  className="bg-[#FEF2F2] rounded-lg px-3 py-2"
                >
                  <Text className="text-[#DC2626]">Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        {loading && slots.length === 0 && <ActivityIndicator color="#4CAF50" />}
        {!loading && slots.length === 0 && (
          <View className="items-center py-8">
            <Ionicons name="calendar-outline" size={40} color="#D4D4D4" />
            <Text className="text-[#737373] text-center mt-2">
              No slots created yet.
            </Text>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={Boolean(pendingRemove)}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingRemove(null)}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-8">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-xl font-bold text-[#1A1A2E]">
              Remove slot?
            </Text>
            <Text className="text-[#737373] mt-2">
              This slot will no longer be available to players.
            </Text>
            <View className="flex-row justify-end mt-6">
              <TouchableOpacity
                onPress={() => setPendingRemove(null)}
                className="px-4 py-3"
              >
                <Text className="text-[#737373] font-medium">Cancel</Text>
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
