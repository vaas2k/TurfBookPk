import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
  "bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]";
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
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    listVendorGrounds()
      .then((items) => {
        const ground = items.find((item) => item.id === id);
        if (!ground) return;
        setExisting(ground);
        const peak = ground.peak_windows[0];
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
  }, [id]);

  const update = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const addTag = (
    key: "amenities" | "rules",
    value: string,
    clear: (value: string) => void,
  ) => {
    const clean = value.trim();
    if (!clean || form[key].includes(clean)) return;
    setForm((current) => ({ ...current, [key]: [...current[key], clean] }));
    clear("");
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
        await updateGround(existing.id, data);
        router.replace("/(vendor)/grounds");
      } else {
        const created = await createGround(data);
        router.replace({
          pathname: "/(vendor)/setup-schedule",
          params: { id: created.id, title: created.title },
        });
      }
    } catch (error: any) {
      setToast(error?.message || "Unable to save ground. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderTags = (key: "amenities" | "rules") => (
    <View className="flex-row flex-wrap mt-2">
      {form[key].map((item) => (
        <View
          key={item}
          className="flex-row items-center bg-[#E8F5E9] rounded-full px-3 py-2 mr-2 mb-2"
        >
          <Text className="text-[#2E7D32] mr-2">{item}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item}`}
            className="h-8 w-8 items-center justify-center"
            onPress={() => removeTag(key, item)}
          >
            <Ionicons name="close-circle" size={16} color="#2E7D32" />
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
        placeholderTextColor="#A3A3A3"
        onSubmitEditing={() => addTag(key, value, setValue)}
        returnKeyType="done"
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Add ${key === "amenities" ? "amenity" : "rule"}`}
        className="bg-[#1A1A2E] rounded-xl h-12 w-12 ml-2 items-center justify-center"
        onPress={() => addTag(key, value, setValue)}
      >
        <Ionicons name="add" size={22} color="white" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row items-center py-5">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="h-11 w-11 rounded-full bg-white border border-[#E5E5E5] items-center justify-center"
            onPress={() => goBackOrReplace("/(vendor)/grounds")}
          >
            <Ionicons name="arrow-back" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-[#1A1A2E] flex-1 text-center">
            {existing ? "Edit Ground" : "Add Ground"}
          </Text>
          <View className="w-11" />
        </View>
        <Text className="text-[#737373] mb-4">
          Add the details players need to find and book this ground.
        </Text>
        <View className="mb-4 rounded-2xl border border-[#E5E5E5] bg-white p-4"><Text className="text-[#1A1A2E] font-bold mb-1">Regular operating hours</Text><Text className="text-[#737373] text-xs mb-3">Slots must fit inside these hours. You can choose the regular booking times after creating the ground.</Text><View className="flex-row"><View className="flex-1 mr-2"><TimePicker label="Opens" value={form.operating_open} onChange={(value) => update('operating_open', value)} maximum="22:30" /></View><View className="flex-1"><TimePicker label="Closes" value={form.operating_close} onChange={(value) => update('operating_close', value)} minimum="00:30" /></View></View></View>
        {(
          [
            ["title", "Ground title *"],
            ["description", "Description"],
            ["location", "Location / area *"],
            ["city", "City *"],
            ["address", "Full address *"],
            ["price_per_hour", "Price per hour *"],
            ["peak_percentage", "Peak increase (%)"],
            ["pitch_type", "Pitch type"],
          ] as [keyof FormState, string][]
        ).map(([key, label]) => (
          <View key={key} className="mb-3">
            <Text className="text-[#1A1A2E] font-medium mb-1">{label}</Text>
            <TextInput
              className={fieldClass}
              value={form[key] as string}
              onChangeText={(value) => update(key, value)}
              placeholder={label.replace(" *", "")}
              placeholderTextColor="#A3A3A3"
              keyboardType={
                ["price_per_hour", "peak_percentage"].includes(key)
                  ? "numeric"
                  : "default"
              }
              multiline={key === "description"}
            />
          </View>
        ))}
        <View className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
          <Text className="text-[#1A1A2E] font-semibold">Cancellation & refund policy</Text>
          <Text className="text-[#737373] text-xs mt-1 mb-3">Players see this before booking. The selected policy is locked into each booking.</Text>
          <View className="flex-row">
            {(['lenient', 'standard', 'strict'] as CancellationPolicy[]).map((policy) => <TouchableOpacity key={policy} accessibilityRole="radio" accessibilityState={{ selected: form.cancellation_policy === policy }} onPress={() => setForm((current) => ({ ...current, cancellation_policy: policy }))} className={`flex-1 rounded-xl border py-3 items-center ${form.cancellation_policy === policy ? 'bg-[#E8F5E9] border-[#4CAF50]' : 'border-[#E5E7EB] bg-[#FAFAFA]'}`}><Text className={form.cancellation_policy === policy ? 'text-[#2E7D32] font-bold text-sm' : 'text-[#4B5563] text-sm'}>{CANCELLATION_POLICY_LABELS[policy]}</Text></TouchableOpacity>)}
          </View>
          <Text className="text-[#737373] text-xs mt-3">Lenient: up to 25% within 6h. Standard: no refund within 6h. Strict: 48h notice for a full refund.</Text>
        </View>
        <View className="mb-4">
          <Text className="text-[#1A1A2E] font-medium mb-1">
            Map coordinates
          </Text>
          <TextInput
            accessibilityLabel="Map coordinates"
            className={fieldClass}
            value={form.coordinates}
            onChangeText={(value) => update("coordinates", value)}
            placeholder="33.641757, 72.996779"
            placeholderTextColor="#A3A3A3"
            autoCapitalize="none"
          />
          <Text className="text-[#737373] text-xs mt-1">
            Enter latitude and longitude together, separated by a comma.
          </Text>
        </View>
        <View className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
          <Text className="text-[#1A1A2E] font-semibold">Peak pricing</Text>
          <Text className="text-[#737373] text-xs mt-1">
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
                className={`mr-2 mb-2 rounded-full px-3 py-2 ${form.peak_days.includes(index) ? "bg-[#4CAF50]" : "bg-[#F5F5F5]"}`}
              >
                <Text
                  className={
                    form.peak_days.includes(index)
                      ? "text-white text-xs font-bold"
                      : "text-[#4B5563] text-xs"
                  }
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row mt-2">
            <View className="flex-1 mr-2"><TimePicker label="Starts" value={form.peak_start_time} onChange={(value) => update("peak_start_time", value)} /></View>
            <View className="flex-1"><TimePicker label="Ends" value={form.peak_end_time} onChange={(value) => update("peak_end_time", value)} /></View>
          </View>
        </View>
        <Text className="text-[#1A1A2E] font-medium mb-2">Cover image</Text>
        <TouchableOpacity
          onPress={pickCover}
          className="bg-white border border-dashed border-[#4CAF50] rounded-xl overflow-hidden mb-4"
        >
          {form.cover_image ? (
            <Image
              source={{ uri: form.cover_image }}
              className="w-full h-40"
              resizeMode="cover"
            />
          ) : (
            <View className="h-28 items-center justify-center">
              <Ionicons name="image-outline" size={30} color="#4CAF50" />
              <Text className="text-[#4CAF50] mt-2">Choose cover image</Text>
            </View>
          )}
        </TouchableOpacity>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[#1A1A2E] font-medium">Ground images</Text>
          <Text className="text-[#737373] text-xs">
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
            className="w-28 h-24 rounded-xl bg-[#E8F5E9] items-center justify-center"
          >
            <Ionicons name="add" size={28} color="#4CAF50" />
            <Text className="text-[#4CAF50] text-xs mt-1">Add more</Text>
          </TouchableOpacity>
        </ScrollView>
        <View className="mb-4">
          <Text className="text-[#1A1A2E] font-medium mb-2">Amenities</Text>
          {tagInput(
            "amenities",
            newAmenity,
            setNewAmenity,
            "e.g. Parking, floodlights",
          )}
          {renderTags("amenities")}
        </View>
        <View className="mb-4">
          <Text className="text-[#1A1A2E] font-medium mb-2">Rules</Text>
          {tagInput("rules", newRule, setNewRule, "e.g. No smoking")}
          {renderTags("rules")}
        </View>
        <TouchableOpacity
          disabled={saving}
          onPress={save}
          className="bg-[#4CAF50] rounded-xl py-4 items-center mt-3"
        >
          <Text className="text-white font-bold">
            {saving
              ? "Saving..."
              : existing
                ? "Update Ground"
                : "Create Ground"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
