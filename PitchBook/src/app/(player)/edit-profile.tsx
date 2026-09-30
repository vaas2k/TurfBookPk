import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateProfile } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Toast } from "@/components/ui/toast";
import * as ImagePicker from "expo-image-picker";
import { deleteOwnedImageUrl, uploadImage } from "@/lib/api/media";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppearanceStore } from "@/store/appearanceStore";
import { playerThemes } from "@/theme/playerTheme";

const input =
  "bg-[#181C16] border border-[#30372B] rounded-xl px-4 py-3 text-[#F8F7F0]";

export default function EditPlayerProfile() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const profile = useAuthStore((state) => state.profile);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    setName(profile?.full_name || "");
    setCity(profile?.city || "");
    setBio(profile?.bio || "");
    setAvatar(profile?.avatar_url || null);
  }, [profile]);
  const pickAvatar = async () => { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) return setToast('Allow photo access to choose an avatar.'); const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 }); if (result.canceled) return; setSaving(true); try { const uploaded = await uploadImage(result.assets[0], 'avatar'); await deleteOwnedImageUrl(avatar).catch(() => undefined); setAvatar(uploaded.url); } catch (error: any) { setToast(error?.message || 'Unable to upload avatar.'); } finally { setSaving(false); } };
  const save = async () => {
    if (name.trim().length < 2)
      return setToast("Full name must have at least 2 characters.");
    setSaving(true);
    try {
      const result = await updateProfile({
        full_name: name.trim(),
        city: city.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatar,
      });
      useAuthStore.setState({ user: result.user, profile: result.profile });
      goBackOrReplace("/(player)/profile");
    } catch (error: any) {
      setToast(error?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.canvas }}>
      <ScrollView
        className="px-6"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center py-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(player)/profile")}
            className="w-10 h-10 rounded-xl border items-center justify-center mr-3" style={{ backgroundColor: theme.surfaceRaised, borderColor: theme.border }}
          >
            <Text className="text-[#1A1A2E] text-xl">‹</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 26, color: theme.text }} className="flex-1">
            Edit Profile
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose profile photo" disabled={saving} onPress={pickAvatar} className="items-center mb-5">{avatar ? <Image source={{ uri: avatar }} className="h-20 w-20 rounded-full border-2 border-[#3DB54A]" /> : <View className="h-20 w-20 rounded-full border-2 border-[#3DB54A] items-center justify-center"><Text className="text-[#3DB54A] text-xl font-bold">{name.slice(0, 1).toUpperCase() || 'P'}</Text></View>}<Text className="text-[#3DB54A] font-bold text-sm mt-2">Change photo</Text></TouchableOpacity>
        <Text style={{ color: theme.subtle }} className="font-medium text-sm mb-2">Full name</Text>
        <TextInput
          accessibilityLabel="Full name"
          value={name}
          onChangeText={setName}
          className={input}
          style={{ color: theme.text, backgroundColor: theme.surfaceRaised, borderColor: theme.border }}
        />
        <Text style={{ color: theme.subtle }} className="font-medium text-sm mt-4 mb-2">City</Text>
        <TextInput
          accessibilityLabel="City"
          value={city}
          onChangeText={setCity}
          className={input}
          style={{ color: theme.text, backgroundColor: theme.surfaceRaised, borderColor: theme.border }}
        />
        <Text style={{ color: theme.subtle }} className="font-medium text-sm mt-4 mb-2">Bio</Text>
        <TextInput
          accessibilityLabel="Bio"
          value={bio}
          onChangeText={setBio}
          className={input}
          style={{ color: theme.text, backgroundColor: theme.surfaceRaised, borderColor: theme.border }}
          multiline
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
          disabled={saving}
          onPress={save}
          className="rounded-full py-4 items-center mt-6" style={{ backgroundColor: saving ? theme.muted : theme.green }}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold">Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
