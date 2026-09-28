import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteGround,
  getVendorGrounds,
  Ground,
  listGroundSlots,
  Slot,
  updateGround,
} from "@/lib/api/vendors";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";
import { appDialog } from "@/components/ui/app-dialog";
import { listVendorBookings } from "@/lib/api/bookings";
import { BookingProfile } from "@/types/booking";

export default function VendorGrounds() {
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Ground | null>(null);
  const [updatingGroundId, setUpdatingGroundId] = useState<string | null>(null);
  const [deletingGroundId, setDeletingGroundId] = useState<string | null>(null);
  const [slotsByGround, setSlotsByGround] = useState<Record<string, Slot[]>>(
    {},
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [weeklyBookings, setWeeklyBookings] = useState<
    Record<string, BookingProfile[]>
  >({});

  const loadGrounds = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [result, bookings] = await Promise.all([
        getVendorGrounds(1),
        listVendorBookings(),
      ]);
      const items = result.grounds;
      setGrounds(items);
      setPage(1);
      setHasMore(result.pagination.has_more);
      const slotEntries = await Promise.all(
        items.map(
          async (ground) =>
            [ground.id, await listGroundSlots(ground.id)] as const,
        ),
      );
      setSlotsByGround(Object.fromEntries(slotEntries));
      const start = new Date();
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      const grouped: Record<string, BookingProfile[]> = {};
      bookings
        .filter(
          (booking) =>
            booking.status === "confirmed" &&
            new Date(`${booking.date}T12:00:00+05:00`) >= start,
        )
        .forEach((booking) => {
          (grouped[booking.ground_id] ||= []).push(booking);
        });
      setWeeklyBookings(grouped);
    } catch (error: any) {
      const message = error?.message || "Unable to load your grounds.";
      setLoadError(message);
      setToast(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await getVendorGrounds(page + 1);
      const slotEntries = await Promise.all(
        result.grounds.map(
          async (ground) =>
            [ground.id, await listGroundSlots(ground.id)] as const,
        ),
      );
      setGrounds((current) => [...current, ...result.grounds]);
      setSlotsByGround((current) => ({
        ...current,
        ...Object.fromEntries(slotEntries),
      }));
      setPage(result.pagination.page);
      setHasMore(result.pagination.has_more);
    } catch (error: any) {
      setToast(error?.message || "Unable to load more grounds.");
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, page]);

  useEffect(() => {
    loadGrounds();
  }, [loadGrounds]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingGroundId(pendingDelete.id);
    try {
      const result = await deleteGround(pendingDelete.id);
      setPendingDelete(null);
      await loadGrounds();
      setToast(result.deleted ? "Ground permanently deleted." : result.message || "Ground archived because it has booking history.");
    } catch (error: any) {
      setPendingDelete(null);
      setToast(error?.message || "Unable to delete ground.");
    } finally {
      setDeletingGroundId(null);
    }
  };

  const setGroundActive = async (ground: Ground, isActive: boolean) => {
    setUpdatingGroundId(ground.id);
    try {
      await updateGround(ground.id, { is_active: isActive });
      await loadGrounds();
      setToast(
        isActive
          ? "Ground activated and visible to players."
          : "Ground deactivated and hidden from players.",
      );
    } catch (error: any) {
      setToast(error?.message || "Unable to change ground availability.");
    } finally {
      setUpdatingGroundId(null);
    }
  };

  const confirmGroundAvailability = (ground: Ground) => {
    const willActivate = !ground.is_active;
    appDialog.alert(
      willActivate ? "Activate ground?" : "Deactivate ground?",
      willActivate
        ? "Players will be able to find and book this ground."
        : "Players will no longer be able to find or book this ground. Existing bookings remain visible.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: willActivate ? "Activate" : "Deactivate",
          style: willActivate ? "default" : "destructive",
          onPress: () => setGroundActive(ground, willActivate),
        },
      ],
    );
  };

  const renderGround = ({ item: ground }: { item: Ground }) => {
    const week = weeklyBookings[ground.id] || [];
    const booked = week.length;
    const earned = week.reduce(
      (total, booking) => total + booking.vendor_amount,
      0,
    );

    const today = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todaySlots = (slotsByGround[ground.id] || []).filter((slot) => slot.date === today);
    const bookedToday = todaySlots.filter((slot) => slot.is_booked).length;
    return <View className="bg-[#1B1F19] border border-[#30372B] rounded-[18px] p-5 mb-4"><View className="flex-row"><Image source={{ uri: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=300' }} className="h-16 w-16 rounded-xl" resizeMode="cover" /><View className="flex-1 ml-3"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0] text-[18px]" numberOfLines={1}>{ground.title}</Text><Text className="text-[#92978F] text-sm mt-0.5" numberOfLines={1}>{ground.location || ground.city}</Text><Text className={ground.is_active ? 'text-[#57CC63] text-xs font-bold mt-2' : 'text-[#B0B4AD] text-xs font-bold mt-2'}>{ground.is_active ? 'LIVE — players can book' : 'HIDDEN — players cannot book'}</Text></View></View><View className="flex-row mt-4"><View className="flex-1 bg-[#252A22] rounded-xl p-3 mr-2"><Text className="text-[#92978F] text-xs">TODAY</Text><Text className="text-[#F5F5F0] font-bold mt-1">{bookedToday} of {todaySlots.length} booked</Text></View><View className="flex-1 bg-[#252A22] rounded-xl p-3"><Text className="text-[#92978F] text-xs">THIS WEEK</Text><Text className="text-[#F5F5F0] font-bold mt-1">{booked} bookings · PKR {earned.toLocaleString()}</Text></View></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Manage calendar and slots for ${ground.title}`} onPress={() => router.push({ pathname: '/(vendor)/ground-slots', params: { id: ground.id, title: ground.title } })} className="bg-[#42B84F] rounded-xl min-h-[50px] mt-4 items-center justify-center"><Text className="text-[#102110] font-bold">Manage calendar & daily slots</Text></TouchableOpacity><View className="flex-row mt-3"><TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(vendor)/add-ground', params: { id: ground.id } })} className="flex-1 min-h-[44px] border border-[#30372B] rounded-xl items-center justify-center mr-2"><Text className="text-[#D9DBD5] font-bold text-sm">Edit ground</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(vendor)/ground-reviews', params: { id: ground.id, title: ground.title, rating: String(ground.rating), count: String(ground.total_reviews) } })} className="flex-1 min-h-[44px] border border-[#30372B] rounded-xl items-center justify-center"><Text className="text-[#D9DBD5] font-bold text-sm">Reviews ({ground.total_reviews})</Text></TouchableOpacity></View><TouchableOpacity accessibilityRole="button" onPress={() => appDialog.alert(ground.title, 'Choose an action for this ground.', [{ text: ground.is_active ? 'Hide from players' : 'Make visible to players', onPress: () => confirmGroundAvailability(ground) }, { text: 'Delete or archive', style: 'destructive', onPress: () => setPendingDelete(ground) }, { text: 'Cancel', style: 'cancel' }])} className="self-center min-h-[40px] px-4 justify-center"><Text className="text-[#92978F] text-sm">More ground actions</Text></TouchableOpacity></View>;
    return <View className="bg-[#1B1F19] border border-[#30372B] rounded-[18px] p-5 mb-4"><View className="flex-row"><Image source={{ uri: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=300' }} className="h-16 w-16 rounded-xl" resizeMode="cover" /><View className="flex-1 ml-3"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0] text-[18px]" numberOfLines={1}>{ground.title}</Text><Text className="text-[#92978F] text-sm mt-0.5" numberOfLines={1}>{ground.location || ground.city}</Text><View className={`self-start px-2 py-0.5 rounded mt-1 ${ground.is_active ? 'bg-[#1B3B20]' : 'bg-[#383B35]'}`}><Text className={`text-xs font-bold ${ground.is_active ? 'text-[#55C561]' : 'text-[#B0B4AD]'}`}>{ground.is_active ? 'Live' : 'Draft'}</Text></View></View><TouchableOpacity onPress={() => router.push({ pathname: '/(vendor)/add-ground', params: { id: ground.id } })} className="h-10 w-10 rounded-full bg-[#30352C] items-center justify-center"><Ionicons name="create-outline" size={21} color="#F5F5F0" /></TouchableOpacity></View><View className="flex-row items-center mt-4"><Ionicons name="star" size={17} color="#F5A623" /><Text className="text-[#F5A623] text-lg">★★★★</Text><Ionicons name="star-outline" size={17} color="#8E938C" /><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0] text-sm ml-2">{ground.rating.toFixed(1)}</Text><Text className="text-[#92978F] text-sm ml-2">({ground.total_reviews} reviews)</Text></View><TouchableOpacity onPress={() => router.push({ pathname: '/(vendor)/ground-reviews', params: { id: ground.id, title: ground.title, rating: String(ground.rating), count: String(ground.total_reviews) } })} className="mt-3 self-start min-h-[36px] justify-center"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#50C15B] text-sm">View Reviews  ›</Text></TouchableOpacity><View className="h-px bg-[#30372B] mt-2" /><TouchableOpacity onPress={() => router.push({ pathname: '/(vendor)/ground-slots', params: { id: ground.id, title: ground.title } })} className="flex-row items-center justify-between pt-4"><Text className="text-[#F5F5F0] text-sm">{bookedToday} of {todaySlots.length} slots booked today</Text><Ionicons name="chevron-forward" size={21} color="#50C15B" /></TouchableOpacity><TouchableOpacity onPress={() => appDialog.alert(ground.title, 'Choose an action for this ground.', [{ text: ground.is_active ? 'Deactivate' : 'Activate', onPress: () => confirmGroundAvailability(ground) }, { text: 'Delete', style: 'destructive', onPress: () => setPendingDelete(ground) }, { text: 'Cancel', style: 'cancel' }])} className="absolute bottom-3 right-12 h-8 w-8 items-center justify-center"><Ionicons name="ellipsis-horizontal" size={17} color="#92978F" /></TouchableOpacity></View>;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/(vendor)/ground-slots",
            params: { id: ground.id, title: ground.title },
          })
        }
        className="bg-[#1B1F19] border border-[#30372B] rounded-[20px] overflow-hidden mb-5"
      >
        {/* Image Section */}
        <View className="relative">
          <Image
            source={{
              uri:
                ground.cover_image ||
                ground.images[0] ||
                "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800",
            }}
            className="w-full h-[160px]"
            resizeMode="cover"
          />
          {/* Status Badge */}
          <View
            className={`absolute top-3 left-3 px-3 py-1.5 rounded-full flex-row items-center ${
              ground.is_active ? "bg-[#1A261B]" : "bg-[#31342F]"
            }`}
          >
            <View
              className={`h-2 w-2 rounded-full mr-1.5 ${
                ground.is_active ? "bg-[#3EAF4C]" : "bg-[#AFAFA9]"
              }`}
            />
            <Text className="text-[#F5F5F0] text-[11px] font-bold">
              {ground.is_active ? "Live" : "Draft"}
            </Text>
          </View>
        </View>

        {/* Content Section */}
        <View className="p-4">
          <Text
            style={{ fontFamily: "SpaceGrotesk_700Bold" }}
            className="text-[#F5F5F0] text-[18px]"
            numberOfLines={1}
          >
            {ground.title}
          </Text>
          <Text className="text-[#AFAFA9] text-[12px] mt-1">
            {ground.location || `${ground.city}, Pakistan`}
          </Text>

          {/* Stats Row */}
          <View className="flex-row items-center mt-3 pt-3 border-t border-[#30372B]">
            <Ionicons name="stats-chart-outline" size={16} color="#4FD05B" />
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#E9EAE5] text-[13px] ml-2"
            >
              {booked} booking{booked === 1 ? "" : "s"} this week · Rs{" "}
              {earned.toLocaleString()} earned
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#10120F]">
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-4">
            <Text
              style={{
                fontFamily: "SpaceGrotesk_700Bold",
                fontSize: 28,
                letterSpacing: -0.5,
              }}
              className="text-[#F5F5F0]"
            >
              MY GROUNDS
            </Text>
            <Text className="text-[#AFAFA9] text-[13px] mt-1">
              Manage your venues & bookings
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Add ground"
            className="bg-[#1B1F19] rounded-[14px] h-12 w-12 items-center justify-center border border-[#30372B]"
            onPress={() => router.push("/(vendor)/add-ground")}
          >
            <Ionicons name="add" size={24} color="#4FD05B" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        className="flex-1 px-6"
        data={grounds}
        keyExtractor={(ground) => ground.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadGrounds}
            tintColor="#4CAF50"
          />
        }
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1, paddingTop: 8 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator className="mt-8" color="#4CAF50" />
          ) : loadError ? (
            <View className="items-center rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-6 py-10">
              <Ionicons
                name="cloud-offline-outline"
                size={42}
                color="#DC2626"
              />
              <Text className="mt-3 text-center text-lg font-bold text-[#991B1B]">
                Could not load your grounds
              </Text>
              <Text className="mt-1 text-center text-sm text-[#B91C1C]">
                Check your connection, then try again.
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Retry loading grounds"
                onPress={loadGrounds}
                className="mt-5 min-h-11 rounded-xl bg-[#DC2626] px-5 justify-center"
              >
                <Text className="font-bold text-white">Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center py-20">
              <Ionicons name="business-outline" size={48} color="#D4D4D4" />
              <Text className="text-[#737373] mt-3">No grounds yet</Text>
            </View>
          )
        }
        renderItem={renderGround}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Load more grounds"
              disabled={loadingMore}
              onPress={loadMore}
              className={`rounded-xl py-3 items-center mb-6 ${
                loadingMore ? "bg-[#A3A3A3]" : "bg-[#E8F5E9]"
              }`}
            >
              <Text className="text-[#2E7D32] font-bold">
                {loadingMore ? "Loading grounds..." : "Load more grounds"}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={Boolean(pendingDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-8">
          <View className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-6 w-full">
            <Text className="text-xl font-bold text-[#F5F5F0]">
              Delete ground?
            </Text>
            <Text className="text-[#AFAFA9] mt-2">
              Grounds without bookings are permanently deleted. Grounds with booking history are archived so records stay accurate.
            </Text>
            <View className="flex-row justify-end mt-6">
              <TouchableOpacity
                disabled={Boolean(deletingGroundId)}
                onPress={() => setPendingDelete(null)}
                className="px-4 py-3"
              >
                <Text className="text-[#AFAFA9] font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={Boolean(deletingGroundId)}
                onPress={handleDelete}
                className={`rounded-xl px-4 py-3 ${
                  deletingGroundId ? "bg-[#9CA3AF]" : "bg-[#DC2626]"
                }`}
              >
                <Text className="text-white font-bold">
                  {deletingGroundId ? "Deleting..." : "Delete"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
