import { useState } from "react";
import {
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { createReview } from "@/lib/api/reviews";
import { Toast } from "@/components/ui/toast";
import { goBackOrReplace } from "@/lib/navigation";
import { useAppearanceStore } from "@/store/appearanceStore";
import { playerThemes } from "@/theme/playerTheme";

export default function WriteReview() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const { bookingId, title } = useLocalSearchParams<{
    bookingId: string;
    title?: string;
  }>();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!bookingId || rating < 1)
      return setError("Choose a rating from 1 to 5 stars.");
    setSaving(true);
    try {
      await createReview(bookingId, rating, comment);
      goBackOrReplace("/(player)/bookings");
    } catch (caught: any) {
      setError(caught?.message || "Unable to submit review.");
    } finally {
      setSaving(false);
    }
  };
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
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center py-4">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => goBackOrReplace("/(player)/bookings")}
            className="h-11 w-11 rounded-xl border items-center justify-center"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "BigShouldersDisplay_800ExtraBold",
              fontSize: 25,
              color: theme.text,
            }}
            className="ml-3"
          >
            RATE YOUR EXPERIENCE
          </Text>
        </View>
        <Text style={{ color: theme.subtle }} className="text-[16px] mt-3">
          How was your game at{" "}
          <Text style={{ color: theme.green }}>{title || "this ground"}</Text>?
        </Text>
        <View
          className="border rounded-[20px] p-5 mt-6"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <Text
            style={{
              fontFamily: "BigShouldersDisplay_700Bold",
              fontSize: 18,
              color: theme.subtle,
            }}
          >
            YOUR RATING
          </Text>
          <View className="flex-row mt-4 justify-between">
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${value} stars`}
                accessibilityState={{ selected: value === rating }}
                onPress={() => setRating(value)}
                className="h-11 w-11 items-center justify-center"
              >
                <Ionicons
                  name={value <= rating ? "star" : "star-outline"}
                  size={34}
                  color="#F5A623"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text
          style={{
            fontFamily: "BigShouldersDisplay_700Bold",
            fontSize: 18,
            color: theme.subtle,
          }}
          className="mt-7 mb-2"
        >
          COMMENT (OPTIONAL)
        </Text>
        <TextInput
          accessibilityLabel="Review comment"
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={500}
          placeholder="Share your experience at this ground..."
          placeholderTextColor={theme.muted}
          style={{
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          }}
          className="min-h-[145px] border rounded-[20px] p-4 text-[15px]"
          textAlignVertical="top"
        />
        <Text
          style={{ color: theme.muted }}
          className="text-xs text-right mt-1"
        >
          {comment.length}/500
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Submit review"
          disabled={saving}
          onPress={save}
          className="rounded-full py-4 items-center mt-6"
          style={{ backgroundColor: saving ? theme.muted : theme.green }}
        >
          <Text className="text-white font-semibold text-base">
            {saving ? "Submitting..." : "Submit review"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <Toast message={error} tone="error" onHide={() => setError(null)} />
    </SafeAreaView>
  );
}
