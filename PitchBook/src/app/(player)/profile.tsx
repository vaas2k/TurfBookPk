import { useState } from "react";
import {
  ScrollView,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";
import { appDialog } from "@/components/ui/app-dialog";
import { useAppearanceStore } from "@/store/appearanceStore";
import { useVendorStore } from "@/store/vendorStore";
import VendorRegistrationModal, {
  VendorFormData,
} from "@/components/vendor/VendorRegistrationModal";
import { playerThemes } from "@/theme/playerTheme";

export default function ProfileScreen() {
  const { profile, signOut, user, switchToVendor } = useAuthStore();
  const { isVendor, checkVendorStatus, registerVendor } = useVendorStore();
  const { appearance, toggleAppearance } = useAppearanceStore();
  const theme = playerThemes[appearance];
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorLoading, setVendorLoading] = useState(false);
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
    const status = isVendor ? { isVendor } : await checkVendorStatus(user.id);
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

  const handleVendorRegister = async (data: VendorFormData) => {
    setVendorLoading(true);
    const { error } = await registerVendor(data);
    setVendorLoading(false);
    if (error) appDialog.alert("Registration failed", error);
    else {
      setShowVendorModal(false);
      router.replace("/(vendor)");
    }
  };

  const row = (
    label: string,
    onPress?: () => void,
    value?: string,
    destructive = false,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[64px] px-4 flex-row items-center border-b"
      style={{ borderBottomColor: theme.border }}
    >
      <Text
        className="flex-1 text-[16px]"
        style={{ color: destructive ? "#FF5A55" : theme.text }}
      >
        {label}
      </Text>
      {value && <Text className="text-sm mr-2" style={{ color: theme.subtle }}>{value}</Text>}
      <Ionicons
        name={destructive ? "trash-outline" : "chevron-forward"}
        size={21}
        color={destructive ? "#FF5A55" : theme.subtle}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1"
      style={{ backgroundColor: theme.canvas }}
    >
      <StatusBar
        barStyle={appearance === 'dark' ? "light-content" : "dark-content"}
        backgroundColor={theme.canvas}
        translucent={false}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-3 pb-4 flex-row items-center">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.replace("/(player)")}
            className="w-10 h-10 rounded-xl border items-center justify-center mr-3"
            style={{ borderColor: theme.border }}
          >
            <Ionicons name="arrow-back" size={23} color={theme.text} />
          </TouchableOpacity>
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
          <View className="w-[82px] h-[82px] rounded-full border-2 border-[#3DB54A] items-center justify-center">
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
              className="text-[#3DB54A] text-[23px]"
            >
              {initials}
            </Text>
          </View>
          <View className="flex-1 ml-4">
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[18px]"
              numberOfLines={1}
            >
              {profile?.full_name || "User"}
            </Text>
            <Text className="text-sm mt-1" style={{ color: theme.subtle }}>
              {profile?.phone || "No phone number"}
            </Text>
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
            <View className="min-h-[64px] px-4 flex-row items-center border-b" style={{ borderBottomColor: theme.border }}>
              <View className="flex-1">
                <Text className="text-[16px]" style={{ color: theme.text }}>Dark mode</Text>
                <Text className="text-xs mt-0.5" style={{ color: theme.subtle }}>
                  Your appearance is saved on this device
                </Text>
              </View>
              <Switch
                accessibilityLabel="Toggle dark mode"
                value={appearance === "dark"}
                onValueChange={toggleAppearance}
                trackColor={{ false: "#73796D", true: "#3DB54A" }}
                thumbColor="#F8F7F0"
              />
            </View>
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
      <VendorRegistrationModal
        visible={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onRegister={handleVendorRegister}
        isLoading={vendorLoading}
      />
    </SafeAreaView>
  );
}
