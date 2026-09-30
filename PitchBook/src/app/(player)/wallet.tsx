import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getPlayerBookings, BookingProfile } from "@/lib/api/bookings";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppearanceStore } from "@/store/appearanceStore";
import { playerThemes } from "@/theme/playerTheme";

export default function WalletScreen() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const [bookings, setBookings] = useState<BookingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings((await getPlayerBookings(1, 50)).bookings);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const paid = bookings
    .filter((item) => item.payment_status === "paid")
    .reduce((sum, item) => sum + item.total_amount, 0);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1"
      style={{ backgroundColor: theme.canvas }}
    >
      <StatusBar
        barStyle={appearance === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.canvas}
      />
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace("/(player)/profile")}
          className="w-11 h-11 rounded-xl border items-center justify-center mr-3"
          style={{ borderColor: theme.border, backgroundColor: theme.surface }}
        >
          <Ionicons name="arrow-back" size={23} color={theme.text} />
        </TouchableOpacity>
        <Text
          style={{
            fontFamily: "BigShouldersDisplay_800ExtraBold",
            fontSize: 24,
            color: theme.text,
          }}
        >
          WALLET & PAYMENTS
        </Text>
      </View>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 32,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={theme.green}
          />
        }
        ListHeaderComponent={
          <View
            className="border rounded-[20px] p-5 mb-6"
            style={{
              backgroundColor: theme.businessSurface,
              borderColor: theme.businessBorder,
            }}
          >
            <Text style={{ color: theme.subtle }} className="text-sm">
              Total paid through TurfBookPK
            </Text>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.green }}
              className="text-[22px] mt-1"
            >
              PKR {paid.toLocaleString()}
            </Text>
            <Text style={{ color: theme.subtle }} className="text-xs mt-2">
              Payment history is based on confirmed bookings.
            </Text>
            <Text
              style={{
                fontFamily: "BigShouldersDisplay_700Bold",
                fontSize: 16,
                color: theme.muted,
              }}
              className="mt-7"
            >
              RECENT PAYMENTS
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.green} />
          ) : (
            <View className="items-center pt-16">
              <Ionicons name="card-outline" size={38} color={theme.green} />
              <Text style={{ color: theme.text }} className="font-bold mt-3">
                No payments yet
              </Text>
              <Text style={{ color: theme.subtle }} className="text-sm mt-1">
                Your paid booking history will appear here.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View
            className="rounded-[18px] px-4 py-4 mb-3 flex-row items-center"
            style={{ backgroundColor: theme.surface }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{
                backgroundColor:
                  item.payment_status === "paid"
                    ? theme.businessSurface
                    : "#FFF3D7",
              }}
            >
              <Ionicons
                name={
                  item.payment_status === "paid"
                    ? "checkmark-circle-outline"
                    : "time-outline"
                }
                size={21}
                color={item.payment_status === "paid" ? theme.green : "#B66B00"}
              />
            </View>
            <View className="flex-1 ml-3">
              <Text
                style={{ color: theme.text }}
                className="font-semibold"
                numberOfLines={1}
              >
                {item.ground_title}
              </Text>
              <Text style={{ color: theme.subtle }} className="text-xs mt-1">
                {item.date} • {item.payment_status.replaceAll("_", " ")}
              </Text>
            </View>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
            >
              PKR {item.total_amount.toLocaleString()}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
