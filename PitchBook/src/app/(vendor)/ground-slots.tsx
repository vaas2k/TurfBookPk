import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  createGroundBlackouts,
  deleteGroundBlackout,
  deleteGroundSlot,
  GroundBlackout,
  listGroundBlackouts,
  listGroundSlots,
  listGroundPitches,
  listVendorGrounds,
  Pitch,
  Slot,
  updateGroundSlot,
} from "@/lib/api/vendors";
import { Ionicons } from "@expo/vector-icons";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";
import { compareByOperatingDay, formatTimeRange12 } from "@/lib/time";

const pakistanDate = () =>
  new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** Plain-language daily manager. The older editor remains below temporarily for
 * compatibility, but is deliberately not rendered. */
export default function GroundSlots() {
  const { id, title, pitchId } = useLocalSearchParams<{ id: string; title?: string; pitchId?: string }>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [selectedPitchId, setSelectedPitchId] = useState(pitchId || '');
  const [openingTime, setOpeningTime] = useState('00:00');
  const [blackouts, setBlackouts] = useState<GroundBlackout[]>([]);
  const [date, setDate] = useState(pakistanDate());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => new Date(`${pakistanDate()}T12:00:00`));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Slot | null>(null);
  const [updatingSlotId, setUpdatingSlotId] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [currentSlots, currentBlackouts, currentPitches, currentGrounds] = await Promise.all([
        listGroundSlots(id),
        listGroundBlackouts(id),
        listGroundPitches(id),
        listVendorGrounds(),
      ]);
      setSlots(currentSlots);
      setBlackouts(currentBlackouts);
      setPitches(currentPitches.filter((pitch) => pitch.is_active !== false));
      setOpeningTime(currentGrounds.find((ground) => ground.id === id)?.operating_hours.open || '00:00');
      setSelectedPitchId((current) => current || pitchId || currentPitches[0]?.id || '');
    } catch (error: any) {
      const message = error?.message || "Unable to load slots.";
      setLoadError(message);
      setToast(message);
    } finally {
      setLoading(false);
    }
  }, [id, pitchId]);
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
  const updateSlot = async (slot: Slot, data: Partial<Slot>, message: string) => {
    if (!id || updatingSlotId) return;
    setUpdatingSlotId(slot.id);
    try {
      await updateGroundSlot(id, slot.id, data);
      await load();
      setToast(message);
    } catch (error: any) {
      setToast(error?.message || "Unable to update this slot.");
    } finally {
      setUpdatingSlotId(null);
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
  const selectDate = (selected: Date) => {
    const year = selected.getFullYear();
    const month = String(selected.getMonth() + 1).padStart(2, "0");
    const day = String(selected.getDate()).padStart(2, "0");
    setDate(`${year}-${month}-${day}`);
    setDraftDate(selected);
  };
  const changeDate = (days: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    selectDate(next);
  };
  const onAndroidDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setDatePickerOpen(false);
    if (event.type === "set" && selected) selectDate(selected);
  };
  // Legacy month-grid values are retained only until its hidden markup is
  // removed in the scheduled screen-cleanup pass.
  const calendarMonth = date.slice(0, 7);
  const monthStart = new Date(`${calendarMonth}-01T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const days = Array.from({ length: monthStart.getUTCDay() + daysInMonth }, (_, index) => {
    if (index < monthStart.getUTCDay()) return null;
    const number = index - monthStart.getUTCDay() + 1;
    return { key: `${calendarMonth}-${String(number).padStart(2, "0")}`, number };
  });
  const moveCalendarMonth = (direction: number) => {
    const next = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + direction, 1));
    setDate(`${next.toISOString().slice(0, 7)}-01`);
  };
  const todaySlots = slots
    .filter((slot) => slot.date === date && (!selectedPitchId || slot.pitch_id === selectedPitchId))
    .sort((a, b) => compareByOperatingDay(a.start_time, b.start_time, openingTime));
  const isBlackout = blackouts.some((item) => item.date === date);
  const available = todaySlots.filter(
    (slot) => !slot.is_booked && !slot.is_blocked && !slot.is_held,
  ).length;
  const statusFor = (slot: Slot) => {
    if (slot.is_booked) return { label: "Booked", color: "#F58A7C", background: "#3B2421" };
    if (slot.is_held) return { label: "Held", color: "#F5C76B", background: "#3A3120" };
    if (slot.is_club_reserved) return { label: "Club", color: "#CBB2FF", background: "#30263F" };
    if (slot.resource_unavailable) return { label: "Used by another pitch option", color: "#8FC5FF", background: "#1E3245" };
    if (slot.is_blocked) return { label: "Unavailable", color: "#B8BBB5", background: "#30352E" };
    return { label: "Available", color: "#75D67E", background: "#203B24" };
  };
  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      className="flex-1 bg-[#10120F]"
    >
      <StatusBar barStyle="light-content" />
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
        <Text className="text-[#AFAFA9] text-sm mb-2">Pitch calendar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">{pitches.map((pitch) => <TouchableOpacity key={pitch.id} onPress={() => setSelectedPitchId(pitch.id)} className={`rounded-xl border px-4 py-3 mr-2 ${selectedPitchId === pitch.id ? 'border-[#57CC63] bg-[#17301B]' : 'border-[#455A43] bg-[#1B1F19]'}`}><Text className="text-[#F5F5F0] font-bold">{pitch.name} · {pitch.side} a-side</Text></TouchableOpacity>)}</ScrollView>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(vendor)/ground-pitches', params: { id, title } })} className="rounded-xl border border-[#315536] px-4 py-3 mb-5"><Text className="text-[#75D67E] font-bold">Add or manage pitches</Text></TouchableOpacity>
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
              params: { id, title, pitchId: selectedPitchId },
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
        <View className="rounded-2xl border border-[#315536] bg-[#172319] p-4 mb-4">
          <View className="flex-row items-center">
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous date" onPress={() => changeDate(-1)} className="h-11 w-11 items-center justify-center rounded-xl bg-[#252F25]"><Ionicons name="chevron-back" size={20} color="#F5F5F0" /></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose a date" onPress={() => { setDraftDate(new Date(`${date}T12:00:00`)); setDatePickerOpen(true); }} className="mx-3 min-h-[52px] flex-1 flex-row items-center rounded-xl bg-[#243326] px-4"><View className="h-9 w-9 items-center justify-center rounded-lg bg-[#42B84F]"><Ionicons name="calendar-outline" size={19} color="#102110" /></View><View className="ml-3 flex-1"><Text className="text-[11px] font-bold uppercase tracking-wider text-[#8EB493]">Selected date</Text><Text className="mt-0.5 font-bold text-[#F5F5F0]">{new Date(`${date}T12:00:00`).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</Text></View><Ionicons name="chevron-down" size={17} color="#AFAFA9" /></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next date" onPress={() => changeDate(1)} className="h-11 w-11 items-center justify-center rounded-xl bg-[#252F25]"><Ionicons name="chevron-forward" size={20} color="#F5F5F0" /></TouchableOpacity>
          </View>
          <View className="mt-3 flex-row items-center justify-between"><Text className="text-xs text-[#A8C9AC]">Tap the date to choose any day</Text>{date !== pakistanDate() ? <TouchableOpacity accessibilityRole="button" onPress={() => selectDate(new Date(`${pakistanDate()}T12:00:00`))} className="min-h-[36px] justify-center rounded-lg border border-[#47784C] px-3"><Text className="text-xs font-bold text-[#75D67E]">Go to today</Text></TouchableOpacity> : <View className="rounded-full bg-[#2C5932] px-3 py-1.5"><Text className="text-[11px] font-bold text-[#8EE298]">TODAY</Text></View>}</View>
        </View>
        <View className="hidden">
          <Text className="text-[#1A1A2E] font-bold mb-3">
            Calendar — next 31 days
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
                (slot) => slot.date === item.key && (!selectedPitchId || slot.pitch_id === selectedPitchId),
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
        <View className="mb-4">
          <View className="mb-3 flex-row items-center justify-between"><View><Text className="text-lg font-bold text-[#F5F5F0]">Active slots</Text><Text className="mt-0.5 text-xs text-[#92978F]">{todaySlots.length} slot{todaySlots.length === 1 ? "" : "s"} · {available} available</Text></View>{isBlackout ? <View className="rounded-full bg-[#3B2421] px-3 py-2"><Text className="text-xs font-bold text-[#F58A7C]">GROUND CLOSED</Text></View> : null}</View>
          {loading ? <ActivityIndicator className="py-8" color="#57CC63" /> : todaySlots.length === 0 ? <View className="items-center rounded-2xl border border-[#30372B] bg-[#1B1F19] px-5 py-7"><Ionicons name="calendar-outline" size={32} color="#71786D" /><Text className="mt-3 font-bold text-[#F5F5F0]">No active slots on this date</Text><Text className="mt-1 text-center text-sm text-[#92978F]">Choose another date or change the regular booking times.</Text></View> : todaySlots.map((slot) => {
            const status = statusFor(slot);
            const editable = !slot.is_booked && !slot.is_held && !slot.resource_unavailable;
            const busy = updatingSlotId === slot.id;
            return <View key={slot.id} className="mb-3 rounded-2xl border border-[#30372B] bg-[#1B1F19] p-4">
              <View className="flex-row items-center"><View className="h-11 w-11 items-center justify-center rounded-xl bg-[#252F25]"><Ionicons name="time-outline" size={21} color="#75D67E" /></View><View className="ml-3 flex-1"><Text className="text-base font-bold text-[#F5F5F0]">{formatTimeRange12(slot.start_time, slot.end_time)}</Text><Text className="mt-1 text-xs text-[#92978F]">PKR {slot.price.toLocaleString()}{slot.is_peak ? " · Peak price" : ""}</Text></View><View style={{ backgroundColor: status.background }} className="rounded-full px-3 py-2"><Text style={{ color: status.color }} className="text-[11px] font-bold uppercase">{status.label}</Text></View></View>
              {editable ? <View className="mt-4 flex-row border-t border-[#30372B] pt-3">
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void updateSlot(slot, { is_blocked: !slot.is_blocked, is_club_reserved: false }, slot.is_blocked ? "Slot is available again." : "Slot blocked.")} className="mr-2 min-h-[42px] flex-1 items-center justify-center rounded-xl border border-[#F4B844]"><Text className="text-xs font-bold text-[#F4B844]">{slot.is_blocked ? "Unblock" : "Block"}</Text></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void updateSlot(slot, { is_club_reserved: !slot.is_club_reserved, is_blocked: false, reservation_note: slot.is_club_reserved ? null : "Reserved by venue" }, slot.is_club_reserved ? "Club reservation released." : "Reserved for your club.")} className="mr-2 min-h-[42px] flex-1 items-center justify-center rounded-xl border border-[#B794F6]"><Text className="text-xs font-bold text-[#CBB2FF]">{slot.is_club_reserved ? "Release" : "Reserve"}</Text></TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => setRemoving(slot)} className="min-h-[42px] flex-1 items-center justify-center rounded-xl border border-[#F58A7C]"><Text className="text-xs font-bold text-[#F58A7C]">Remove</Text></TouchableOpacity>
              </View> : <Text className="mt-3 border-t border-[#30372B] pt-3 text-xs text-[#92978F]">This slot is protected because a player has booked or is paying for it.</Text>}
              {busy ? <ActivityIndicator className="absolute bottom-1 right-1" size="small" color="#57CC63" /> : null}
            </View>;
          })}
        </View>
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
      </ScrollView>
      {Platform.OS === "android" && datePickerOpen ? <DateTimePicker value={draftDate} mode="date" display="calendar" onChange={onAndroidDateChange} /> : null}
      <Modal visible={Platform.OS === "ios" && datePickerOpen} transparent animationType="slide" onRequestClose={() => setDatePickerOpen(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="rounded-t-3xl border-t border-[#30372B] bg-[#1B1F19] px-5 pb-9 pt-4">
            <View className="h-1 w-11 self-center rounded-full bg-[#60665E]" />
            <View className="mt-4 flex-row items-center justify-between"><TouchableOpacity accessibilityRole="button" onPress={() => setDatePickerOpen(false)} className="min-h-[44px] justify-center px-2"><Text className="font-bold text-[#AFAFA9]">Cancel</Text></TouchableOpacity><Text className="text-lg font-bold text-[#F5F5F0]">Choose a date</Text><TouchableOpacity accessibilityRole="button" onPress={() => { selectDate(draftDate); setDatePickerOpen(false); }} className="min-h-[44px] justify-center px-2"><Text className="font-bold text-[#75D67E]">Done</Text></TouchableOpacity></View>
            <DateTimePicker value={draftDate} mode="date" display="spinner" themeVariant="dark" textColor="#F5F5F0" onChange={(_, selected) => selected && setDraftDate(selected)} style={{ height: 210 }} />
          </View>
        </View>
      </Modal>
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
