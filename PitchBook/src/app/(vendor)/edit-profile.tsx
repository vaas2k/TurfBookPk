import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateVendorProfile } from "@/lib/api/vendors";
import { useVendorStore } from "@/store/vendorStore";
import { Toast } from "@/components/ui/toast";
import * as ImagePicker from "expo-image-picker";
import { deleteOwnedImageUrl, uploadImage } from "@/lib/api/media";
import { appDialog } from "@/components/ui/app-dialog";
import { goBackOrReplace } from "@/lib/navigation";
import { Ionicons } from "@expo/vector-icons";

const input =
  "bg-[#1B1F19] border border-[#30372B] rounded-xl px-4 py-3 text-[#F5F5F0]";
export default function EditVendorProfile() {
  const vendorProfile = useVendorStore((state) => state.vendorProfile);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    setName(vendorProfile?.business_name || "");
    setPhone(vendorProfile?.business_phone || "");
    setCity(vendorProfile?.business_city || "");
    setDescription(vendorProfile?.business_description || "");
    setLogo(vendorProfile?.business_logo || null); setCover(vendorProfile?.business_cover_image || null);
  }, [vendorProfile]);
  const pickImage = async (purpose: 'vendor_logo' | 'vendor_cover') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setToast('Allow photo access to choose an image.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: purpose === 'vendor_logo' ? [1, 1] : [16, 9], quality: 0.8 });
    if (result.canceled) return;
    setSaving(true);
    try {
      const uploaded = await uploadImage(result.assets[0], purpose);
      await deleteOwnedImageUrl(purpose === 'vendor_logo' ? logo : cover).catch(() => undefined);
      if (purpose === 'vendor_logo') setLogo(uploaded.url);
      else setCover(uploaded.url);
    } catch (error: any) {
      setToast(error?.message || 'Unable to upload image.');
    } finally {
      setSaving(false);
    }
  };
  const save = async () => {
    if (!name.trim() || !phone.trim() || !city.trim())
      return setToast("Business name, phone, and city are required.");
    setSaving(true);
    try {
      const profile = await updateVendorProfile({
        business_name: name.trim(),
        business_phone: phone.trim(),
        business_city: city.trim(),
        business_description: description.trim() || null,
        business_logo: logo,
        business_cover_image: cover,
      });
      useVendorStore.setState({ vendorProfile: profile });
      goBackOrReplace("/(vendor)/profile");
    } catch (error: any) {
      setToast(error?.message || "Unable to update business profile.");
    } finally {
      setSaving(false);
    }
  };
  const toggleActivation = () => { if (!vendorProfile || saving) return; const active = vendorProfile.is_active; appDialog.alert(active ? 'Pause business?' : 'Reactivate business?', active ? 'Players will no longer find or book your grounds. Existing bookings remain visible.' : 'Your active grounds will become visible and bookable again.', [{ text: 'Keep current setting', style: 'cancel' }, { text: active ? 'Pause business' : 'Reactivate', style: active ? 'destructive' : 'default', onPress: async () => { setSaving(true); try { const profile = await updateVendorProfile({ is_active: !active }); useVendorStore.setState({ vendorProfile: profile }); } catch (error: any) { setToast(error?.message || 'Unable to update business availability.'); } finally { setSaving(false); } } }]); };
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />
      <ScrollView
        className="px-6"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center pt-5 pb-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(vendor)/profile")}
            className="w-10 h-10 items-center justify-center -ml-2"
          >
            <Text className="text-[#1A1A2E] text-xl">‹</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: "SpaceGrotesk_700Bold" }} className="text-[20px] text-[#F5F5F0] flex-1 ml-2">
            EDIT BUSINESS
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose business cover image" disabled={saving} onPress={() => pickImage('vendor_cover')} className="mb-4">{cover ? <Image source={{ uri: cover }} className="h-36 w-full rounded-2xl" /> : <View className="h-28 rounded-2xl bg-[#1B251B] border border-dashed border-[#42B84F] items-center justify-center"><Ionicons name="image-outline" size={28} color="#57CC63" /><Text className="text-[#57CC63] font-bold mt-2">Add cover image</Text></View>}</TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose business logo" disabled={saving} onPress={() => pickImage('vendor_logo')} className="items-center mb-2">{logo ? <Image source={{ uri: logo }} className="h-24 w-24 rounded-full border-2 border-[#42B84F]" /> : <View className="h-24 w-24 rounded-full bg-[#252A22] border border-[#30372B] items-center justify-center"><Ionicons name="camera-outline" size={26} color="#AFAFA9" /></View>}<Text className="text-[#57CC63] font-bold mt-2">Change logo</Text></TouchableOpacity>
        {(
          [
            ["Business name", name, setName],
            ["Business phone", phone, setPhone],
            ["City", city, setCity],
            ["Description", description, setDescription],
          ] as const
        ).map(([label, value, setter]) => (
          <View key={label} className="mt-4">
            <Text style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 16 }} className="text-[#AFAFA9] mb-2">{label.toUpperCase()}</Text>
            <TextInput
              accessibilityLabel={label}
              value={value}
              onChangeText={setter}
              className={input}
              multiline={label === "Description"}
            />
          </View>
        ))}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Save business changes"
          disabled={saving}
          onPress={save}
          className={`rounded-xl py-4 items-center mt-6 ${saving ? "bg-[#596055]" : "bg-[#42B84F]"}`}
        >
          {saving ? (
            <ActivityIndicator color="#102110" />
          ) : (
            <Text className="text-[#102110] font-bold">Save Changes</Text>
          )}
        </TouchableOpacity>
        <View className="mt-6 rounded-xl border border-[#30372B] bg-[#1B1F19] p-4"><Text className="font-bold text-[#F5F5F0]">Business visibility</Text><Text className="text-[#AFAFA9] mt-1">{vendorProfile?.is_active ? 'Active: players can discover and book your active grounds.' : 'Paused: your grounds are hidden from players.'}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={vendorProfile?.is_active ? 'Pause business' : 'Reactivate business'} disabled={saving || !vendorProfile} onPress={toggleActivation} className="min-h-[48px] justify-center mt-2"><Text className={vendorProfile?.is_active ? 'text-[#F58A7C] font-bold' : 'text-[#57CC63] font-bold'}>{vendorProfile?.is_active ? 'Pause business' : 'Reactivate business'}</Text></TouchableOpacity></View>
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
