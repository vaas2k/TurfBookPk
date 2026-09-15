import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Ground,
  listVendorGrounds,
  saveGroundSchedule,
} from "@/lib/api/vendors";
import { Ionicons } from "@expo/vector-icons";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";
import { TimePicker } from "@/components/ui/time-picker";

const field =
  "bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]";
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const minutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};
const clock = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

export default function SetupSchedule() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const [ground, setGround] = useState<Ground | null>(null);
  const [open, setOpen] = useState("14:00");
  const [close, setClose] = useState("23:00");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
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
          setPrice(String(value.price_per_hour));
        }
      })
      .catch(() => setToast("Unable to load this ground."));
  }, [id]);
  const choices = useMemo(() => {
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(open) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(close) ||
      minutes(open) >= minutes(close)
    )
      return [];
    const result: string[] = [];
    for (
      let value = minutes(open);
      value + duration <= minutes(close);
      value += duration
    )
      result.push(clock(value));
    return result;
  }, [open, close, duration]);
  useEffect(
    () =>
      setSelected((current) =>
        current.filter((time) => choices.includes(time)),
      ),
    [choices],
  );
  const save = async () => {
    if (!id) return;
    if (!choices.length)
      return setToast("Use valid working hours, for example 14:00 to 23:00.");
    if (!selected.length)
      return setToast("Tap the time slots you want players to book.");
    const amount = Number(price);
    if (!Number.isSafeInteger(amount) || amount <= 0)
      return setToast("Enter a valid whole-number price.");
    setSaving(true);
    try {
      await saveGroundSchedule(id, {
        open_time: open,
        close_time: close,
        slot_duration_minutes: duration,
        slot_starts: selected,
        days,
        price: amount,
      });
      router.replace({
        pathname: "/(vendor)/ground-slots",
        params: { id, title: title || ground?.title || "Ground" },
      });
    } catch (error: any) {
      setToast(error?.message || "Unable to save the schedule.");
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
        <View className="flex-row items-center py-5">
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(vendor)/grounds")}
            className="w-11 h-11 rounded-full bg-white border border-[#E5E5E5] items-center justify-center"
          >
            <Ionicons name="arrow-back" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <Text className="flex-1 text-center text-xl font-bold text-[#1A1A2E]">
            Set booking times
          </Text>
          <View className="w-11" />
        </View>
        <View className="bg-[#E8F5E9] rounded-2xl p-4 mb-5">
          <Text className="text-[#1A1A2E] text-lg font-bold">Set it once</Text>
          <Text className="text-[#356B38] mt-1 leading-5">
            Choose your hours and the slots you accept. They repeat every
            selected day and stay available for the upcoming booking window.
          </Text>
        </View>
        <Text className="font-bold text-[#1A1A2E] mb-2">1. Working hours</Text>
        <View className="flex-row mb-4">
          <View className="flex-1 mr-2"><TimePicker label="Opens" value={open} onChange={setOpen} maximum="22:30" /></View>
          <View className="flex-1"><TimePicker label="Closes" value={close} onChange={setClose} minimum="00:30" /></View>
        </View>
        <Text className="font-bold text-[#1A1A2E] mb-2">2. Slot length</Text>
        <View className="flex-row mb-5">
          {[60, 90, 120].map((value) => (
            <TouchableOpacity
              key={value}
              onPress={() => setDuration(value)}
              className={`flex-1 py-3 mr-2 rounded-xl items-center ${duration === value ? "bg-[#4CAF50]" : "bg-white border border-[#E5E5E5]"}`}
            >
              <Text
                className={
                  duration === value
                    ? "text-white font-bold"
                    : "text-[#1A1A2E] font-bold"
                }
              >
                {value / 60} hr{value > 60 ? "s" : ""}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="font-bold text-[#1A1A2E] mb-2">
          3. Choose booking slots
        </Text>
        <Text className="text-[#737373] text-sm mb-3">
          Tap every time you want to offer. You can block a specific day later.
        </Text>
        <View className="flex-row flex-wrap">
          {choices.map((time) => (
            <TouchableOpacity
              key={time}
              onPress={() =>
                setSelected((current) =>
                  current.includes(time)
                    ? current.filter((item) => item !== time)
                    : [...current, time],
                )
              }
              className={`w-[31%] mr-[2%] mb-3 rounded-xl py-4 items-center ${selected.includes(time) ? "bg-[#4CAF50]" : "bg-white border border-[#E5E5E5]"}`}
            >
              <Text
                className={
                  selected.includes(time)
                    ? "text-white font-bold"
                    : "text-[#1A1A2E] font-bold"
                }
              >
                {time}
              </Text>
              <Text
                className={
                  selected.includes(time)
                    ? "text-white text-xs mt-1"
                    : "text-[#737373] text-xs mt-1"
                }
              >
                to {clock(minutes(time) + duration)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() =>
            setSelected(selected.length === choices.length ? [] : choices)
          }
          className="self-start rounded-lg border border-[#4CAF50] px-4 py-3 mb-5"
        >
          <Text className="text-[#2E7D32] font-bold">
            {selected.length === choices.length
              ? "Clear all"
              : "Select all slots"}
          </Text>
        </TouchableOpacity>
        <Text className="font-bold text-[#1A1A2E] mb-2">4. Repeat on</Text>
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
              className={`mr-2 mb-2 rounded-full px-4 py-3 ${days.includes(index) ? "bg-[#4CAF50]" : "bg-white border border-[#E5E5E5]"}`}
            >
              <Text
                className={
                  days.includes(index)
                    ? "text-white font-bold"
                    : "text-[#1A1A2E]"
                }
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="font-bold text-[#1A1A2E] mb-1">
          Price for each slot
        </Text>
        <TextInput
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          className={`${field} mb-5`}
          placeholder="1200"
        />
        <TouchableOpacity
          disabled={saving}
          onPress={save}
          className={`rounded-xl py-4 items-center ${saving ? "bg-[#9CA3AF]" : "bg-[#4CAF50]"}`}
        >
          <Text className="text-white font-bold">
            {saving
              ? "Saving schedule..."
              : `Save ${selected.length} repeating slots`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
