import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";
import { appDialog } from "@/components/ui/app-dialog";
import { useAppearanceStore } from "@/store/appearanceStore";
import { useVendorStore } from "@/store/vendorStore";
import VendorVerificationFlow, { VendorBaseData } from "@/components/vendor/VendorVerificationFlow";
import { playerThemes } from "@/theme/playerTheme";
import { IconButton } from "@/components/ui/icon-button";
import { getMyManagerAssignments } from '@/lib/api/managers';

export default function ProfileScreen() {
  const { openVendorVerification } = useLocalSearchParams<{ openVendorVerification?: string }>();
  const { profile, signOut, user, switchToVendor } = useAuthStore();
  const { isVendor, checkVendorStatus, registerVendor } = useVendorStore();
  const { appearance } = useAppearanceStore();
  const theme = playerThemes.dark;
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [hasManagerAccess, setHasManagerAccess] = useState(false);
  useEffect(() => { if (openVendorVerification === '1') setShowVendorModal(true); }, [openVendorVerification]);
  useFocusEffect(useCallback(() => { if (!user) return; void getMyManagerAssignments().then((items) => setHasManagerAccess(items.length > 0)).catch(() => undefined); }, [user]));
  const initials = (profile?.full_name || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // In the logout handler, use router.replace
  const handleLogout = async () => {
    appDialog.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/phone-input");
        },
      },
    ]);
  };

  const handleSwitchToVendor = async () => {
    if (!user) return;
    const status = await checkVendorStatus(user.id);
    if (!status.isVendor) {
      setShowVendorModal(true);
      return;
    }
    appDialog.alert(
      "Switch to Vendor Mode",
      "You can return to player mode anytime from the vendor workspace.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            const { error } = await switchToVendor();
            if (error) appDialog.alert("Unable to switch modes", error.message);
            else router.replace("/(vendor)");
          },
        },
      ],
    );
  };

  const handleVendorRegister = async (data: VendorBaseData) => {
    const { error } = await registerVendor(data);
    if (error) appDialog.alert("Registration failed", error);
  };

  const row = (
    label: string,
    onPress?: () => void,
    value?: string,
    destructive = false,
  ) => {
    const icon: keyof typeof Ionicons.glyphMap = label.includes('Wallet') ? 'wallet-outline' : label.includes('Saved') ? 'heart-outline' : label.includes('Mobile') ? 'call-outline' : label.includes('Notification') ? 'notifications-outline' : label.includes('Language') ? 'language-outline' : label.includes('Help') ? 'help-circle-outline' : label.includes('Log Out') ? 'log-out-outline' : 'person-outline';
    return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[68px] px-4 flex-row items-center border-b"
      style={{ borderBottomColor: theme.border }}
    >
      <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: destructive ? '#351D1D' : theme.businessSurface }}><Ionicons name={destructive ? 'trash-outline' : icon} size={20} color={destructive ? '#FF5A55' : theme.green} /></View>
      <Text
        className="flex-1 text-[16px]"
        style={{ color: destructive ? "#FF5A55" : theme.text }}
      >
        {label}
      </Text>
      {value && <Text className="text-sm mr-2" style={{ color: theme.subtle }}>{value}</Text>}
      <Ionicons
        name="chevron-forward"
        size={21}
        color={destructive ? "#FF5A55" : theme.subtle}
      />
    </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1"
      style={{ backgroundColor: theme.canvas }}
    >
      <StatusBar
        barStyle={appearance === 'dark' ? "light-content" : "dark-content"}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-3 pb-4 flex-row items-center">
          <View className="mr-3"><IconButton accessibilityLabel="Go back" icon="arrow-back" color={theme.text} onPress={() => router.replace("/(player)")} /></View>
          <Text
            style={{
              fontFamily: "BigShouldersDisplay_800ExtraBold",
              fontSize: 26, color: theme.text,
            }}
            className=""
          >
            PROFILE
          </Text>
        </View>
        <View className="mx-5 border rounded-[22px] px-4 py-4 flex-row items-center" style={{ borderColor: theme.border, backgroundColor: theme.surfaceRaised }}>
          <View className="w-[82px] h-[82px] rounded-full border-2 border-[#3DB54A] items-center justify-center overflow-hidden">
            {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} className="w-full h-full" resizeMode="cover" /> : <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
              className="text-[#3DB54A] text-[23px]"
            >
              {initials}
            </Text>}
          </View>
          <View className="flex-1 ml-4">
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
              className="text-[18px]"
              numberOfLines={1}
            >
              {profile?.full_name || "User"}
            </Text>
            <Text className="text-sm mt-1" style={{ color: theme.subtle }}>
              {profile?.phone || "No phone number"}
            </Text>
            {profile?.city && <View className="flex-row items-center mt-1.5"><Ionicons name="location-outline" size={14} color={theme.subtle} /><Text className="text-xs ml-1" style={{ color: theme.subtle }}>{profile.city}</Text></View>}
            <TouchableOpacity
              onPress={() => router.push("/(player)/edit-profile")}
              className="flex-row items-center mt-2"
            >
              <Text
                style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                className="text-[#3DB54A] text-sm"
              >
                Edit Profile
              </Text>
              <Ionicons name="chevron-forward" size={17} color="#3DB54A" />
            </TouchableOpacity>
          </View>
        </View>
        <View className="px-5">
          <Text
            style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17, color: theme.muted }}
            className="mt-7 mb-2"
          >
            ACCOUNT
          </Text>
          <View className="rounded-[18px] overflow-hidden" style={{ backgroundColor: theme.surface }}>
            {row("My Wallet & Payments", () => router.push("/(player)/wallet"))}
            {row("Saved & Recently Viewed", () =>
              router.push("/(player)/saved-grounds"),
            )}
            {row("Change Mobile Number", () =>
              appDialog.alert(
                "Change mobile number",
                "Your mobile number is used for account verification. Contact support to change it safely.",
                [{ text: "OK" }],
              ),
            )}
          </View>
          <Text
            style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17, color: theme.muted }}
            className="mt-7 mb-2"
          >
            PREFERENCES
          </Text>
          <View className="rounded-[18px] overflow-hidden" style={{ backgroundColor: theme.surface }}>
            {row("Notification Alerts", () =>
              router.push("/(player)/notifications"),
            )}
            {/* Theme switch is intentionally paused: TurfBookPK is dark-only for now. */}
            {/* <View className="min-h-[64px] px-4 flex-row items-center border-b" style={{ borderBottomColor: theme.border }}>
              <View className="flex-1">
                <Text className="text-[16px]" style={{ color: theme.text }}>Dark mode</Text>
                <Text className="text-xs mt-0.5" style={{ color: theme.subtle }}>
                  Your appearance is saved on this device
                </Text>
              </View>
              <Switch
                accessibilityLabel="Toggle dark mode"
                value={appearance === "dark"}
                onValueChange={() => undefined}
                trackColor={{ false: "#73796D", true: "#3DB54A" }}
                thumbColor="#F8F7F0"
              />
            </View> */}
            {row(
              "App Language",
              () =>
                appDialog.alert(
                  "App language",
                  "English is currently the available app language.",
                  [{ text: "OK" }],
                ),
              "English",
            )}
          </View>
          <Text
            style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17, color: theme.muted }}
            className="mt-7 mb-2"
          >
            BUSINESS
          </Text>
          {hasManagerAccess ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open ground manager workspace" onPress={() => router.push('/(player)/manager-hub')} className="border rounded-[18px] min-h-[70px] px-4 flex-row items-center mb-3" style={{ backgroundColor: theme.businessSurface, borderColor: theme.businessBorder }}><Ionicons name="people-outline" size={23} color={theme.green} /><View className="flex-1 ml-4"><Text style={{ color: theme.text }} className="font-bold text-base">Ground manager</Text><Text style={{ color: theme.businessMuted }} className="text-xs">Check in players at assigned grounds</Text></View><Ionicons name="arrow-forward" size={20} color={theme.green} /></TouchableOpacity> : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              isVendor ? "Switch to vendor mode" : "Become a vendor"
            }
            onPress={handleSwitchToVendor}
            className="border rounded-[18px] min-h-[70px] px-4 flex-row items-center"
            style={{ backgroundColor: theme.businessSurface, borderColor: theme.businessBorder }}
          >
            <View className="h-10 w-10 rounded-xl bg-[#3DB54A] items-center justify-center">
              <Ionicons name="storefront-outline" size={21} color="#FFFFFF" />
            </View>
            <View className="flex-1 ml-3">
              <Text
                style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
                className="text-[16px]"
              >
                {isVendor ? "Switch to Vendor" : "Become a Vendor"}
              </Text>
              <Text className="text-xs mt-0.5" style={{ color: theme.businessMuted }}>
                {isVendor
                  ? "Manage your grounds and bookings"
                  : "List your ground and accept bookings"}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={21} color="#59C462" />
          </TouchableOpacity>
          <Text
            style={{ fontFamily: "BigShouldersDisplay_700Bold", fontSize: 17, color: theme.muted }}
            className="mt-7 mb-2"
          >
            SUPPORT
          </Text>
          <View className="rounded-[18px] overflow-hidden" style={{ backgroundColor: theme.surface }}>
            {row("Help Center & Support", () =>
              router.push("/(player)/help-support"),
            )}
          </View>
          <View className="rounded-[18px] overflow-hidden mt-7" style={{ backgroundColor: theme.surface }}>
            {row("Log Out", handleLogout)}
            {row(
              "Delete Account",
              () =>
                appDialog.alert(
                  "Delete account",
                  "Account deletion is not available in this MVP. Please contact support.",
                  [{ text: "OK" }],
                ),
              undefined,
              true,
            )}
          </View>
        </View>
      </ScrollView>
      <VendorVerificationFlow
        visible={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onCreateVendor={handleVendorRegister}
      />
    </SafeAreaView>
  );
}
