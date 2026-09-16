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
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateProfile } from "@/lib/api/auth";
import { useAuthStore } from "@/store/authStore";
import { Toast } from "@/components/ui/toast";
import * as ImagePicker from "expo-image-picker";
import { deleteOwnedImageUrl, uploadImage } from "@/lib/api/media";

const input =
  "bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]";

export default function EditPlayerProfile() {
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
      router.back();
    } catch (error: any) {
      setToast(error?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <ScrollView
        className="px-6"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="flex-row items-center py-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            className="w-11 h-11 rounded-full bg-white border border-[#E5E5E5] items-center justify-center mr-3"
          >
            <Text className="text-[#1A1A2E] text-xl">‹</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-[#1A1A2E] flex-1">
            Edit Profile
          </Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose profile photo" disabled={saving} onPress={pickAvatar} className="items-center mb-5">{avatar ? <Image source={{ uri: avatar }} className="h-24 w-24 rounded-full" /> : <View className="h-24 w-24 rounded-full bg-[#E8F5E9] items-center justify-center"><Text className="text-[#2E7D32] text-2xl font-bold">{name.slice(0, 1).toUpperCase() || 'P'}</Text></View>}<Text className="text-[#2E7D32] font-bold mt-2">Change photo</Text></TouchableOpacity>
        <Text className="text-[#1A1A2E] font-medium mb-2">Full name</Text>
        <TextInput
          accessibilityLabel="Full name"
          value={name}
          onChangeText={setName}
          className={input}
        />
        <Text className="text-[#1A1A2E] font-medium mt-4 mb-2">City</Text>
        <TextInput
          accessibilityLabel="City"
          value={city}
          onChangeText={setCity}
          className={input}
        />
        <Text className="text-[#1A1A2E] font-medium mt-4 mb-2">Bio</Text>
        <TextInput
          accessibilityLabel="Bio"
          value={bio}
          onChangeText={setBio}
          className={input}
          multiline
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Save profile changes"
          disabled={saving}
          onPress={save}
          className={`rounded-xl py-4 items-center mt-6 ${saving ? "bg-[#9CA3AF]" : "bg-[#4CAF50]"}`}
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
