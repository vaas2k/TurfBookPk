import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Ground, searchPublicGrounds, Slot } from "@/lib/api/vendors";
import { Toast } from "@/components/ui/toast";
import * as Location from "expo-location";

type Sort = "recommended" | "price_low" | "price_high" | "rating";
const MAX_PRICE = 20_000;
const pakistanToday = () =>
  new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const distanceKm = (
  from: { latitude: number; longitude: number },
  ground: Ground,
): number | null => {
  if (ground.latitude === null || ground.longitude === null) return null;
  const rad = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(rad(ground.latitude - from.latitude) / 2) ** 2 +
    Math.cos(rad(from.latitude)) *
      Math.cos(rad(ground.latitude)) *
      Math.sin(rad(ground.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function queryMatches(ground: Ground, query: string) {
  if (!query.trim()) return true;
  return [
    ground.title,
    ground.city,
    ground.location,
    ground.address,
    ground.pitch_type,
    ...ground.amenities,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

export default function SearchScreen() {
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [slotsByGround, setSlotsByGround] = useState<Record<string, Slot[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(pakistanToday());
  const [dateInput, setDateInput] = useState(pakistanToday());
  const [pitchType, setPitchType] = useState("All");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [sort, setSort] = useState<Sort>("recommended");
  const [showFilters, setShowFilters] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(
    async (refresh = false, nextPage = 1) => {
      if (nextPage > 1) setLoadingMore(true);
      else if (refresh) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await searchPublicGrounds({
          q: query.trim() || undefined,
          pitch_type: pitchType === "All" ? undefined : pitchType,
          amenities: selectedAmenities,
          availability_date: selectedDate,
          max_price: maxPrice < MAX_PRICE ? maxPrice : undefined,
          sort,
          page: nextPage,
          limit: 12,
        });
        setGrounds((current) => nextPage === 1 ? result.grounds : [...current, ...result.grounds]);
        setSlotsByGround((current) => nextPage === 1 ? result.slots_by_ground : { ...current, ...result.slots_by_ground });
        setPage(nextPage); setHasMore(result.pagination.has_more); setLoadError(null);
      } catch (error: any) {
        const message = error?.message || "Unable to load grounds.";
        setLoadError(message); setToast(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [maxPrice, pitchType, query, selectedAmenities, selectedDate, sort],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 250);
    return () => clearTimeout(timer);
  }, [load]);
  const loadMore = () => { if (!loadingMore && !loading && hasMore) load(false, page + 1); };

  const pitchTypes = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          grounds
            .map((ground) => ground.pitch_type)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    ],
    [grounds],
  );
  const amenities = useMemo(
    () =>
      Array.from(new Set(grounds.flatMap((ground) => ground.amenities)))
        .sort()
        .slice(0, 16),
    [grounds],
  );
  const activeFilters =
    (pitchType !== "All" ? 1 : 0) +
    selectedAmenities.length +
    (maxPrice < MAX_PRICE ? 1 : 0);
  const results = useMemo(
    () =>
      grounds
        .map((ground) => {
          const availableSlots = (slotsByGround[ground.id] || []).filter(
            (slot) =>
              slot.date === selectedDate &&
              !slot.is_booked &&
              !slot.is_blocked &&
              !slot.is_held,
          );
          return {
            ground,
            availableSlots,
            lowestPrice: availableSlots.length
              ? Math.min(...availableSlots.map((slot) => slot.price))
              : null,
          };
        })
        .filter(
          ({ ground, availableSlots, lowestPrice }) =>
            queryMatches(ground, query) &&
            (pitchType === "All" || ground.pitch_type === pitchType) &&
            selectedAmenities.every((amenity) =>
              ground.amenities.includes(amenity),
            ) &&
            availableSlots.length > 0 &&
            lowestPrice !== null &&
            lowestPrice <= maxPrice,
        )
        .sort((a, b) =>
          sort === "price_low"
            ? a.lowestPrice! - b.lowestPrice!
            : sort === "price_high"
              ? b.lowestPrice! - a.lowestPrice!
              : sort === "rating"
                ? b.ground.rating - a.ground.rating
                : b.ground.rating - a.ground.rating ||
                  a.lowestPrice! - b.lowestPrice!,
        ),
    [
      grounds,
      slotsByGround,
      selectedDate,
      query,
      pitchType,
      selectedAmenities,
      maxPrice,
      sort,
    ],
  );
  if (userLocation) {
    results.sort((a, b) => {
      const aDistance = distanceKm(userLocation, a.ground);
      const bDistance = distanceKm(userLocation, b.ground);
      if (aDistance === null && bDistance === null) return 0;
      if (aDistance === null) return 1;
      if (bDistance === null) return -1;
      return aDistance - bDistance;
    });
  }
  const dates = [0, 1, 2].map((offset) => {
    const date = new Date(`${pakistanToday()}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  });
  const toggleAmenity = (item: string) =>
    setSelectedAmenities((items) =>
      items.includes(item)
        ? items.filter((value) => value !== item)
        : [...items, item],
    );
  const clear = () => {
    setQuery("");
    setPitchType("All");
    setSelectedAmenities([]);
    setMaxPrice(MAX_PRICE);
    setSort("recommended");
  };
  const chooseDate = (date: string) => {
    setSelectedDate(date);
    setDateInput(date);
  };
  const applyDate = () => {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateInput) ||
      Number.isNaN(new Date(`${dateInput}T00:00:00Z`).getTime())
    ) {
      setToast("Use a valid date in YYYY-MM-DD format.");
      return;
    }
    if (dateInput < pakistanToday()) {
      setToast("Choose today or a future date.");
      return;
    }
    setSelectedDate(dateInput);
  };
  const findMyLocation = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted")
        return setToast(
          "Allow location access to see your position and ground distances.",
        );
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setToast(
        "Unable to get your location. Check device location services and try again.",
      );
    } finally {
      setLocating(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <View className="bg-white px-5 pt-3 pb-4 border-b border-[#E5E5E5]">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-[#1A1A2E]">
              Find a ground
            </Text>
            <Text className="text-sm text-[#737373] mt-1">
              Search by venue, city, area, or amenity.
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Use my location"
            onPress={findMyLocation}
            disabled={locating}
            className="h-11 w-11 rounded-full bg-[#E8F5E9] items-center justify-center"
          >
            <Ionicons
              name={locating ? "hourglass-outline" : "locate-outline"}
              size={21}
              color="#2E7D32"
            />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center mt-4">
          <View className="flex-1 flex-row items-center bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl px-3 min-h-[50px]">
            <Ionicons name="search-outline" size={20} color="#737373" />
            <TextInput
              accessibilityLabel="Search grounds by city or location"
              value={query}
              onChangeText={setQuery}
              placeholder="City, area, venue..."
              placeholderTextColor="#9CA3AF"
              className="flex-1 ml-2 text-[#1A1A2E]"
              returnKeyType="search"
            />
            {!!query && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                onPress={() => setQuery("")}
                className="h-11 w-10 items-center justify-center"
              >
                <Ionicons name="close-circle" size={19} color="#737373" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open filters"
            onPress={() => setShowFilters((value) => !value)}
            className={`ml-3 h-[50px] w-[50px] rounded-xl items-center justify-center ${showFilters || activeFilters ? "bg-[#4CAF50]" : "bg-[#1A1A2E]"}`}
          >
            <Ionicons name="options-outline" size={22} color="white" />
            {activeFilters > 0 && (
              <View className="absolute -right-1 -top-1 bg-[#DC2626] h-5 min-w-5 rounded-full items-center justify-center">
                <Text className="text-white text-[10px] font-bold">
                  {activeFilters}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-[#4B5563] font-semibold mt-4 mb-2">
          AVAILABLE DATE
        </Text>
        <View className="flex-row items-center">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-1"
          >
            {dates.map((date, index) => (
              <TouchableOpacity
                key={date}
                onPress={() => chooseDate(date)}
                className={`mr-2 rounded-xl px-4 py-2.5 border ${selectedDate === date ? "bg-[#4CAF50] border-[#4CAF50]" : "bg-white border-[#E5E5E5]"}`}
              >
                <Text
                  className={
                    selectedDate === date
                      ? "text-white font-bold text-sm"
                      : "text-[#4B5563] font-medium text-sm"
                  }
                >
                  {index === 0
                    ? "Today"
                    : index === 1
                      ? "Tomorrow"
                      : new Date(`${date}T00:00:00Z`).toLocaleDateString(
                          "en-PK",
                          { weekday: "short", day: "numeric", month: "short" },
                        )}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            accessibilityLabel="Custom availability date"
            value={dateInput}
            onChangeText={setDateInput}
            onSubmitEditing={applyDate}
            onBlur={applyDate}
            placeholder="YYYY-MM-DD"
            className="ml-2 w-[108px] border border-[#E5E5E5] rounded-xl px-2 py-2 text-xs text-[#1A1A2E]"
          />
        </View>
      </View>
      {showFilters && (
        <ScrollView className="max-h-[330px] bg-white border-b border-[#E5E5E5] px-5 py-4">
          <View className="flex-row justify-between">
            <Text className="text-lg font-bold text-[#1A1A2E]">Filters</Text>
            <TouchableOpacity onPress={clear}>
              <Text className="text-[#2E7D32] font-bold">Clear all</Text>
            </TouchableOpacity>
          </View>
          <Text className="text-xs font-semibold text-[#4B5563] mt-4 mb-2">
            PITCH TYPE
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pitchTypes.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setPitchType(type)}
                className={`mr-2 px-4 py-2 rounded-full ${pitchType === type ? "bg-[#1A1A2E]" : "bg-[#F5F5F5]"}`}
              >
                <Text
                  className={
                    pitchType === type
                      ? "text-white text-sm font-bold"
                      : "text-[#4B5563] text-sm"
                  }
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View className="flex-row justify-between mt-4 mb-2">
            <Text className="text-xs font-semibold text-[#4B5563]">
              MAX SLOT PRICE
            </Text>
            <Text className="text-[#2E7D32] font-bold">
              PKR {maxPrice.toLocaleString()}
            </Text>
          </View>
          <View className="flex-row gap-2">
            {(
              [
                [2_000, "≤ 2,000"],
                [4_000, "≤ 4,000"],
                [MAX_PRICE, "Any"],
              ] as const
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setMaxPrice(value)}
                className={`flex-1 items-center rounded-lg py-2 ${maxPrice === value ? "bg-[#4CAF50]" : "bg-[#F5F5F5]"}`}
              >
                <Text
                  className={
                    maxPrice === value
                      ? "text-white font-bold"
                      : "text-[#4B5563]"
                  }
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {amenities.length > 0 && (
            <>
              <Text className="text-xs font-semibold text-[#4B5563] mt-4 mb-2">
                AMENITIES
              </Text>
              <View className="flex-row flex-wrap">
                {amenities.map((amenity) => (
                  <TouchableOpacity
                    key={amenity}
                    onPress={() => toggleAmenity(amenity)}
                    className={`mr-2 mb-2 px-3 py-2 rounded-full ${selectedAmenities.includes(amenity) ? "bg-[#E8F5E9] border border-[#4CAF50]" : "bg-[#F5F5F5]"}`}
                  >
                    <Text
                      className={
                        selectedAmenities.includes(amenity)
                          ? "text-[#2E7D32] text-xs font-bold"
                          : "text-[#4B5563] text-xs"
                      }
                    >
                      {amenity}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <Text className="text-xs font-semibold text-[#4B5563] mt-2 mb-2">
            SORT BY
          </Text>
          <View className="flex-row flex-wrap">
            {(
              [
                ["recommended", "Recommended"],
                ["price_low", "Lowest price"],
                ["price_high", "Highest price"],
                ["rating", "Top rated"],
              ] as [Sort, string][]
            ).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                onPress={() => setSort(value)}
                className={`mr-2 mb-2 px-3 py-2 rounded-full ${sort === value ? "bg-[#1A1A2E]" : "bg-[#F5F5F5]"}`}
              >
                <Text
                  className={
                    sort === value
                      ? "text-white text-xs font-bold"
                      : "text-[#4B5563] text-xs"
                  }
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
      <ScrollView
        className="flex-1 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: 104 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#4CAF50"
          />
        }
      >
        <Text className="text-[#737373] text-sm mb-3">
          {loading
            ? "Finding grounds..."
            : `${results.length} available ${results.length === 1 ? "ground" : "grounds"} on ${selectedDate}`}
        </Text>
        {loading ? (
          <ActivityIndicator className="mt-10" color="#4CAF50" />
        ) : loadError ? (
          <View className="bg-white border border-[#FECACA] rounded-2xl p-8 items-center mt-3"><Ionicons name="cloud-offline-outline" size={40} color="#DC2626" /><Text className="text-[#1A1A2E] font-bold text-lg mt-3">Couldn’t load grounds</Text><Text className="text-[#737373] text-center text-sm mt-2">Check your connection and try again.</Text><TouchableOpacity onPress={() => load()} className="mt-5 bg-[#1A1A2E] rounded-xl px-5 py-3"><Text className="text-white font-bold">Try again</Text></TouchableOpacity></View>
        ) : results.length === 0 ? (
          <View className="bg-white border border-[#E5E5E5] rounded-2xl p-8 items-center mt-3">
            <Ionicons name="search-outline" size={40} color="#9CA3AF" />
            <Text className="text-[#1A1A2E] font-bold text-lg mt-3">
              No matching availability
            </Text>
            <Text className="text-[#737373] text-center text-sm mt-2">
              Try another date, remove a filter, or search a different city or
              area.
            </Text>
            <TouchableOpacity
              onPress={clear}
              className="mt-5 bg-[#E8F5E9] rounded-xl px-5 py-3"
            >
              <Text className="text-[#2E7D32] font-bold">Clear filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>{results.map(({ ground, availableSlots, lowestPrice }) => (
            <TouchableOpacity
              key={ground.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${ground.title}`}
              onPress={() => router.push(`/(player)/ground/${ground.id}`)}
              className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden mb-4"
            >
              <Image
                source={{
                  uri:
                    ground.cover_image ||
                    ground.images[0] ||
                    "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800",
                }}
                className="h-36 w-full"
                resizeMode="cover"
              />
              <View className="p-4">
                <View className="flex-row justify-between">
                  <View className="flex-1 mr-3">
                    <Text
                      className="text-[#1A1A2E] font-bold text-lg"
                      numberOfLines={1}
                    >
                      {ground.title}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Ionicons
                        name="location-outline"
                        size={14}
                        color="#737373"
                      />
                      <Text
                        className="text-[#737373] text-sm ml-1"
                        numberOfLines={1}
                      >
                        {ground.location}, {ground.city}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text className="text-[#1A1A2E] text-sm font-bold ml-1">
                        {ground.rating.toFixed(1)}
                      </Text>
                    </View>
                    <Text className="text-[#737373] text-xs mt-1">
                      {ground.total_reviews} reviews
                    </Text>
                  </View>
                </View>
                <View className="flex-row justify-between items-end mt-4 pt-3 border-t border-[#F5F5F5]">
                  <View>
                    <Text className="text-[#4CAF50] font-bold">
                      From PKR {lowestPrice!.toLocaleString()}
                    </Text>
                    <Text className="text-[#737373] text-xs mt-1">
                      {availableSlots.length} slots available ·{" "}
                      {ground.pitch_type || "Turf"}
                    </Text>
                    {userLocation &&
                      distanceKm(userLocation, ground) !== null && (
                        <Text className="text-[#2E7D32] text-xs font-bold mt-1">
                          {distanceKm(userLocation, ground)!.toFixed(1)} km away
                        </Text>
                      )}
                  </View>
                  <View className="bg-[#4CAF50] rounded-full px-4 py-2">
                    <Text className="text-white text-xs font-bold">
                      View slots
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}{hasMore && <TouchableOpacity accessibilityRole="button" disabled={loadingMore} onPress={loadMore} className={`rounded-xl py-4 items-center mb-5 ${loadingMore ? 'bg-[#9CA3AF]' : 'bg-[#1A1A2E]'}`}><Text className="text-white font-bold">{loadingMore ? 'Loading more grounds...' : 'Load more grounds'}</Text></TouchableOpacity>}{!hasMore && results.length > 0 && <Text className="text-[#737373] text-center text-sm pb-4">You’ve reached the end of the results.</Text>}</>
        )}
      </ScrollView>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
