import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatTime12 } from "@/lib/time";
import { appDialog } from "@/components/ui/app-dialog";
import { useAuthStore } from "@/store/authStore";
import { useVendorStore } from "@/store/vendorStore";
import {
  getVendorEarnings,
  Ground,
  listVendorGrounds,
} from "@/lib/api/vendors";
import { getNotifications } from "@/lib/api/notifications";
import { listVendorBookings } from "@/lib/api/bookings";
import { BookingProfile } from "@/types/booking";
import { Toast } from "@/components/ui/toast";

// Mock data to match the image exactly for the top performing grounds
const MOCK_GROUNDS_DATA = [
  {
    id: "1",
    title: "Green Valley Arena",
    subtitle: "Leader in bookings",
    price: "PKR 72,400",
    image: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=200",
  },
  {
    id: "2",
    title: "Camp Nou Turf",
    subtitle: "Leader in bookings",
    price: "PKR 54,000",
    image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=200",
  },
  {
    id: "3",
    title: "Apex Cricket Cage",
    subtitle: "Leader in bookings",
    price: "PKR 38,000",
    image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200",
  },
];

function OwnerHomeView({
  businessName,
  unread,
  today,
  week,
  month,
  attention,
  schedule,
  grounds,
}: {
  businessName: string;
  unread: number;
  today: number;
  week: number;
  month: number;
  attention: BookingProfile[];
  schedule: BookingProfile[];
  grounds: Ground[];
}) {
  const next = schedule[0];

  // Format currency to match image style
  const formatCurrency = (value: number) => {
    return `PKR ${value.toLocaleString()}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0F110E]">
      <StatusBar barStyle="light-content" backgroundColor="#0F110E" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 104 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="pt-4 flex-row justify-between items-start">
          <View>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#52C45D] text-[11px] tracking-widest"
            >
              TURF<Text className="text-[#F3F3EE]">BOOKPK</Text>{" "}
              <Text className="text-[#92978F]">OWNER</Text>
            </Text>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#F5F5F0] text-[26px] mt-1"
            >
              Good afternoon, {businessName}
            </Text>
            <Text className="text-[#92978F] text-xs mt-2">Bookings</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(vendor)/notifications")}
            className="h-11 w-11 rounded-full bg-[#1B1F19] border border-[#30372B] items-center justify-center"
          >
            <Ionicons name="notifications-outline" size={22} color="#F5F5F0" />
            {unread > 0 && (
              <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#E82851] rounded-full items-center justify-center border-2 border-[#0F110E]">
                <Text className="text-white text-[9px] font-bold">
                  {unread > 9 ? "9+" : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        <View className="mt-6 bg-[#1B1F19] border border-[#30372B] rounded-[24px] px-6 py-6 flex-row justify-between">
          {[
            {
              value: today,
              label: "Today",
              amount: "PKR 12,400",
              color: "#3EAF4C",
            },
            {
              value: week,
              label: "This Week",
              amount: "PKR 54,000",
              color: "#3EAF4C",
            },
            {
              value: month,
              label: "This Month",
              amount: "PKR 1,82,000",
              color: "#6B7269", // Greyish for the third one as per image
            },
          ].map((item, index) => (
            <View key={item.label} className="items-center flex-1">
              <View
                className="h-[75px] w-[75px] rounded-full border-[6px] items-center justify-center"
                style={{ borderColor: item.color }}
              >
                <Text
                  style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                  className="text-[#F5F5F0] text-[24px]"
                >
                  {item.value}
                </Text>
              </View>
              <Text
                style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                className="text-[#F5F5F0] text-[13px] mt-3"
              >
                {item.label}
              </Text>
              <Text className="text-[#92978F] text-[10px] mt-0.5">
                {item.amount}
              </Text>
            </View>
          ))}
        </View>

        {/* Action Required */}
        {attention.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/(vendor)/bookings")}
            className="mt-5 bg-[#1A1A14] border border-[#E6A600] rounded-[18px] p-4 flex-row items-center"
          >
            <Ionicons name="warning-outline" size={22} color="#F5A623" />
            <View className="flex-1 ml-3">
              <Text
                style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                className="text-[#F5F5F0] text-[13px]"
              >
                Action Required
              </Text>
              <Text className="text-[#B8A57A] text-[11px] mt-1 leading-4">
                {attention.length} refund request
                {attention.length === 1 ? "" : "s"} waiting for your response
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#F5A623" />
          </TouchableOpacity>
        )}

        {/* Next Booking / Schedule */}
        <TouchableOpacity
          onPress={() =>
            next
              ? router.push({
                  pathname: "/(vendor)/booking/[id]",
                  params: { id: next.id },
                })
              : router.push("/(vendor)/bookings")
          }
          className="mt-5 bg-[#1B1F19] border border-[#30372B] rounded-[18px] p-5"
        >
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={16} color="#F5A623" />
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#F5A623] text-[13px] ml-2"
            >
              {next
                ? `${formatTime12(next.start_time)} - ${formatTime12(next.end_time)}`
                : "NO BOOKINGS TODAY"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#92978F"
              style={{ marginLeft: "auto" }}
            />
          </View>
          <Text
            style={{ fontFamily: "SpaceGrotesk_700Bold" }}
            className="text-[#F5F5F0] text-[22px] mt-3"
          >
            {next?.ground_title || "Your schedule is clear"}
          </Text>
          <Text className="text-[#92978F] text-[11px] mt-1">
            {next
              ? `${next.player_name || "Player"} · ${formatCurrency(next.vendor_amount)}`
              : "New bookings will appear here."}
          </Text>
        </TouchableOpacity>

        {/* Top Performing Grounds */}
        <Text
          style={{ fontFamily: "SpaceGrotesk_700Bold" }}
          className="text-[#F5F5F0] text-[16px] mt-8 mb-4"
        >
          Top performing grounds
        </Text>

        {MOCK_GROUNDS_DATA.map((ground, index) => (
          <TouchableOpacity
            key={ground.id}
            onPress={() =>
              router.push({
                pathname: "/(vendor)/ground-slots",
                params: { id: ground.id, title: ground.title },
              })
            }
            className="bg-[#1B1F19] border border-[#30372B] rounded-[16px] p-3 mb-3 flex-row items-center"
          >
            <View className="h-6 w-6 rounded-full bg-[#252B24] items-center justify-center">
              <Text className="text-[#54C35F] text-[11px] font-bold">
                {index + 1}
              </Text>
            </View>
            <Image
              source={{ uri: ground.image }}
              className="w-12 h-12 rounded-[10px] ml-3"
            />
            <View className="flex-1 ml-3 justify-center">
              <Text
                style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                className="text-[#F5F5F0] text-[14px]"
                numberOfLines={1}
              >
                {ground.title}
              </Text>
              <Text className="text-[#92978F] text-[11px] mt-0.5">
                {ground.subtitle}
              </Text>
            </View>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#4FD05B] text-[13px]"
            >
              {ground.price}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color="#92978F"
              style={{ marginLeft: 8 }}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function VendorDashboard() {
  const { profile, signOut } = useAuthStore();
  const { vendorProfile } = useVendorStore();
  const [refreshing, setRefreshing] = useState(false);
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [todayBookings, setTodayBookings] = useState(0);
  const [weekBookings, setWeekBookings] = useState(0);
  const [monthBookings, setMonthBookings] = useState(0);
  const [todaySchedule, setTodaySchedule] = useState<BookingProfile[]>([]);
  const [attentionBookings, setAttentionBookings] = useState<BookingProfile[]>(
    [],
  );
  const [availableBalance, setAvailableBalance] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [items, notifications, bookings, earnings] = await Promise.all([
        listVendorGrounds(),
        getNotifications(),
        listVendorBookings(),
        getVendorEarnings(),
      ]);
      const today = new Date(Date.now() + 5 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      setGrounds(items);
      setUnreadNotifications(notifications.unread_count);
      const todayItems = bookings
        .filter(
          (booking) => booking.date === today && booking.status === "confirmed",
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      setTodayBookings(todayItems.length);
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const confirmed = bookings.filter(
        (booking) => booking.status === "confirmed",
      );
      setWeekBookings(
        confirmed.filter(
          (booking) =>
            new Date(`${booking.date}T12:00:00+05:00`) >= startOfWeek,
        ).length,
      );
      setMonthBookings(
        confirmed.filter(
          (booking) =>
            new Date(`${booking.date}T12:00:00+05:00`) >= startOfMonth,
        ).length,
      );
      setTodaySchedule(todayItems);
      setAttentionBookings(
        bookings.filter(
          (booking) =>
            booking.status === "pending_payment" ||
            booking.payment_status === "refund_pending",
        ),
      );
      setAvailableBalance(earnings.summary.available_to_withdraw);
    } catch (error: any) {
      setToast(error?.message || "Unable to refresh your overview.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const switchToPlayer = () =>
    appDialog.alert(
      "Switch to Player Mode",
      "You can return to this vendor workspace anytime from the player home screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Switch",
          onPress: async () => {
            const { error } = await useAuthStore.getState().switchToPlayer();
            if (error) appDialog.alert("Unable to switch modes", error.message);
            else router.replace("/(player)");
          },
        },
      ],
    );

  const confirmSignOut = () =>
    appDialog.alert(
      "Sign out?",
      "You will need to verify your phone number to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/(auth)/phone-input");
          },
        },
      ],
    );

  const businessName =
    vendorProfile?.business_name || profile?.full_name || "Imran";

  const legacyDashboard = (
    <SafeAreaView className="flex-1 bg-[#10120F]">
      <StatusBar barStyle="light-content" backgroundColor="#10120F" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor="#4CAF50"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4 flex-row items-start justify-between">
          <View className="flex-1 mr-3">
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#4FD05B] text-xs"
            >
              TURFBOOKPK <Text className="text-[#B2B5AF]">OWNER</Text>
            </Text>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[24px] text-[#F5F5F0] mt-1"
              numberOfLines={1}
            >
              {businessName}
            </Text>
            <View className="flex-row items-center mt-2">
              <Text className="text-[#AFAFA9] text-xs">Bookings</Text>
              <View className="bg-[#E8F5E9] rounded-full px-2.5 py-1">
                <Text className="text-[#2E7D32] text-xs font-bold">VENDOR</Text>
              </View>
              {vendorProfile?.is_verified === false && (
                <View className="bg-[#FEF3C7] rounded-full px-2.5 py-1 ml-2">
                  <Text className="text-[#92400E] text-xs font-bold">
                    VERIFICATION PENDING
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={
                unreadNotifications
                  ? `${unreadNotifications} unread notifications`
                  : "Notifications"
              }
              onPress={() => router.push("/(vendor)/notifications")}
              className="h-11 w-11 rounded-full bg-[#1B1F19] items-center justify-center border border-[#30372B]"
            >
              <Ionicons
                name="notifications-outline"
                size={21}
                color="#F5F5F0"
              />
              {unreadNotifications > 0 && (
                <View className="absolute right-0 top-0 min-w-[17px] h-[17px] px-1 rounded-full bg-[#DC2626] items-center justify-center">
                  <Text className="text-white text-[9px] font-bold">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="More account actions"
              onPress={() => router.push("/(vendor)/profile")}
              className="h-11 w-11 rounded-full bg-[#1B1F19] items-center justify-center border border-[#30372B]"
            >
              <Ionicons name="person-outline" size={21} color="#F5F5F0" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mx-5 mt-6 bg-[#1B1F19] border border-[#30372B] rounded-[22px] p-5">
          <View className="flex-row justify-between mb-5">
            <View className="items-center flex-1">
              <View className="h-[62px] w-[62px] rounded-full border-[5px] border-[#3EAF4C] items-center justify-center">
                <Text className="text-white text-xl font-bold">
                  {todayBookings}
                </Text>
              </View>
              <Text className="text-white text-xs font-bold mt-2">Today</Text>
            </View>
            <View className="items-center flex-1">
              <View className="h-[62px] w-[62px] rounded-full border-[5px] border-[#54B861] items-center justify-center">
                <Text className="text-white text-xl font-bold">
                  {weekBookings}
                </Text>
              </View>
              <Text className="text-white text-xs font-bold mt-2">
                This Week
              </Text>
            </View>
            <View className="items-center flex-1">
              <View className="h-[62px] w-[62px] rounded-full border-[5px] border-[#AEB4AC] items-center justify-center">
                <Text className="text-white text-xl font-bold">
                  {monthBookings}
                </Text>
              </View>
              <Text className="text-white text-xs font-bold mt-2">
                This Month
              </Text>
            </View>
          </View>
          <View className="hidden">
            <View>
              <Text className="text-white/70 text-sm">
                Available to withdraw
              </Text>
              <Text className="text-white text-3xl font-bold mt-1">
                PKR {availableBalance.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open earnings"
              onPress={() => router.replace("/(vendor)/earnings")}
              className="h-11 w-11 rounded-full bg-white/15 items-center justify-center"
            >
              <Ionicons name="arrow-forward" size={21} color="white" />
            </TouchableOpacity>
          </View>
          <View className="hidden">
            <View className="flex-1">
              <Text className="text-white/60 text-xs">TODAY’S BOOKINGS</Text>
              <Text className="text-white text-xl font-bold mt-1">
                {todayBookings}
              </Text>
            </View>
            <View className="flex-1 border-l border-white/15 pl-4">
              <Text className="text-white/60 text-xs">ACTIVE GROUNDS</Text>
              <Text className="text-white text-xl font-bold mt-1">
                {grounds.filter((ground) => ground.is_active).length}
              </Text>
            </View>
          </View>
        </View>

        {attentionBookings.length > 0 && (
          <TouchableOpacity
            onPress={() => router.replace("/(vendor)/bookings")}
            className="mx-5 mt-5 bg-[#211F16] border border-[#D79400] rounded-[18px] p-4 flex-row items-center"
          >
            <Ionicons name="warning-outline" size={23} color="#F5A623" />
            <View className="flex-1 ml-3">
              <Text
                style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                className="text-[#F5F5F0]"
              >
                Action Required
              </Text>
              <Text className="text-[#B8A57A] text-xs mt-1">
                {attentionBookings.length} refund or payment request
                {attentionBookings.length === 1 ? "" : "s"} waiting for your
                response
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#F5A623" />
          </TouchableOpacity>
        )}

        <View className="px-5 mt-5">
          <View className="hidden">
            <Text className="text-[#F5F5F0] text-lg font-bold">
              Today&apos;s schedule
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(vendor)/bookings")}
              className="min-h-[44px] px-2 justify-center"
            >
              <Text className="text-[#2E7D32] font-bold">View all</Text>
            </TouchableOpacity>
          </View>
          {todaySchedule.length ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(vendor)/booking/[id]",
                  params: { id: todaySchedule[0].id },
                })
              }
              className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-2"
            >
              <Text className="text-[#F5A623] text-xs font-bold">
                NEXT BOOKING
              </Text>
              <View className="flex-row justify-between mt-1">
                <View className="flex-1">
                  <Text className="text-[#F5F5F0] font-bold text-lg">
                    {formatTime12(todaySchedule[0].start_time)} ·{" "}
                    {todaySchedule[0].ground_title}
                  </Text>
                  <Text className="text-[#AFAFA9] text-sm mt-1">
                    {todaySchedule[0].player_name || "Player"} · PKR{" "}
                    {todaySchedule[0].vendor_amount.toLocaleString()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#4CAF50" />
              </View>
            </TouchableOpacity>
          ) : (
            <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-4 mt-2">
              <Text className="text-[#F5F5F0] font-bold">
                No confirmed bookings today
              </Text>
              <Text className="text-[#AFAFA9] text-sm mt-1">
                Your next player booking will appear here.
              </Text>
            </View>
          )}
          {false && attentionBookings.length > 0 && (
            <TouchableOpacity
              onPress={() => router.replace("/(vendor)/bookings")}
              className="bg-[#211F16] border border-[#D79400] rounded-2xl p-4 mt-5 flex-row items-center"
            >
              <Ionicons name="alert-circle-outline" size={23} color="#C56A00" />
              <View className="flex-1 ml-3">
                <Text className="text-[#9A3412] font-bold">
                  {attentionBookings.length} booking
                  {attentionBookings.length === 1 ? "" : "s"} need attention
                </Text>
                <Text className="text-[#9A3412] text-xs mt-1">
                  Pending payment or refund processing.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C56A00" />
            </TouchableOpacity>
          )}
        </View>

        <View className="hidden">
          <Text className="text-[#F5F5F0] text-lg font-bold">
            Manage your venue
          </Text>
          <Text className="text-[#AFAFA9] text-sm mt-1">
            The essentials, always one tap away.
          </Text>
          <View className="mt-4 gap-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open all grounds"
              onPress={() => router.replace("/(vendor)/grounds")}
              className="bg-white rounded-2xl p-4 border border-[#E5E5E5] flex-row items-center"
            >
              <View className="h-11 w-11 rounded-xl bg-[#E8F5E9] items-center justify-center">
                <Ionicons name="business-outline" size={22} color="#2E7D32" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[#1A1A2E] font-bold">All grounds</Text>
                <Text className="text-[#737373] text-xs mt-1">
                  Create, activate, edit, and manage slots
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open booking schedule"
              onPress={() => router.replace("/(vendor)/bookings")}
              className="bg-white rounded-2xl p-4 border border-[#E5E5E5] flex-row items-center"
            >
              <View className="h-11 w-11 rounded-xl bg-[#EFF6FF] items-center justify-center">
                <Ionicons name="calendar-outline" size={22} color="#2563EB" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[#1A1A2E] font-bold">
                  Booking schedule
                </Text>
                <Text className="text-[#737373] text-xs mt-1">
                  See today’s matches and take action
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open earnings and ledger"
              onPress={() => router.replace("/(vendor)/earnings")}
              className="bg-white rounded-2xl p-4 border border-[#E5E5E5] flex-row items-center"
            >
              <View className="h-11 w-11 rounded-xl bg-[#FFF7ED] items-center justify-center">
                <Ionicons name="wallet-outline" size={22} color="#C56A00" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-[#1A1A2E] font-bold">Booking income</Text>
                <Text className="text-[#737373] text-xs mt-1">
                  Booking income and transaction activity
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-5 mt-7">
          <View className="flex-row items-center justify-between">
            <Text className="text-[#F5F5F0] text-lg font-bold">
              Top performing grounds
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open all grounds"
              onPress={() => router.replace("/(vendor)/grounds")}
              className="min-h-[44px] px-2 items-center justify-center"
            >
              <Text className="text-[#2E7D32] font-bold text-sm">
                All grounds
              </Text>
            </TouchableOpacity>
          </View>
          {grounds.length === 0 ? (
            <View className="bg-[#1B1F19] rounded-2xl p-6 border border-[#30372B] items-center mt-3">
              <Ionicons name="business-outline" size={34} color="#9CA3AF" />
              <Text className="text-[#F5F5F0] font-bold mt-3">
                Add your first ground
              </Text>
              <Text className="text-[#AFAFA9] text-sm text-center mt-1">
                Once it is active, players can discover and book its slots.
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add a ground"
                onPress={() => router.push("/(vendor)/add-ground")}
                className="mt-4 min-h-[48px] px-5 rounded-xl bg-[#4CAF50] items-center justify-center"
              >
                <Text className="text-white font-bold">Add ground</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="mt-3 gap-2">
              {grounds.slice(0, 2).map((ground) => (
                <TouchableOpacity
                  key={ground.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Manage slots for ${ground.title}`}
                  onPress={() =>
                    router.push({
                      pathname: "/(vendor)/ground-slots",
                      params: { id: ground.id, title: ground.title },
                    })
                  }
                  className="bg-[#1B1F19] rounded-2xl p-4 border border-[#30372B] flex-row items-center"
                >
                  <View
                    className={`h-10 w-10 rounded-xl items-center justify-center ${ground.is_active ? "bg-[#E8F5E9]" : "bg-[#F3F4F6]"}`}
                  >
                    <Ionicons
                      name="football-outline"
                      size={20}
                      color={ground.is_active ? "#2E7D32" : "#6B7280"}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text
                      className="text-[#F5F5F0] font-bold"
                      numberOfLines={1}
                    >
                      {ground.title}
                    </Text>
                    <Text className="text-[#AFAFA9] text-xs mt-1">
                      {ground.is_active
                        ? "Visible to players"
                        : "Hidden from players"}{" "}
                      · Manage slots
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View className="px-5 mt-6 flex-row gap-3">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add a ground"
            onPress={() => router.push("/(vendor)/add-ground")}
            className="flex-1 min-h-[52px] rounded-xl bg-[#4CAF50] items-center justify-center"
          >
            <Text className="text-white font-bold">Add ground</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Switch to player mode"
            onPress={switchToPlayer}
            className="min-h-[52px] rounded-xl border border-[#4CAF50] px-4 flex-row items-center justify-center"
          >
            <Ionicons name="person-outline" size={18} color="#2E7D32" />
            <Text className="text-[#2E7D32] font-bold ml-2">Player view</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={confirmSignOut}
          className="self-center mt-5 min-h-[44px] px-4 items-center justify-center"
        >
          <Text className="text-[#DC2626] font-semibold">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );

  return (
    <OwnerHomeView
      businessName={businessName}
      unread={unreadNotifications}
      today={todayBookings}
      week={weekBookings}
      month={monthBookings}
      attention={attentionBookings}
      schedule={todaySchedule}
      grounds={grounds}
    />
  );
}