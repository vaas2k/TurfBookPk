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
import { useAuthStore } from "@/store/authStore";
import { useVendorStore } from "@/store/vendorStore";
import { Ground, listVendorGrounds } from "@/lib/api/vendors";
import { getNotifications } from "@/lib/api/notifications";
import { listVendorBookings } from "@/lib/api/bookings";
import { BookingProfile } from "@/types/booking";

function OwnerHomeView({
  businessName,
  unread,
  today,
  week,
  month,
  revenue,
  attention,
  schedule,
  grounds,
  bookings,
  refreshing,
  onRefresh,
}: {
  businessName: string;
  unread: number;
  today: number;
  week: number;
  month: number;
  revenue: { today: number; week: number; month: number };
  attention: BookingProfile[];
  schedule: BookingProfile[];
  grounds: Ground[];
  bookings: BookingProfile[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const next = schedule[0];

  // Format currency to match image style
  const formatCurrency = (value: number) => {
    return `PKR ${value.toLocaleString()}`;
  };
  const performance = grounds
    .map((ground) => {
      const groundBookings = bookings.filter(
        (booking) =>
          booking.ground_id === ground.id && booking.status === "confirmed",
      );
      const payout = groundBookings.reduce(
        (total, booking) => total + booking.vendor_amount,
        0,
      );
      return { ground, bookings: groundBookings.length, payout };
    })
    .sort(
      (left, right) =>
        right.payout - left.payout || right.bookings - left.bookings,
    )
    .slice(0, 3);

  return (
    <SafeAreaView className="flex-1 bg-[#0F110E]">
      <StatusBar barStyle="light-content" backgroundColor="#0F110E" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 104 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#52C45D"
            colors={["#52C45D"]}
          />
        }
      >
        {/* Header */}
        <View className="pt-4 flex-row justify-between items-start">
          <View className="flex-1 mr-3">
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
              numberOfLines={2}
            >
              Good afternoon, {businessName}
            </Text>
            <Text className="text-[#92978F] text-xs mt-2">Bookings</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(vendor)/notifications")}
            className="h-11 w-11 flex-shrink-0 rounded-full bg-[#1B1F19] border border-[#30372B] items-center justify-center"
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
              amount: formatCurrency(revenue.today),
              color: "#3EAF4C",
            },
            {
              value: week,
              label: "This Week",
              amount: formatCurrency(revenue.week),
              color: "#3EAF4C",
            },
            {
              value: month,
              label: "This Month",
              amount: formatCurrency(revenue.month),
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
              ? `${next.player_name || "Player"} Â· ${formatCurrency(next.vendor_amount)}`
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

        {performance.length === 0 ? (
          <View className="bg-[#1B1F19] border border-[#30372B] rounded-[16px] p-5 items-center">
            <Ionicons name="football-outline" size={26} color="#92978F" />
            <Text className="text-[#F5F5F0] font-bold mt-2">
              No grounds yet
            </Text>
            <Text className="text-[#92978F] text-xs mt-1">
              Create a ground to see its booking performance.
            </Text>
          </View>
        ) : (
          performance.map(
            ({ ground, bookings: groundBookings, payout }, index) => (
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
                  source={{
                    uri:
                      ground.cover_image ||
                      ground.images[0] ||
                      "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=200",
                  }}
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
                    {groundBookings
                      ? `${groundBookings} confirmed booking${groundBookings === 1 ? "" : "s"}`
                      : "No confirmed bookings yet"}
                  </Text>
                </View>
                <Text
                  style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                  className="text-[#4FD05B] text-[13px]"
                >
                  {formatCurrency(payout)}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="#92978F"
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            ),
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function VendorDashboard() {
  const { profile } = useAuthStore();
  const { vendorProfile } = useVendorStore();
  const [refreshing, setRefreshing] = useState(false);
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [todayBookings, setTodayBookings] = useState(0);
  const [weekBookings, setWeekBookings] = useState(0);
  const [monthBookings, setMonthBookings] = useState(0);
  const [bookingRevenue, setBookingRevenue] = useState({
    today: 0,
    week: 0,
    month: 0,
  });
  const [confirmedBookings, setConfirmedBookings] = useState<BookingProfile[]>(
    [],
  );
  const [todaySchedule, setTodaySchedule] = useState<BookingProfile[]>([]);
  const [attentionBookings, setAttentionBookings] = useState<BookingProfile[]>(
    [],
  );

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [items, notifications, bookings] = await Promise.all([
        listVendorGrounds(),
        getNotifications(),
        listVendorBookings(),
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
      setConfirmedBookings(confirmed);
      const inWeek = confirmed.filter(
        (booking) => new Date(`${booking.date}T12:00:00+05:00`) >= startOfWeek,
      );
      const inMonth = confirmed.filter(
        (booking) => new Date(`${booking.date}T12:00:00+05:00`) >= startOfMonth,
      );
      setBookingRevenue({
        today: todayItems.reduce(
          (total, booking) => total + booking.vendor_amount,
          0,
        ),
        week: inWeek.reduce(
          (total, booking) => total + booking.vendor_amount,
          0,
        ),
        month: inMonth.reduce(
          (total, booking) => total + booking.vendor_amount,
          0,
        ),
      });
      setWeekBookings(inWeek.length);
      setMonthBookings(inMonth.length);
      setTodaySchedule(todayItems);
      setAttentionBookings(
        bookings.filter(
          (booking) =>
            booking.status === "pending_payment" ||
            booking.payment_status === "refund_pending",
        ),
      );
    } catch {
      // Keep the last successful dashboard data visible on a transient failure.
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const businessName =
    vendorProfile?.business_name || profile?.full_name || "Imran";

  return (
    <OwnerHomeView
      businessName={businessName}
      unread={unreadNotifications}
      today={todayBookings}
      week={weekBookings}
      month={monthBookings}
      revenue={bookingRevenue}
      attention={attentionBookings}
      schedule={todaySchedule}
      grounds={grounds}
      bookings={confirmedBookings}
      refreshing={refreshing}
      onRefresh={load}
    />
  );
}
