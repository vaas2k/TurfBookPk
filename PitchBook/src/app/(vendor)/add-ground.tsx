import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import {
  Image,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  CancellationPolicy,
  CANCELLATION_POLICY_LABELS,
  createGround,
  Ground,
  listVendorGrounds,
  updateGround,
} from "@/lib/api/vendors";
import { Ionicons } from "@expo/vector-icons";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";
import { TimePicker } from "@/components/ui/time-picker";
import { deleteOwnedImageUrl, uploadImage } from "@/lib/api/media";

const MOCK_GROUND_IMAGE =
  "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200";
const fieldClass =
  "bg-[#1B1F19] border border-[#30372B] rounded-xl px-4 py-3 text-[#F5F5F0]";
type FormState = {
  title: string;
  description: string;
  location: string;
  city: string;
  address: string;
  price_per_hour: string;
  peak_percentage: string;
  peak_days: number[];
  peak_start_time: string;
  peak_end_time: string;
  pitch_type: string;
  cover_image: string;
  images: string[];
  amenities: string[];
  rules: string[];
  coordinates: string;
  cancellation_policy: CancellationPolicy;
  operating_open: string;
  operating_close: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  location: "",
  city: "",
  address: "",
  price_per_hour: "",
  peak_percentage: "",
  peak_days: [],
  peak_start_time: "18:00",
  peak_end_time: "22:00",
  pitch_type: "",
  cover_image: "",
  images: [],
  amenities: [],
  rules: [],
  coordinates: "",
  cancellation_policy: "standard",
  operating_open: "06:00",
  operating_close: "23:00",
};
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pitchOptions = ["5-a-side", "6-a-side", "7-a-side", "8-a-side", "9-a-side", "11-a-side"];
const amenityOptions = [
  "Floodlights",
  "Parking",
  "Changing rooms",
  "Washrooms",
  "Drinking water",
  "Seating",
  "Spectator area",
  "Cafeteria",
  "First aid",
  "Prayer area",
  "Wi-Fi",
  "Football rental",
  "Shower",
  "Locker room",
  "Security",
  "Scoreboard",
];
const MAX_AMENITIES = 12;
const DRAFT_KEY_PREFIX = "turfbookpk:ground-form-draft:";
type GroundDraft = { form: FormState; step: number; savedAt: string };

function parseCoordinates(
  value: string,
): { latitude: number; longitude: number } | null {
  if (!value.trim()) return null;
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
    ? { latitude, longitude }
    : null;
}

export default function AddGround() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [existing, setExisting] = useState<Ground | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newAmenity, setNewAmenity] = useState("");
  const [newRule, setNewRule] = useState("");
  const [showCustomPitch, setShowCustomPitch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [completedGround, setCompletedGround] = useState<Ground | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const formRef = useRef(form);
  const stepRef = useRef(step);
  const draftRestoredRef = useRef(false);
  const draftKey = `${DRAFT_KEY_PREFIX}${id || "new"}`;

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  const persistDraft = useCallback(async () => {
    if (!draftReady || completedGround) return;
    const current = formRef.current;
    const hasContent = Object.entries(current).some(([key, value]) => {
      if (key === "cancellation_policy" || key === "operating_open" || key === "operating_close" || key === "peak_start_time" || key === "peak_end_time") return false;
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    });
    if (!hasContent) return;
    await AsyncStorage.setItem(draftKey, JSON.stringify({ form: current, step: Math.min(3, Math.max(1, stepRef.current)), savedAt: new Date().toISOString() } satisfies GroundDraft));
  }, [completedGround, draftKey, draftReady]);

  const clearDraft = useCallback(() => AsyncStorage.removeItem(draftKey), [draftKey]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(draftKey)
      .then((raw) => {
        if (!raw || !active) return;
        const draft = JSON.parse(raw) as Partial<GroundDraft>;
        if (!draft.form || typeof draft.form !== "object") return;
        setForm({ ...emptyForm, ...draft.form });
        setStep(Math.min(3, Math.max(1, Number(draft.step) || 1)));
        draftRestoredRef.current = true;
        setDraftRestored(true);
        setToast("Your saved draft has been restored.");
      })
      .catch(() => undefined)
      .finally(() => active && setDraftReady(true));
    return () => { active = false; };
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const timeout = setTimeout(() => { void persistDraft(); }, 350);
    return () => clearTimeout(timeout);
  }, [draftReady, form, persistDraft, step]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "inactive" || nextState === "background") void persistDraft();
    });
    return () => subscription.remove();
  }, [persistDraft]);

  useEffect(() => {
    if (!id) return;
    listVendorGrounds()
      .then((items) => {
        const ground = items.find((item) => item.id === id);
        if (!ground) return;
        setExisting(ground);
        const peak = ground.peak_windows[0];
        if (draftRestoredRef.current) return;
        setForm({
          title: ground.title,
          description: ground.description || "",
          location: ground.location,
          city: ground.city,
          address: ground.address,
          price_per_hour: String(ground.price_per_hour),
          peak_percentage: ground.peak_percentage
            ? String(ground.peak_percentage)
            : "",
          peak_days: peak?.days || [],
          peak_start_time: peak?.start_time || "18:00",
          peak_end_time: peak?.end_time || "22:00",
          pitch_type: ground.pitch_type || "",
          cover_image: ground.cover_image || "",
          images: ground.images,
          amenities: ground.amenities,
          rules: ground.rules,
          coordinates:
            ground.latitude !== null && ground.longitude !== null
              ? `${ground.latitude}, ${ground.longitude}`
              : "",
          cancellation_policy: ground.cancellation_policy || "standard",
          operating_open: ground.operating_hours.open,
          operating_close: ground.operating_hours.close,
        });
      })
      .catch(() =>
        setToast("Unable to load ground details. Please try again."),
      );
  }, [draftRestored, id]);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const addTag = (
    key: "amenities" | "rules",
    value: string,
    clear: (value: string) => void,
  ) => {
    const clean = value.trim();
    if (!clean || form[key].includes(clean)) return;
    if (key === "amenities" && form.amenities.length >= MAX_AMENITIES) {
      setToast(`Choose up to ${MAX_AMENITIES} amenities.`);
      return;
    }
    setForm((current) => ({ ...current, [key]: [...current[key], clean] }));
    clear("");
  };
  const toggleAmenity = (amenity: string) => {
    if (!form.amenities.includes(amenity) && form.amenities.length >= MAX_AMENITIES) {
      setToast(`Choose up to ${MAX_AMENITIES} amenities.`);
      return;
    }
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  };
  const removeTag = (key: "amenities" | "rules", value: string) =>
    setForm((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value),
    }));

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return setToast("Allow photo access to choose a cover image.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) { setSaving(true); try { const uploaded = await uploadImage(result.assets[0], 'ground'); await deleteOwnedImageUrl(form.cover_image).catch(() => undefined); update('cover_image', uploaded.url); } catch (error: any) { setToast(error?.message || 'Unable to upload cover image.'); } finally { setSaving(false); } }
  };

  const addImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return setToast("Allow photo access to add ground images.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) { setSaving(true); try { const uploaded = await Promise.all(result.assets.map((asset) => uploadImage(asset, 'ground'))); setForm((current) => ({ ...current, images: [...current.images, ...uploaded.map((item) => item.url)] })); } catch (error: any) { setToast(error?.message || 'Unable to upload ground images.'); } finally { setSaving(false); } }
  };
  const removeGroundImage = async (uri: string) => { setForm((current) => ({ ...current, images: current.images.filter((item) => item !== uri) })); await deleteOwnedImageUrl(uri).catch(() => setToast('Image removed from the ground, but cloud cleanup will be retried later.')); };

  const save = async () => {
    if (
      !form.title.trim() ||
      !form.location.trim() ||
      !form.city.trim() ||
      !form.address.trim() ||
      !form.price_per_hour
    )
      return setToast(
        "Title, location, city, address, and hourly price are required.",
      );
    const coordinates = parseCoordinates(form.coordinates);
    if (form.coordinates.trim() && !coordinates)
      return setToast(
        "Coordinates must use latitude, longitude — for example 33.641757, 72.996779.",
      );
    const latitude = coordinates?.latitude ?? null;
    const longitude = coordinates?.longitude ?? null;
    if (
      !Number.isInteger(Number(form.price_per_hour)) ||
      Number(form.price_per_hour) <= 0
    )
      return setToast("Price per hour must be a positive whole number.");
    if (
      form.peak_percentage &&
      (!Number.isInteger(Number(form.peak_percentage)) ||
        Number(form.peak_percentage) < 1 ||
        Number(form.peak_percentage) > 500)
    )
      return setToast(
        "Peak increase must be a whole number between 1% and 500%.",
      );
    if (
      form.peak_percentage &&
      (!form.peak_days.length ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.peak_start_time) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.peak_end_time) ||
        form.peak_start_time >= form.peak_end_time)
    )
      return setToast("Choose peak days and valid peak start/end times.");
    if (form.operating_open >= form.operating_close) return setToast('Closing time must be later than opening time.');
    setSaving(true);
    const images = form.images.length ? form.images : [MOCK_GROUND_IMAGE];
    const data = {
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      price_per_hour: Number(form.price_per_hour),
      peak_percentage: form.peak_percentage
        ? Number(form.peak_percentage)
        : null,
      peak_windows: form.peak_percentage
        ? [
            {
              days: form.peak_days,
              start_time: form.peak_start_time,
              end_time: form.peak_end_time,
            },
          ]
        : [],
      pitch_type: form.pitch_type.trim(),
      cover_image: form.cover_image || images[0],
      images,
      amenities: form.amenities,
      rules: form.rules,
      latitude,
      longitude,
      cancellation_policy: form.cancellation_policy,
      operating_hours: { open: form.operating_open, close: form.operating_close },
    };
    try {
      if (existing) {
        setCompletedGround(await updateGround(existing.id, data));
      } else {
        const created = await createGround(data);
        setCompletedGround(created);
      }
      await clearDraft();
      setStep(4);
    } catch (error: any) {
      setToast(error?.message || "Unable to save ground. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const continueStep = () => {
    if (step === 1) {
      if (!form.title.trim() || !form.location.trim() || !form.city.trim() || !form.address.trim() || !form.price_per_hour) return setToast("Add the ground name, location, address, and hourly price before continuing.");
      if (!Number.isInteger(Number(form.price_per_hour)) || Number(form.price_per_hour) <= 0) return setToast("Price per hour must be a positive whole number.");
      if (form.operating_open >= form.operating_close) return setToast("Closing time must be later than opening time.");
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const renderTags = (key: "amenities" | "rules") => (
    <View className="flex-row flex-wrap mt-2">
      {form[key].map((item) => (
        <View
          key={item}
          className="flex-row items-center bg-[#17301B] border border-[#42B84F] rounded-full px-3 py-2 mr-2 mb-2"
        >
          <Text className="text-[#57CC63] mr-2">{item}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item}`}
            className="h-8 w-8 items-center justify-center"
            onPress={() => removeTag(key, item)}
          >
          <Ionicons name="close-circle" size={16} color="#57CC63" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
  const tagInput = (
    key: "amenities" | "rules",
    value: string,
    setValue: (value: string) => void,
    placeholder: string,
  ) => (
    <View className="flex-row items-center">
      <TextInput
        accessibilityLabel={placeholder}
        className={`${fieldClass} flex-1`}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor="#777D74"
        onSubmitEditing={() => addTag(key, value, setValue)}
        returnKeyType="done"
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Add ${key === "amenities" ? "amenity" : "rule"}`}
        className="bg-[#42B84F] rounded-xl h-12 w-12 ml-2 items-center justify-center"
        onPress={() => addTag(key, value, setValue)}
      >
        <Ionicons name="add" size={22} color="#102110" />
      </TouchableOpacity>
    </View>
  );

  if (step === 4 && completedGround) {
    return <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />
      <View className="flex-1 px-6 items-center justify-center"><View className="h-20 w-20 rounded-full bg-[#17301B] border border-[#42B84F] items-center justify-center"><Ionicons name="checkmark" size={42} color="#57CC63" /></View><Text style={{ fontFamily: "BigShouldersDisplay_800ExtraBold", fontSize: 29 }} className="text-[#F5F5F0] mt-7 text-center">GROUND SUBMITTED</Text><Text className="text-[#AFAFA9] text-center text-[15px] leading-6 mt-3">{completedGround.title} is ready for approval. Admin review will be added later; for this MVP your ground has been approved automatically.</Text><View className="bg-[#1B251B] border border-[#315536] rounded-2xl p-4 w-full mt-6"><Text className="text-[#57CC63] font-bold">Approved automatically</Text><Text className="text-[#A8C9AC] text-sm mt-1">Set your repeating booking times next so players can book the ground.</Text></View><TouchableOpacity accessibilityRole="button" onPress={() => router.replace({ pathname: "/(vendor)/setup-schedule", params: { id: completedGround.id, title: completedGround.title } })} className="w-full bg-[#42B84F] rounded-full py-4 items-center mt-6"><Text className="text-[#102110] font-bold">Set booking times</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => router.replace("/(vendor)/grounds")} className="py-4 mt-2"><Text className="text-[#D5D8D1] font-semibold">Back to My Grounds</Text></TouchableOpacity></View><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center pt-5 pb-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-10 w-10 items-center justify-center -ml-2"
            onPress={() => goBackOrReplace("/(vendor)/grounds")}
          >
            <Ionicons name="chevron-back" size={28} color="#F5F5F0" />
          </TouchableOpacity>
        <Text style={{ fontFamily: "SpaceGrotesk_700Bold" }} className="text-[21px] text-[#F5F5F0] flex-1 ml-2">
            {existing ? "EDIT GROUND" : "ADD GROUND"}
          </Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={step < 3 ? "Continue to next step" : "Save ground"} disabled={saving} onPress={step < 3 ? continueStep : save} className="min-h-[44px] px-2 items-center justify-center"><Text className="text-[#57CC63] font-bold">{saving ? "Saving" : step < 3 ? "Next" : "Save"}</Text></TouchableOpacity>
        </View>
        <Text className="text-[#92978F] mb-5">
          Add the details players need to find and book this ground.
        </Text>
        <View className="flex-row items-center mb-6"><Text className="text-[#57CC63] text-xs font-bold">STEP {step} OF 3</Text><View className="flex-1 h-1 bg-[#30372B] rounded-full mx-3 overflow-hidden"><View style={{ width: `${(step / 3) * 100}%` }} className="h-full bg-[#42B84F]" /></View><Text className="text-[#92978F] text-xs">{step === 1 ? 'Basics' : step === 2 ? 'Rules & policy' : 'Photos'}</Text></View>
        {step === 1 && <>
        <View className="mb-5 rounded-2xl border border-[#30372B] bg-[#1B1F19] p-4"><Text className="text-[#F5F5F0] font-bold mb-1">Regular operating hours</Text><Text className="text-[#92978F] text-xs mb-3">Slots must fit inside these hours. You can choose the regular booking times after creating the ground.</Text><View className="flex-row"><View className="flex-1 mr-2"><TimePicker dark label="Opens" value={form.operating_open} onChange={(value) => update('operating_open', value)} maximum="22:30" /></View><View className="flex-1"><TimePicker dark label="Closes" value={form.operating_close} onChange={(value) => update('operating_close', value)} minimum="00:30" /></View></View></View>
        {(
          [
            ["title", "Ground title *"],
            ["description", "Description"],
            ["location", "Location / area *"],
            ["city", "City *"],
            ["address", "Full address *"],
            ["price_per_hour", "Price per hour *"],
            ["peak_percentage", "Peak increase (%)"],
          ] as [keyof FormState, string][]
        ).map(([key, label]) => (
          <View key={key} className="mb-3">
            <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 15 }} className="text-[#AFAFA9] mb-1">{label.toUpperCase()}</Text>
            <TextInput
              className={fieldClass}
              value={form[key] as string}
              onChangeText={(value) => update(key, value)}
              placeholder={label.replace(" *", "")}
              placeholderTextColor="#777D74"
              keyboardType={
                ["price_per_hour", "peak_percentage"].includes(key)
                  ? "numeric"
                  : "default"
              }
              multiline={key === "description"}
            />
          </View>
        ))}
        <View className="mb-5 rounded-2xl border border-[#30372B] bg-[#1B1F19] p-4">
          <Text className="text-[#F5F5F0] font-bold mb-1">Pitch size</Text>
          <Text className="text-[#92978F] text-xs mb-3">Pick the format players will book. This helps them find the right ground.</Text>
          <View className="flex-row flex-wrap">
            {pitchOptions.map((pitch) => {
              const selected = form.pitch_type === pitch;
              return <TouchableOpacity key={pitch} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${pitch} pitch`} onPress={() => { setShowCustomPitch(false); update("pitch_type", pitch); }} className={`min-h-[44px] rounded-xl px-3 py-2.5 mr-2 mb-2 border ${selected ? "bg-[#17301B] border-[#42B84F]" : "bg-[#252A22] border-[#30372B]"}`}><Text className={selected ? "text-[#57CC63] font-bold text-sm" : "text-[#D9DBD5] font-semibold text-sm"}>{pitch}</Text></TouchableOpacity>;
            })}
            <TouchableOpacity accessibilityRole="radio" accessibilityState={{ selected: showCustomPitch || Boolean(form.pitch_type && !pitchOptions.includes(form.pitch_type)) }} accessibilityLabel="Other pitch size" onPress={() => { setShowCustomPitch(true); if (pitchOptions.includes(form.pitch_type)) update("pitch_type", ""); }} className={`min-h-[44px] rounded-xl px-3 py-2.5 mr-2 mb-2 border ${showCustomPitch || Boolean(form.pitch_type && !pitchOptions.includes(form.pitch_type)) ? "bg-[#17301B] border-[#42B84F]" : "bg-[#252A22] border-[#30372B]"}`}><Text className={showCustomPitch || Boolean(form.pitch_type && !pitchOptions.includes(form.pitch_type)) ? "text-[#57CC63] font-bold text-sm" : "text-[#D9DBD5] font-semibold text-sm"}>Other</Text></TouchableOpacity>
          </View>
          {(showCustomPitch || Boolean(form.pitch_type && !pitchOptions.includes(form.pitch_type))) && <TextInput className={`${fieldClass} mt-1`} value={pitchOptions.includes(form.pitch_type) ? "" : form.pitch_type} onChangeText={(value) => update("pitch_type", value)} placeholder="e.g. Futsal court" placeholderTextColor="#777D74" />}
        </View>
        </>}
        {step === 2 && <>
        <View className="mb-5 rounded-xl border border-[#30372B] bg-[#1B1F19] p-4">
          <Text className="text-[#F5F5F0] font-semibold">Cancellation & refund policy</Text>
          <Text className="text-[#92978F] text-xs mt-1 mb-3">Players see this before booking. The selected policy is locked into each booking.</Text>
          <View className="flex-row">
            {(['lenient', 'standard', 'strict'] as CancellationPolicy[]).map((policy) => <TouchableOpacity key={policy} accessibilityRole="radio" accessibilityState={{ selected: form.cancellation_policy === policy }} onPress={() => setForm((current) => ({ ...current, cancellation_policy: policy }))} className={`flex-1 rounded-xl border py-3 items-center ${form.cancellation_policy === policy ? 'bg-[#17301B] border-[#42B84F]' : 'border-[#30372B] bg-[#252A22]'}`}><Text className={form.cancellation_policy === policy ? 'text-[#57CC63] font-bold text-sm' : 'text-[#B8BBB5] text-sm'}>{CANCELLATION_POLICY_LABELS[policy]}</Text></TouchableOpacity>)}
          </View>
          <View className="mt-4 gap-2"><Text className="text-[#D9DBD5] text-xs leading-5"><Text className="text-[#57CC63] font-bold">Lenient:</Text> Best for players. Full refund 24 hours before; some money can still be returned closer to the match.</Text><Text className="text-[#D9DBD5] text-xs leading-5"><Text className="text-[#57CC63] font-bold">Standard:</Text> Balanced choice. Full refund 24 hours before; no refund in the final 6 hours.</Text><Text className="text-[#D9DBD5] text-xs leading-5"><Text className="text-[#57CC63] font-bold">Strict:</Text> Best when demand is high. Full refund needs 48 hours notice; no refund in the final 6 hours.</Text><Text className="text-[#92978F] text-xs mt-1">Every player gets a short grace period immediately after booking: 30 min (Lenient), 15 min (Standard), or 5 min (Strict).</Text></View>
        </View>
        </>}
        {step === 1 && <>
        <View className="mb-4">
          <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 15 }} className="text-[#AFAFA9] mb-1">
            Map coordinates
          </Text>
          <TextInput
            accessibilityLabel="Map coordinates"
            className={fieldClass}
            value={form.coordinates}
            onChangeText={(value) => update("coordinates", value)}
            placeholder="33.641757, 72.996779"
            placeholderTextColor="#777D74"
            autoCapitalize="none"
          />
          <Text className="text-[#92978F] text-xs mt-1">
            Enter latitude and longitude together, separated by a comma.
          </Text>
        </View>
        <View className="mb-5 rounded-xl border border-[#30372B] bg-[#1B1F19] p-4">
          <Text className="text-[#F5F5F0] font-semibold">Peak pricing</Text>
          <Text className="text-[#92978F] text-xs mt-1">
            During these hours, the normal slot price increases by your selected
            percentage.
          </Text>
          <View className="flex-row flex-wrap mt-3">
            {days.map((label, index) => (
              <TouchableOpacity
                key={label}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    peak_days: current.peak_days.includes(index)
                      ? current.peak_days.filter((day) => day !== index)
                      : [...current.peak_days, index],
                  }))
                }
                className={`mr-2 mb-2 rounded-full px-3 py-2 ${form.peak_days.includes(index) ? "bg-[#42B84F]" : "bg-[#282E25] border border-[#30372B]"}`}
              >
                <Text
                  className={
                    form.peak_days.includes(index)
                      ? "text-white text-xs font-bold"
                      : "text-[#B8BBB5] text-xs"
                  }
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row mt-2">
            <View className="flex-1 mr-2"><TimePicker dark label="Starts" value={form.peak_start_time} onChange={(value) => update("peak_start_time", value)} /></View>
            <View className="flex-1"><TimePicker dark label="Ends" value={form.peak_end_time} onChange={(value) => update("peak_end_time", value)} /></View>
          </View>
        </View>
        </>}
        {step === 3 && <>
        <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 15 }} className="text-[#AFAFA9] mb-2">PHOTOS</Text>
        <TouchableOpacity
          onPress={pickCover}
          className="bg-[#1B1F19] border border-dashed border-[#42B84F] rounded-xl overflow-hidden mb-4"
        >
          {form.cover_image ? (
            <Image
              source={{ uri: form.cover_image }}
              className="w-full h-40"
              resizeMode="cover"
            />
          ) : (
            <View className="h-28 items-center justify-center">
              <Ionicons name="image-outline" size={30} color="#57CC63" />
              <Text className="text-[#57CC63] mt-2">Choose cover image</Text>
            </View>
          )}
        </TouchableOpacity>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[#F5F5F0] font-medium">Ground images</Text>
          <Text className="text-[#92978F] text-xs">
            {form.images.length} selected
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2"
        >
          {form.images.map((uri, index) => (
            <View key={`${uri}-${index}`} className="mr-3">
              <Image
                source={{ uri }}
                className="w-28 h-24 rounded-xl"
                resizeMode="cover"
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Remove ground image ${index + 1}`}
                onPress={() => removeGroundImage(uri)}
                className="absolute -right-1 -top-1 h-11 w-11 items-center justify-center"
              >
                <Ionicons name="close-circle" size={22} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add ground images"
            onPress={addImages}
            className="w-28 h-24 rounded-xl bg-[#1B251B] border border-dashed border-[#42B84F] items-center justify-center"
          >
            <Ionicons name="add" size={28} color="#57CC63" />
            <Text className="text-[#57CC63] text-xs mt-1">Add more</Text>
          </TouchableOpacity>
        </ScrollView>
        </>}
        {step === 2 && <>
        <View className="mb-4">
          <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 15 }} className="text-[#AFAFA9] mb-2">AMENITIES</Text>
          <Text className="text-[#92978F] text-xs mb-3">Tap what is already available. You can choose up to {MAX_AMENITIES} and add something else below.</Text>
          <View className="flex-row flex-wrap mb-2">
            {amenityOptions.map((amenity) => {
              const selected = form.amenities.includes(amenity);
              return <TouchableOpacity key={amenity} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={amenity} onPress={() => toggleAmenity(amenity)} className={`min-h-[44px] flex-row items-center rounded-xl px-3 py-2 mr-2 mb-2 border ${selected ? "bg-[#17301B] border-[#42B84F]" : "bg-[#252A22] border-[#30372B]"}`}><Ionicons name={selected ? "checkmark-circle" : "add-circle-outline"} size={16} color={selected ? "#57CC63" : "#92978F"} /><Text className={`ml-1.5 text-xs ${selected ? "text-[#57CC63] font-bold" : "text-[#D9DBD5]"}`}>{amenity}</Text></TouchableOpacity>;
            })}
          </View>
          <Text className="text-[#D9DBD5] text-xs font-semibold mb-2">Add another amenity</Text>
          {tagInput(
            "amenities",
            newAmenity,
            setNewAmenity,
            "e.g. Equipment rental",
          )}
          {form.amenities.some((amenity) => !amenityOptions.includes(amenity)) && renderTags("amenities")}
        </View>
        <View className="mb-4">
          <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 15 }} className="text-[#AFAFA9] mb-2">RULES</Text>
          {tagInput("rules", newRule, setNewRule, "e.g. No smoking")}
          {renderTags("rules")}
        </View>
        </>}
        {step < 3 && <View className="flex-row mt-4"><TouchableOpacity accessibilityRole="button" onPress={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} className={`min-h-[52px] px-5 rounded-xl items-center justify-center mr-3 ${step === 1 ? 'opacity-0' : 'border border-[#30372B]'}`}><Text className="text-[#D5D8D1] font-bold">Back</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={continueStep} className="flex-1 min-h-[52px] bg-[#42B84F] rounded-xl items-center justify-center"><Text className="text-[#102110] font-bold">Continue</Text></TouchableOpacity></View>}
        {step === 3 && <TouchableOpacity accessibilityRole="button" onPress={() => setStep(2)} className="py-3 items-center mt-3"><Text className="text-[#D5D8D1] font-bold">Back to rules & policy</Text></TouchableOpacity>}
        {step === 3 && <TouchableOpacity
          disabled={saving}
          onPress={save}
          className="bg-[#42B84F] rounded-xl py-4 items-center mt-3"
        >
          <Text className="text-[#102110] font-bold">
            {saving
              ? "Saving..."
              : existing
                ? "Update Ground"
                : "Create Ground"}
          </Text>
        </TouchableOpacity>}
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
