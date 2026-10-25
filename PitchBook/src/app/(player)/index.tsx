import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ImageBackground,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/store/authStore";
import { Ground, searchPublicGrounds } from "@/lib/api/vendors";
import { listRecentlyViewedGrounds } from "@/lib/api/engagement";
import { getNotifications } from "@/lib/api/notifications";
import * as Location from "expo-location";
import { useAppearanceStore } from "@/store/appearanceStore";
import { playerThemes } from "@/theme/playerTheme";
import { getHomeFeedCache, saveHomeFeedCache } from "@/lib/home-feed-cache";

type PlayerGround = ReturnType<typeof toPlayerGround>;

const homeBannerImages = [
  "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=85",
  "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=85",
  "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200&q=85",
];
const HOME_VOLATILE_REFRESH_MS = 15_000;

function distanceKm(
  from: { latitude: number; longitude: number },
  ground: Ground,
): number | null {
  if (ground.latitude === null || ground.longitude === null) return null;
  const radians = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(radians(ground.latitude - from.latitude) / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(ground.latitude)) *
      Math.sin(radians(ground.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toPlayerGround(ground: Ground, distance: number | null = null) {
  return {
    id: ground.id,
    name: ground.title,
    location: ground.location,
    price: ground.price_per_hour,
    rating: ground.rating,
    reviews: ground.total_reviews,
    slotsAvailable: ground.is_active ? 1 : 0,
    image:
      ground.cover_image ||
      ground.images[0] ||
      "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800",
    type: ground.pitch_type || "Turf",
    distance: distance === null ? "" : `${distance.toFixed(1)} km away`,
    distanceKm: distance,
    isAvailableNow: ground.is_active,
  };
}

export default function PlayerHome() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const { profile, user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [homeCity, setHomeCity] = useState(profile?.city || "Your area");
  const [todayGrounds, setTodayGrounds] = useState<PlayerGround[]>([]);
  const [recentGrounds, setRecentGrounds] = useState<Ground[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [homeInitialLoading, setHomeInitialLoading] = useState(true);
  const [homeLoadError, setHomeLoadError] = useState<string | null>(null);
  const lastVolatileRefreshAt = useRef(0);
  const hasLiveHomeFeed = useRef(false);

  useEffect(() => {
    const interval = setInterval(
      () =>
        setBannerIndex((current) => (current + 1) % homeBannerImages.length),
      4500,
    );
    return () => clearInterval(interval);
  }, []);

  const today = () =>
    new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void getHomeFeedCache(user.id, today()).then((cached) => {
      if (!active || !cached || hasLiveHomeFeed.current) return;
      // Cached cards make the first paint immediate. Availability is replaced
      // by the live request below and is never used for booking decisions.
      setTodayGrounds(cached.grounds);
      setRecentGrounds(cached.recent);
      setHomeCity(cached.city || profile?.city || "Your area");
      setHomeInitialLoading(false);
    });
    return () => {
      active = false;
    };
  }, [profile?.city, user?.id]);

  const loadHome = useCallback(
    async (showRefreshIndicator = true) => {
      if (showRefreshIndicator) setRefreshing(true);
      setHomeLoadError(null);
      let position: { latitude: number; longitude: number } | null = null;
      try {
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          const result = permission.granted
            ? permission
            : await Location.requestForegroundPermissionsAsync();
          if (result.granted) {
            const current = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            position = {
              latitude: current.coords.latitude,
              longitude: current.coords.longitude,
            };
            const place = (
              await Location.reverseGeocodeAsync(current.coords)
            )[0];
            setHomeCity(
              place?.city ||
                place?.subregion ||
                place?.district ||
                place?.region ||
                profile?.city ||
                "Your area",
            );
          } else {
            setHomeCity(profile?.city || "Your area");
          }
        } catch {
          // Discovery remains useful when GPS is off or unavailable (including emulators).
          setHomeCity(profile?.city || "Your area");
        }
        const discovery = await searchPublicGrounds({
          availability_date: today(),
          page: 1,
          limit: 30,
          sort: "recommended",
        });
        const [notifications, viewed] = await Promise.all([
          getNotifications().catch(() => null),
          listRecentlyViewedGrounds().catch(() => null),
        ]);
        if (notifications) setUnreadNotifications(notifications.unread_count);
        if (viewed) setRecentGrounds(viewed);
        const current = discovery.grounds
          .map((ground) => {
            const availableToday = (
              discovery.slots_by_ground[ground.id] || []
            ).filter(
              (slot) =>
                slot.date === today() &&
                !slot.is_booked &&
                !slot.is_blocked &&
                !slot.is_held,
            ).length;
            return {
              ...toPlayerGround(
                ground,
                position ? distanceKm(position, ground) : null,
              ),
              slotsAvailable: availableToday,
              isAvailableNow: availableToday > 0,
            };
          });
        current.sort((a, b) =>
          a.distanceKm === null
            ? 1
            : b.distanceKm === null
              ? -1
              : a.distanceKm - b.distanceKm,
        );
        setTodayGrounds(current);
        hasLiveHomeFeed.current = true;
        lastVolatileRefreshAt.current = Date.now();
        if (user?.id) {
          void saveHomeFeedCache({
            userId: user.id,
            date: today(),
            city: homeCity,
            grounds: current,
            recent: viewed || [],
          });
        }
      } catch {
        setHomeLoadError(
          "We could not refresh nearby grounds. Check your connection and try again.",
        );
      } finally {
        setHomeInitialLoading(false);
        if (showRefreshIndicator) setRefreshing(false);
      }
    },
    [homeCity, profile?.city, user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      // Ground availability, unread notifications, and recent activity are
      // volatile. Keep the current UI for quick tab changes, then revalidate
      // those values after a brief freshness window without showing a spinner.
      if (
        Date.now() - lastVolatileRefreshAt.current >=
        HOME_VOLATILE_REFRESH_MS
      ) {
        void loadHome(false);
      }
    }, [loadHome]),
  );

  const compactNearbyCard = (ground: PlayerGround) => (
    <TouchableOpacity
      key={ground.id}
      onPress={() =>
        router.push({
          pathname: "/(player)/ground/[id]",
          params: { id: ground.id },
        })
      }
      activeOpacity={0.86}
      className="border rounded-[16px] overflow-hidden flex-row mb-3"
      style={{
        backgroundColor: theme.surfaceRaised,
        borderColor: theme.border,
      }}
    >
      <Image
        source={{ uri: ground.image }}
        className="w-[124px] h-[126px]"
        resizeMode="cover"
      />
      <View className="flex-1 px-3 py-3 justify-between">
        <View>
          <Text
            style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
            className="text-[15px]"
            numberOfLines={1}
          >
            {ground.name}
          </Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="location-outline" size={13} color="#E27A3F" />
            <Text
              style={{ color: theme.subtle }}
              className="text-[11px] ml-1 flex-1"
              numberOfLines={1}
            >
              {ground.location}
            </Text>
          </View>
        </View>
        <View className="flex-row items-end justify-between">
          <View>
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.green }}
              className="text-sm"
            >
              PKR {ground.price}/hr
            </Text>
            <Text
              style={{ color: theme.subtle }}
              className="text-[10px] mt-0.5"
            >
              {ground.distance ||
                (ground.slotsAvailable > 0
                  ? `${ground.slotsAvailable} slots today`
                  : "No slots left today")}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={19} color="#53B65B" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const redesignedHome = (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.canvas }}>
      <StatusBar
        barStyle={appearance === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.canvas}
      />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadHome}
            tintColor="#53B65B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={20} color="#E27A3F" />
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold", color: theme.text }}
              className="ml-1"
              numberOfLines={1}
            >
              {homeCity}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.text} />
          </View>
          <TouchableOpacity
            className="w-11 h-11 rounded-full items-center justify-center border"
            style={{
              backgroundColor: theme.surfaceRaised,
              borderColor: theme.border,
            }}
            onPress={() => router.push("/(player)/notifications")}
          >
            <Ionicons
              name="notifications-outline"
              size={21}
              color={theme.text}
            />
            {unreadNotifications > 0 && (
              <View className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] items-center justify-center">
                <Text className="text-white text-[9px] font-bold">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <ImageBackground
          source={{ uri: homeBannerImages[bannerIndex] }}
          imageStyle={{ borderRadius: 24 }}
          className="mx-5 mt-2 p-5 rounded-[24px] min-h-[205px] overflow-hidden justify-end"
        >
          <View className="absolute inset-0 bg-[#102414]/75" />
          <View className="absolute top-4 right-4 flex-row">
            {homeBannerImages.map((_, index) => (
              <View
                key={index}
                className={`h-1.5 rounded-full ml-1 ${index === bannerIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </View>
          <Text
            style={{
              fontFamily: "BigShouldersDisplay_800ExtraBold",
              fontSize: 30,
            }}
            className="text-white"
          >
            BOOK YOUR NEXT MATCH
          </Text>
          <Text className="text-[#D3EBD4] text-sm mt-1 w-3/4">
            Discover pitches near you and check their upcoming availability.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(player)/search")}
            className="mt-5 self-start bg-[#F3F4EF] rounded-full px-4 py-2.5 flex-row items-center"
          >
            <Text
              style={{ fontFamily: "SpaceGrotesk_700Bold" }}
              className="text-[#1A2B1B] text-xs"
            >
              EXPLORE GROUNDS
            </Text>
            <Ionicons
              name="arrow-forward"
              size={15}
              color="#1A2B1B"
              style={{ marginLeft: 7 }}
            />
          </TouchableOpacity>
        </ImageBackground>
        <View className="mt-7 px-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text
              style={{
                fontFamily: "BigShouldersDisplay_800ExtraBold",
                fontSize: 24,
                color: theme.text,
              }}
            >
              NEAR YOU
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(player)/nearby-grounds")}
            >
              <Text
                style={{
                  fontFamily: "SpaceGrotesk_700Bold",
                  color: theme.green,
                }}
                className="text-xs"
              >
                SEE ALL
              </Text>
            </TouchableOpacity>
          </View>
          {homeInitialLoading && todayGrounds.length === 0 ? (
            <View
              accessibilityLabel="Loading nearby grounds"
              accessibilityRole="progressbar"
            >
              {[0, 1, 2].map((item) => (
                <View
                  key={item}
                  className="border rounded-[16px] overflow-hidden flex-row mb-3"
                  style={{
                    backgroundColor: theme.surfaceRaised,
                    borderColor: theme.border,
                  }}
                >
                  <View
                    className="w-[124px] h-[126px]"
                    style={{ backgroundColor: theme.businessSurface }}
                  />
                  <View className="flex-1 px-3 py-4 justify-between">
                    <View>
                      <View
                        className="h-4 w-3/4 rounded-full"
                        style={{ backgroundColor: theme.businessSurface }}
                      />
                      <View
                        className="h-3 w-1/2 rounded-full mt-3"
                        style={{ backgroundColor: theme.businessSurface }}
                      />
                    </View>
                    <View
                      className="h-3 w-1/3 rounded-full"
                      style={{ backgroundColor: theme.businessSurface }}
                    />
                  </View>
                </View>
              ))}
              <Text
                style={{ color: theme.subtle }}
                className="text-center text-xs mt-1"
              >
                Finding grounds near you...
              </Text>
            </View>
          ) : (
            todayGrounds.slice(0, 3).map(compactNearbyCard)
          )}
          {todayGrounds.length === 0 &&
            !homeInitialLoading &&
            !refreshing &&
            (homeLoadError ? (
              <View
                className="border rounded-2xl p-5 items-center"
                style={{
                  backgroundColor: theme.surfaceRaised,
                  borderColor: "#DC6262",
                }}
                accessibilityRole="alert"
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={28}
                  color="#DC6262"
                />
                <Text
                  style={{ color: theme.text }}
                  className="font-semibold text-center mt-2"
                >
                  Could not load nearby grounds
                </Text>
                <Text
                  style={{ color: theme.subtle }}
                  className="text-xs text-center mt-1"
                >
                  {homeLoadError}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading nearby grounds"
                  onPress={() => void loadHome(true)}
                  className="min-h-[44px] justify-center px-5 mt-3 rounded-xl"
                  style={{ backgroundColor: theme.green }}
                >
                  <Text className="text-white font-bold">Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text
                style={{ color: theme.subtle }}
                className="text-sm text-center py-6"
              >
                No approved grounds were found near you.
              </Text>
            ))}
        </View>
        <View className="mt-7 pb-9">
          <View className="px-5 flex-row items-center justify-between mb-3">
            <Text
              style={{
                fontFamily: "BigShouldersDisplay_800ExtraBold",
                fontSize: 24,
                color: theme.text,
              }}
            >
              RECENTLY VIEWED
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(player)/recently-viewed")}
            >
              <Text
                style={{
                  fontFamily: "SpaceGrotesk_700Bold",
                  color: theme.green,
                }}
                className="text-xs"
              >
                SEE ALL
              </Text>
            </TouchableOpacity>
          </View>
          {recentGrounds.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}
            >
              {recentGrounds.slice(0, 6).map((ground) => (
                <TouchableOpacity
                  key={ground.id}
                  onPress={() =>
                    router.push({
                      pathname: "/(player)/ground/[id]",
                      params: { id: ground.id },
                    })
                  }
                  className="w-[180px] mr-3 bg-[#1A1C16] border border-[#293B29] rounded-[16px] overflow-hidden"
                >
                  <Image
                    source={{
                      uri:
                        ground.cover_image ||
                        ground.images[0] ||
                        "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800",
                    }}
                    className="w-full h-[105px]"
                    resizeMode="cover"
                  />
                  <View className="p-3">
                    <Text
                      style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                      className="text-[#F8F7F0] text-sm"
                      numberOfLines={1}
                    >
                      {ground.title}
                    </Text>
                    <Text
                      className="text-[#AFAFA9] text-[11px] mt-1"
                      numberOfLines={1}
                    >
                      {ground.location}
                    </Text>
                    <Text className="text-[#53B65B] text-xs mt-2">
                      PKR {ground.price_per_hour}/hr
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View className="mx-5 bg-[#1A1C16] border border-[#293B29] rounded-2xl px-4 py-5 flex-row items-center">
              <Ionicons name="time-outline" size={22} color="#61BD67" />
              <Text className="text-[#B8B9B2] text-xs ml-3 flex-1">
                Grounds you open will appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  return redesignedHome;
}
