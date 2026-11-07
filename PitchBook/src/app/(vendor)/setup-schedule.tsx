import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Ground,
  Pitch,
  listGroundPitches,
  listVendorGrounds,
  previewGroundSchedule,
  saveGroundSchedule,
} from "@/lib/api/vendors";
import { Ionicons } from "@expo/vector-icons";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";
import { TimePicker } from "@/components/ui/time-picker";
import { appDialog } from "@/components/ui/app-dialog";
import { formatTime12 } from "@/lib/time";

const field =
  "bg-[#1B1F19] border border-[#30372B] rounded-xl px-4 py-3 text-[#F5F5F0]";
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const clock = (total: number) =>
  `${String(Math.floor((total % 1440) / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

export default function SetupSchedule() {
  const { id, title, pitchId } = useLocalSearchParams<{ id: string; title?: string; pitchId?: string }>();
  const [ground, setGround] = useState<Ground | null>(null);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [selectedPitchId, setSelectedPitchId] = useState(pitchId || '');
  const [open, setOpen] = useState("14:00");
  const [close, setClose] = useState("23:00");
  const [closeNextDay, setCloseNextDay] = useState(false);
  const [duration, setDuration] = useState(60);
  const [turnaround, setTurnaround] = useState<5 | 10 | 15>(10);
  const [price, setPrice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    listVendorGrounds()
      .then((all) => {
        const value = all.find((item) => item.id === id) || null;
        setGround(value);
        if (value) {
          setOpen(value.operating_hours.open);
          setClose(value.operating_hours.close);
          setCloseNextDay(value.operating_hours.close_next_day ?? value.operating_hours.close <= value.operating_hours.open);
          setPrice(String(value.price_per_hour));
          setTurnaround(value.turnaround_minutes === 5 || value.turnaround_minutes === 15 ? value.turnaround_minutes : 10);
        }
      })
      .catch(() => setToast("Unable to load this ground."));
    listGroundPitches(id).then((items) => { const active = items.filter((item) => item.is_active !== false); setPitches(active); setSelectedPitchId(pitchId || (active.length === 1 ? active[0]!.id : '')); }).catch(() => setToast('Unable to load pitches.'));
  }, [id, pitchId]);
  const choices = useMemo(() => {
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(open) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(close) ||
      (!closeNextDay && minutes(close) <= minutes(open))
    )
      return [];
    const opening = minutes(open);
    const closing = minutes(close) + (closeNextDay ? 1440 : 0);
    const starts: number[] = [];
    for (
      let value = opening;
      value + duration <= closing;
      value += duration + turnaround
    )
      starts.push(value);
    const closingAlignedStart = closing - duration;
    if (starts.length && starts.at(-1)! + duration < closing && closingAlignedStart >= opening) {
      while (starts.length && starts.at(-1)! + duration + turnaround > closingAlignedStart) starts.pop();
      if (!starts.includes(closingAlignedStart)) starts.push(closingAlignedStart);
    }
    return starts.map((value) => ({ key: `${Math.floor(value / 1440)}:${clock(value)}`, time: clock(value), dayOffset: Math.floor(value / 1440) as 0 | 1, absolute: value }));
  }, [open, close, closeNextDay, duration, turnaround]);
  useEffect(() => setSelected((current) => current.length ? current.filter((key) => choices.some((choice) => choice.key === key)) : choices.map((choice) => choice.key)), [choices]);
  const save = async () => {
    if (!id) return;
    if (!selectedPitchId) return setToast('Choose a pitch first.');
    if (!choices.length)
      return setToast("Use valid working hours, for example 14:00 to 23:00.");
    if (!selected.length)
      return setToast("Tap the time slots you want players to book.");
    const amount = Number(price);
    if (!Number.isSafeInteger(amount) || amount <= 0)
      return setToast("Enter a valid whole-number price.");
    setSaving(true);
    try {
      const payload = {
        pitch_id: selectedPitchId,
        open_time: open,
        close_time: close,
        close_next_day: closeNextDay,
        extend_ground_hours: true,
        slot_duration_minutes: duration,
        turnaround_minutes: turnaround,
        slot_starts: choices.filter((choice) => selected.includes(choice.key)).map((choice) => ({ time: choice.time, day_offset: choice.dayOffset })),
        days,
        price: amount,
      } as const;
      const preview = await previewGroundSchedule(id, { ...payload, slot_starts: [...payload.slot_starts], days: [...days] });
      appDialog.alert("Review booking times", `${selected.length} times repeat on ${days.length} days each week. Teams play for ${duration} minutes, followed by a ${turnaround}-minute changeover.\n\n${preview.replaceable_slots} unbooked generated slots will be replaced. ${preview.protected_slots} existing slots and bookings keep their times.`, [
        { text: "Go back", style: "cancel" },
        { text: "Save schedule", onPress: async () => {
          setSaving(true);
          try {
            await saveGroundSchedule(id, { ...payload, slot_starts: [...payload.slot_starts], days: [...days] });
            router.replace({ pathname: "/(vendor)/ground-slots", params: { id, title: title || ground?.title || "Ground", pitchId: selectedPitchId } });
          } catch (error: any) {
            setToast(error?.message || "Unable to save the schedule.");
          } finally {
            setSaving(false);
          }
        } },
      ]);
    } catch (error: any) {
      setToast(error?.message || "Unable to save the schedule.");
    } finally {
      setSaving(false);
    }
  };
  const continueStep = () => {
    if (step === 1 && (!choices.length || !selectedPitchId)) return setToast("Choose a pitch and valid working hours.");
    if (step === 2 && !selected.length) return setToast("Select at least one booking time for players.");
    setStep((current) => Math.min(3, current + 1));
  };
  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center pt-5 pb-4">
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(vendor)/grounds")}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <Ionicons name="chevron-back" size={28} color="#F5F5F0" />
          </TouchableOpacity>
          <Text style={{ fontFamily: "SpaceGrotesk_700Bold" }} className="flex-1 text-[20px] text-[#F5F5F0] ml-2">
            SET BOOKING TIMES
          </Text>
        </View>
        <View className="bg-[#1B251B] border border-[#315536] rounded-2xl p-5 mb-6">
          <Text className="text-[#F5F5F0] text-lg font-bold">Set it once</Text>
          <Text className="text-[#A8C9AC] mt-1 leading-5">
            Choose your hours and the slots you accept. They repeat every
            selected day and stay available for the upcoming booking window.
          </Text>
        </View>
        <View className="flex-row items-center mb-6"><Text className="text-[#57CC63] text-xs font-bold">STEP {step} OF 3</Text><View className="flex-1 h-1 bg-[#30372B] rounded-full mx-3 overflow-hidden"><View style={{ width: `${(step / 3) * 100}%` }} className="h-full bg-[#42B84F]" /></View><Text className="text-[#92978F] text-xs">{step === 1 ? 'Hours' : step === 2 ? 'Slots' : 'Repeat'}</Text></View>
        {step === 1 && <>
        <Text className="text-[#AFAFA9] text-base mb-2">Pitch</Text>
        <View className="flex-row flex-wrap mb-5">{pitches.map((pitch) => <TouchableOpacity key={pitch.id} accessibilityRole="radio" accessibilityState={{ selected: selectedPitchId === pitch.id }} onPress={() => { setSelectedPitchId(pitch.id); setSelected([]); }} className={`rounded-xl border px-4 py-3 mr-2 mb-2 ${selectedPitchId === pitch.id ? 'border-[#57CC63] bg-[#17301B]' : 'border-[#455A43] bg-[#1B1F19]'}`}><Text className="text-[#F5F5F0] font-bold">{pitch.name} · {pitch.side} a-side</Text></TouchableOpacity>)}</View>
        <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17 }} className="text-[#AFAFA9] mb-2">1. WORKING HOURS</Text>
        <View className="flex-row mb-4">
          <View className="flex-1 mr-2"><TimePicker dark label="Opens" value={open} onChange={setOpen} /></View>
          <View className="flex-1"><TimePicker dark label="Closes" value={close} onChange={setClose} /></View>
        </View>
        <Text className="text-[#D5D8D1] font-semibold mb-2">Closing day</Text>
        <View className="flex-row mb-3">{[{ value: false, label: 'Same day' }, { value: true, label: 'Next day' }].map((option) => <TouchableOpacity key={option.label} accessibilityRole="radio" accessibilityState={{ selected: closeNextDay === option.value }} onPress={() => setCloseNextDay(option.value)} className={`flex-1 min-h-[48px] rounded-xl border items-center justify-center mr-2 ${closeNextDay === option.value ? 'border-[#57CC63] bg-[#17301B]' : 'border-[#454B42]'}`}><Text className={closeNextDay === option.value ? 'text-[#75D67E] font-bold' : 'text-[#D5D8D1]'}>{option.label}</Text></TouchableOpacity>)}</View>
        {closeNextDay && <Text className="text-[#75D67E] text-sm mb-2">Slots continue after midnight and appear on the next calendar date.</Text>}
        <Text className="text-[#92978F] text-xs leading-5 mb-4">If this pitch closes later than the venue's saved hours, saving the reviewed schedule will extend the venue closing time.</Text>
        <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17 }} className="text-[#AFAFA9] mb-2">2. SLOT LENGTH</Text>
        <View className="flex-row mb-5">
          {[60, 90, 120].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setDuration(value)}
              className={`flex-1 py-3 mr-2 rounded-xl items-center ${duration === value ? "bg-[#42B84F]" : "bg-[#1B1F19] border border-[#30372B]"}`}
            >
              <Text
                className={
                  duration === value
                    ? "text-[#102110] font-bold"
                    : "text-[#F5F5F0] font-bold"
                }
              >
                {value / 60} hr{value > 60 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17 }} className="text-[#AFAFA9] mb-2">TIME BETWEEN TEAMS</Text>
        <View className="flex-row mb-3">{([5, 10, 15] as const).map((value) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: turnaround === value }} onPress={() => setTurnaround(value)} className={`flex-1 py-3 mr-2 rounded-xl items-center ${turnaround === value ? "bg-[#42B84F]" : "bg-[#1B1F19] border border-[#30372B]"}`}><Text className={turnaround === value ? "text-[#102110] font-bold" : "text-[#F5F5F0] font-bold"}>{value} min</Text></TouchableOpacity>)}</View>
        <Text className="text-[#92978F] text-xs leading-5 mb-5">Teams get their full playing time. This gap lets one team leave the pitch before the next starts.</Text>
        <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4"><View className="flex-row"><Ionicons name="information-circle-outline" size={22} color="#57CC63" /><View className="flex-1 ml-3"><Text className="text-[#F5F5F0] font-bold">We build the choices for you</Text><Text className="text-[#92978F] text-xs leading-5 mt-1">Based on your hours, playing time, and gap, we generate booking choices in the next step.</Text></View></View></View>
        </>}
        {step === 2 && <>
        <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17 }} className="text-[#AFAFA9] mb-2">
          3. CHOOSE BOOKING SLOTS
        </Text>
        <Text className="text-[#92978F] text-sm mb-3">
          Tap every time you want to offer. The final slot is aligned with closing time when the regular sequence does not fit exactly.
        </Text>
        <View className="flex-row flex-wrap">
          {choices.map((choice) => (
            <TouchableOpacity
              key={choice.key}
              onPress={() =>
                setSelected((current) =>
                  current.includes(choice.key)
                    ? current.filter((item) => item !== choice.key)
                    : [...current, choice.key],
                )
              }
              className={`w-[31%] mr-[2%] mb-3 rounded-xl py-4 items-center ${selected.includes(choice.key) ? "bg-[#42B84F]" : "bg-[#1B1F19] border border-[#30372B]"}`}
            >
              <Text
                className={
                  selected.includes(choice.key)
                    ? "text-[#102110] font-bold"
                    : "text-[#F5F5F0] font-bold"
                }
              >
                {formatTime12(choice.time)}
              </Text>
              <Text
                className={
                  selected.includes(choice.key)
                    ? "text-[#102110] text-xs mt-1"
                    : "text-[#92978F] text-xs mt-1"
                }
              >
                to {formatTime12(clock(choice.absolute + duration))}
              </Text>
              {choice.dayOffset === 1 && <Text className={selected.includes(choice.key) ? "text-[#102110] text-[10px] mt-1 font-bold" : "text-[#75D67E] text-[10px] mt-1 font-bold"}>NEXT DAY</Text>}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() =>
            setSelected(selected.length === choices.length ? [] : choices.map((choice) => choice.key))
          }
          className="self-start rounded-lg border border-[#42B84F] px-4 py-3 mb-5"
        >
          <Text className="text-[#57CC63] font-bold">
            {selected.length === choices.length
              ? "Clear all"
              : "Select all slots"}
          </Text>
        </TouchableOpacity>
        </>}
        {step === 3 && <>
        <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17 }} className="text-[#AFAFA9] mb-2">4. REPEAT ON</Text>
        <View className="flex-row flex-wrap mb-5">
          {dayLabels.map((label, index) => (
            <TouchableOpacity
              key={label}
              onPress={() =>
                setDays((current) =>
                  current.includes(index)
                    ? current.filter((item) => item !== index)
                    : [...current, index],
                )
              }
              className={`mr-2 mb-2 rounded-full px-4 py-3 ${days.includes(index) ? "bg-[#42B84F]" : "bg-[#1B1F19] border border-[#30372B]"}`}
            >
              <Text
                className={
                  days.includes(index)
                    ? "text-[#102110] font-bold"
                    : "text-[#F5F5F0]"
                }
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17 }} className="text-[#AFAFA9] mb-1">
          Price for each slot
        </Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          className={`${field} mb-5`}
          placeholder="1200"
          placeholderTextColor="#777D74"
        />
        <View className="bg-[#1B251B] border border-[#315536] rounded-2xl p-4 mb-5"><Text className="text-[#F5F5F0] font-bold">Your schedule will repeat</Text><Text className="text-[#A8C9AC] text-xs leading-5 mt-1">{selected.length} selected times will repeat on {days.length === 7 ? 'every day' : `${days.length} day${days.length === 1 ? '' : 's'} each week`}, with {turnaround} minutes between teams. Existing bookings keep their times. You can still block or reserve any day later.</Text></View>
        </>}
        <View className="flex-row mt-2"><TouchableOpacity accessibilityRole="button" onPress={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} className={`min-h-[52px] px-5 rounded-xl items-center justify-center mr-3 ${step === 1 ? 'opacity-0' : 'border border-[#30372B]'}`}><Text className="text-[#D5D8D1] font-bold">Back</Text></TouchableOpacity>{step < 3 ? <TouchableOpacity accessibilityRole="button" onPress={continueStep} className="flex-1 min-h-[52px] bg-[#42B84F] rounded-xl items-center justify-center"><Text className="text-[#102110] font-bold">Continue</Text></TouchableOpacity> : <TouchableOpacity
          disabled={saving}
          onPress={save}
          className={`flex-1 rounded-xl py-4 items-center ${saving ? "bg-[#596055]" : "bg-[#42B84F]"}`}
        >
          <Text className="text-[#102110] font-bold">
            {saving
              ? "Saving schedule..."
              : `Review ${selected.length} repeating slots`}
          </Text>
        </TouchableOpacity>}</View>
      </ScrollView>
      </KeyboardAvoidingView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
