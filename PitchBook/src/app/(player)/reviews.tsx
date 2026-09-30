import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  GroundReview,
  listGroundReviews,
  reportReview,
} from "@/lib/api/reviews";
import { goBackOrReplace } from "@/lib/navigation";
import { appDialog } from "@/components/ui/app-dialog";
import { useAppearanceStore } from "@/store/appearanceStore";
import { playerThemes } from "@/theme/playerTheme";

export default function ReviewsScreen() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const { groundId, title, bookingId } = useLocalSearchParams<{
    groundId?: string;
    title?: string;
    bookingId?: string;
  }>();
  const [reviews, setReviews] = useState<GroundReview[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!groundId) {
      setLoading(false);
      return;
    }
    try {
      setReviews(await listGroundReviews(groundId));
    } finally {
      setLoading(false);
    }
  }, [groundId]);
  useEffect(() => {
    load();
  }, [load]);
  const average = useMemo(
    () =>
      reviews.length
        ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
        : 0,
    [reviews],
  );
  const report = (reviewId: string) =>
    appDialog.alert(
      "Report review",
      "Report this review for abusive, misleading, or inappropriate content?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            try {
              await reportReview(reviewId, "Inappropriate or abusive content");
            } catch {
              /* Report was already submitted or the review is unavailable. */
            }
          },
        },
      ],
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
      <View className="px-5 pt-3 pb-4 flex-row items-center">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace("/(player)")}
          className="w-11 h-11 rounded-xl border items-center justify-center mr-3"
          style={{ borderColor: theme.border, backgroundColor: theme.surface }}
        >
          <Ionicons name="arrow-back" size={23} color={theme.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            style={{
              fontFamily: "BigShouldersDisplay_800ExtraBold",
              fontSize: 25,
              color: theme.text,
            }}
          >
            REVIEWS
          </Text>
          <Text
            style={{ color: theme.subtle }}
            className="text-sm"
            numberOfLines={1}
          >
            {title || "Ground reviews"}
          </Text>
        </View>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={theme.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: bookingId ? 110 : 32,
          }}
        >
          {reviews.length ? (
            <>
              <View
                className="border rounded-[20px] p-5 flex-row items-center"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                }}
              >
                <View className="items-center w-28">
                  <Text
                    style={{
                      fontFamily: "SpaceGrotesk_700Bold",
                      color: theme.text,
                    }}
                    className="text-[34px]"
                  >
                    {average.toFixed(1)}
                  </Text>
                  <View className="flex-row mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name="star"
                        size={17}
                        color="#F5A623"
                      />
                    ))}
                  </View>
                  <Text style={{ color: theme.muted }} className="text-sm mt-1">
                    {reviews.length} reviews
                  </Text>
                </View>
                <Text
                  style={{ color: theme.subtle }}
                  className="flex-1 text-sm"
                >
                  Community feedback from completed bookings.
                </Text>
              </View>
              {reviews.map((review) => (
                <View
                  key={review.id}
                  className="rounded-[20px] p-4 mt-4"
                  style={{ backgroundColor: theme.surface }}
                >
                  <View className="flex-row items-center">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: theme.businessSurface }}
                    >
                      <Text
                        style={{ color: theme.green }}
                        className="font-bold"
                      >
                        {review.player_name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1 ml-3">
                      <Text
                        style={{ color: theme.text }}
                        className="font-semibold text-base"
                      >
                        {review.player_name}
                      </Text>
                      <Text
                        style={{ color: theme.muted }}
                        className="text-xs mt-0.5"
                      >
                        {new Date(review.created_at).toLocaleDateString(
                          "en-PK",
                        )}
                      </Text>
                    </View>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Report review"
                      onPress={() => report(review.id)}
                      className="h-11 w-11 items-center justify-center"
                    >
                      <Ionicons
                        name="flag-outline"
                        size={17}
                        color={theme.subtle}
                      />
                    </TouchableOpacity>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={17} color="#F5A623" />
                      <Text
                        style={{ color: theme.text }}
                        className="font-bold ml-1"
                      >
                        {review.rating}.0
                      </Text>
                    </View>
                  </View>
                  {review.comment && (
                    <Text
                      style={{ color: theme.subtle }}
                      className="text-[15px] leading-6 mt-4"
                    >
                      {review.comment}
                    </Text>
                  )}
                </View>
              ))}
            </>
          ) : (
            <View className="items-center pt-24 px-6">
              <View
                className="w-24 h-24 border-2 rounded-[20px] items-center justify-center"
                style={{ borderColor: theme.border }}
              >
                <Ionicons name="star" size={38} color={theme.green} />
              </View>
              <Text
                style={{
                  fontFamily: "BigShouldersDisplay_800ExtraBold",
                  fontSize: 25,
                  color: theme.text,
                }}
                className="mt-6"
              >
                NO REVIEWS YET
              </Text>
              <Text
                style={{ color: theme.subtle }}
                className="text-center text-[15px] leading-6 mt-3"
              >
                Be the first to share your experience with the community.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
      {bookingId && (
        <View
          className="absolute bottom-0 left-0 right-0 border-t px-5 py-4"
          style={{
            backgroundColor: theme.canvas,
            borderTopColor: theme.border,
          }}
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Write a review"
            onPress={() =>
              router.push({
                pathname: "/(player)/reviews-write",
                params: { bookingId, title },
              })
            }
            className="rounded-full py-4 items-center"
            style={{ backgroundColor: theme.green }}
          >
            <Text className="text-white font-semibold text-base">
              Write a review
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
