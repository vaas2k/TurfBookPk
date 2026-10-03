import { Stack, usePathname, router } from "expo-router";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import { useVendorStore } from "@/store/vendorStore";

// Custom Tab Bar Component for Vendor
function VendorTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  const showTabBar = () => {
    const detailRoutes = [
      "/add-ground",
      "/ground-slots",
      "/ground-slot-day",
      "/setup-schedule",
      "/ground-reviews",
      "/booking/",
      "/notifications",
      "/edit-profile",
      "/ground-verification",
    ];
    return !detailRoutes.some((route) => pathname.includes(route));
  };

  if (!showTabBar()) return null;

  const tabs = [
    { name: "Home", icon: "home", route: "/(vendor)" },
    { name: "My Grounds", icon: "location", route: "/(vendor)/grounds" },
    { name: "History", icon: "calendar", route: "/(vendor)/bookings" },
    { name: "Earnings", icon: "bar-chart", route: "/(vendor)/earnings" },
    { name: "Profile", icon: "person", route: "/(vendor)/profile" },
  ];

  const isActive = (route: string) => {
    const cleanRoute = route.replace("/(vendor)", "");
    const cleanPath = pathname.replace("/(vendor)", "");

    if (
      route === "/(vendor)" &&
      (cleanPath === "" || cleanPath === "/" || cleanPath === "/index")
    ) {
      return true;
    }
    return cleanPath === cleanRoute;
  };

  const handlePress = (route: string) => {
    if (!isActive(route)) {
      router.replace(route as any);
    }
  };

  return (
    <View
      className="bg-[#10120F] border-t border-[#30372B]"
      style={{
        paddingBottom: bottomPadding,
        minHeight: 64 + bottomPadding,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: Platform.OS === "ios" ? 0.06 : 0.12,
        shadowRadius: 8,
        elevation: 10,
      }}
    >
      <View className="flex-row items-center justify-around px-2 pt-2">
        {tabs.map((tab) => {
          const active = isActive(tab.route);
          return (
            <TouchableOpacity
              key={tab.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.name}
              className={`items-center justify-center flex-1 min-h-[44px] rounded-2xl py-1 ${active ? "bg-[#1B321E]" : ""}`}
              onPress={() => handlePress(tab.route)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={active ? tab.icon : (`${tab.icon}-outline` as any)}
                size={24}
                color={active ? "#4FD05B" : "#969B94"}
              />
              <Text
                className={`text-[11px] mt-0.5 ${
                  active ? "text-[#4FD05B] font-medium" : "text-[#969B94]"
                }`}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function VendorLayout() {
  const user = useAuthStore((state) => state.user);
  const { isVendor, checkVendorStatus, isLoading } = useVendorStore();

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/phone-input');
      return;
    }
    void checkVendorStatus(user.id).then(({ isVendor: approved }) => {
      if (!approved) router.replace('/(player)/profile');
    });
  }, [user?.id, checkVendorStatus]);

  if (!isVendor) {
    return <View className="flex-1 bg-[#10120F] items-center justify-center">{isLoading ? <Text className="text-[#E5E7E1]">Checking vendor verification…</Text> : null}</View>;
  }

  return (
    <View className="flex-1 bg-[#10120F]">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#10120F" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="grounds" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="earnings" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="add-ground" />
        <Stack.Screen name="ground-slots" />
        <Stack.Screen name="ground-slot-day" />
        <Stack.Screen name="setup-schedule" />
        <Stack.Screen name="ground-reviews" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="ground-verification" />
      </Stack>
      <VendorTabBar />
    </View>
  );
}
