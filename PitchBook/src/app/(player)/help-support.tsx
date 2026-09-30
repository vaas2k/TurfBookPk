import {
  Linking,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "@/lib/navigation";
import { appDialog } from "@/components/ui/app-dialog";
import { useAppearanceStore } from "@/store/appearanceStore";
import { playerThemes } from "@/theme/playerTheme";

export default function HelpSupportScreen() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const openSupport = () =>
    Linking.openURL(
      "mailto:support@turfbookpk.com?subject=TurfBookPK%20support",
    ).catch(() =>
      appDialog.alert(
        "Contact support",
        "Email support@turfbookpk.com for help.",
      ),
    );
  const row = (title: string, text: string) => (
    <View className="bg-[#20241D] rounded-[18px] p-4 mb-3">
      <Text className="text-[#F3F4EF] font-semibold text-base">{title}</Text>
      <Text className="text-[#AFAFA9] text-sm leading-5 mt-2">{text}</Text>
    </View>
  );
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
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="px-5 pt-3 pb-4 flex-row items-center">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(player)/profile")}
            className="w-11 h-11 rounded-xl border items-center justify-center mr-3"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons name="arrow-back" size={23} color={theme.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "BigShouldersDisplay_800ExtraBold",
              fontSize: 26,
              color: theme.text,
            }}
          >
            HELP & SUPPORT
          </Text>
        </View>
        <View className="px-5">
          <View
            className="border rounded-[20px] p-5"
            style={{
              backgroundColor: theme.businessSurface,
              borderColor: theme.businessBorder,
            }}
          >
            <Ionicons name="help-buoy-outline" size={30} color={theme.green} />
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
              className="text-lg mt-3"
            >
              How can we help?
            </Text>
            <Text
              style={{ color: theme.subtle }}
              className="text-sm leading-5 mt-1"
            >
              Get help with bookings, payments, cancellations, or your account.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={openSupport}
              className="rounded-full py-3 items-center mt-5"
              style={{ backgroundColor: theme.green }}
            >
              <Text className="text-white font-semibold">Contact support</Text>
            </TouchableOpacity>
          </View>
          <Text
            style={{
              fontFamily: "BigShouldersDisplay_700Bold",
              fontSize: 18,
              color: theme.muted,
            }}
            className="mt-7 mb-3"
          >
            COMMON QUESTIONS
          </Text>
          {[
            [
              "How do I cancel a booking?",
              "Open the booking from My Bookings and choose Cancel booking. The refund shown follows the venue cancellation policy.",
            ],
            [
              "Where is my payment history?",
              "Open Wallet & Payments in Profile to see payments from your booking history.",
            ],
            [
              "Why is a slot unavailable?",
              "Slots can be booked, blocked by the venue, or temporarily held while another player completes checkout.",
            ],
          ].map(([title, text]) => (
            <View
              key={title}
              className="rounded-[18px] p-4 mb-3"
              style={{ backgroundColor: theme.surface }}
            >
              <Text
                style={{ color: theme.text }}
                className="font-semibold text-base"
              >
                {title}
              </Text>
              <Text
                style={{ color: theme.subtle }}
                className="text-sm leading-5 mt-2"
              >
                {text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
