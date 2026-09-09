import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getPublicGround, Ground, Slot } from '@/lib/api/vendors';
import { Toast } from '@/components/ui/toast';

const fallbackImage = 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200';

export default function GroundDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ground, setGround] = useState<Ground | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const fetchGround = useCallback(() => {
    if (typeof id !== 'string') return;
    setLoading(true);
    getPublicGround(id)
      .then((result) => {
        setGround(result.ground);
        setSlots(result.slots);
        setSelectedDate(result.slots[0]?.date || null);
      })
      .catch((error: any) => {
        setToast(error?.message || 'Unable to load ground details.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchGround();
  }, [fetchGround]);

  const dates = useMemo(() => [...new Set(slots.map((s) => s.date))], [slots]);
  const visibleSlots = slots.filter((slot) => slot.date === selectedDate);
  const images = ground ? (ground.cover_image ? [ground.cover_image, ...ground.images] : ground.images) : [];

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#4CAF50" />
      </SafeAreaView>
    );
  }

  if (!ground) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Ionicons name="alert-circle-outline" size={54} color="#9CA3AF" />
        <Text className="text-[#1A1A2E] text-xl font-bold mt-4">Ground Not Found</Text>
        <Text className="text-[#737373] text-center mt-2 text-sm">
          The requested football pitch could not be loaded or is currently deactivated.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
          className="mt-6 bg-[#4CAF50] rounded-full px-8 py-3.5"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
        <Toast message={toast} tone="error" onHide={() => setToast(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Top Header */}
      <View className="flex-row items-center px-5 py-3 border-b border-[#E5E5E5] bg-white">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-[#1A1A2E] flex-1 text-center mx-2" numberOfLines={1}>
          {ground.title}
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Photo Gallery Carousel */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {(images.length ? images : [fallbackImage]).map((image, index) => (
            <Image
              key={`${image}-${index}`}
              source={{ uri: image }}
              className="w-screen h-56"
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* Content Body */}
        <View className="px-5 pt-5">
          <Text className="text-2xl font-bold text-[#1A1A2E]">{ground.title}</Text>
          <Text className="text-[#737373] text-sm mt-1">{ground.address}, {ground.city}</Text>

          <View className="flex-row items-center mt-3">
            <Ionicons name="star" size={17} color="#F59E0B" />
            <Text className="font-bold ml-1 text-sm">{ground.rating || 'New'}</Text>
            <Text className="text-[#737373] text-sm ml-2">({ground.total_reviews} reviews)</Text>
            <Text className="text-[#4CAF50] font-bold text-base ml-auto">
              PKR {ground.price_per_hour.toLocaleString()}/hr
            </Text>
          </View>

          {/* Amenities */}
          {ground.amenities.length > 0 && (
            <View className="mt-7">
              <Text className="text-lg font-bold text-[#1A1A2E] mb-3">Amenities</Text>
              <View className="flex-row flex-wrap">
                {ground.amenities.map((item) => (
                  <View key={item} className="bg-[#F5F5F5] rounded-full px-3 py-1.5 mr-2 mb-2">
                    <Text className="text-[#4B5563] text-xs font-medium">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* About description */}
          <View className="mt-6">
            <Text className="text-lg font-bold text-[#1A1A2E] mb-2">About this ground</Text>
            <Text className="text-[#4B5563] leading-5 text-sm">
              {ground.description || 'No description provided by the venue owner.'}
            </Text>
          </View>

          {/* Choose Date */}
          <View className="mt-7">
            <Text className="text-lg font-bold text-[#1A1A2E] mb-3">Choose a date</Text>
            {dates.length === 0 ? (
              <Text className="text-[#9CA3AF] text-sm italic">No upcoming schedule published.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {dates.map((date) => {
                  const isSelected = selectedDate === date;
                  return (
                    <TouchableOpacity
                      key={date}
                      accessibilityRole="button"
                      accessibilityLabel={`Select date ${date}`}
                      onPress={() => {
                        setSelectedDate(date);
                        setSelectedSlot(null);
                      }}
                      className={`rounded-full px-4 py-2.5 mr-2.5 border ${
                        isSelected
                          ? 'bg-[#4CAF50] border-[#4CAF50]'
                          : 'bg-[#F9FAFB] border-[#E5E7EB]'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-white' : 'text-[#4B5563]'
                        }`}
                      >
                        {date}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Available Slots */}
          <View className="mt-7">
            <Text className="text-lg font-bold text-[#1A1A2E] mb-3">Available slots</Text>
            {visibleSlots.length === 0 ? (
              <View className="bg-[#F9FAFB] rounded-2xl p-6 items-center border border-[#F3F4F6]">
                <Text className="text-[#6B7280] text-sm">No slots available for this date.</Text>
              </View>
            ) : (
              visibleSlots.map((slot) => {
                const isHeld = Boolean(slot.is_held);
                const isBooked = Boolean(slot.is_booked);
                const isBlocked = Boolean(slot.is_blocked);
                const isAvailable = !isBooked && !isBlocked && !isHeld;
                const isSelected = selectedSlot?.id === slot.id;

                let statusLabel = `PKR ${slot.price.toLocaleString()}`;
                let statusColor = 'text-[#4CAF50]';
                let reasonBadge = null;

                if (isHeld) {
                  statusLabel = 'On Hold';
                  statusColor = 'text-[#D97706]';
                  reasonBadge = (
                    <View className="bg-[#FEF3C7] px-2 py-0.5 rounded">
                      <Text className="text-[#B45309] text-xs font-semibold">Held for checkout</Text>
                    </View>
                  );
                } else if (isBooked) {
                  statusLabel = 'Booked';
                  statusColor = 'text-[#9CA3AF]';
                  reasonBadge = (
                    <View className="bg-[#FEE2E2] px-2 py-0.5 rounded">
                      <Text className="text-[#DC2626] text-xs font-semibold">Reserved</Text>
                    </View>
                  );
                } else if (isBlocked) {
                  statusLabel = 'Unavailable';
                  statusColor = 'text-[#9CA3AF]';
                  reasonBadge = (
                    <View className="bg-[#F3F4F6] px-2 py-0.5 rounded">
                      <Text className="text-[#6B7280] text-xs font-semibold">Blocked</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={slot.id}
                    disabled={!isAvailable}
                    accessibilityRole="button"
                    accessibilityLabel={`${slot.start_time.slice(0, 5)} to ${slot.end_time.slice(0, 5)} ${statusLabel}`}
                    onPress={() => setSelectedSlot(slot)}
                    className={`flex-row items-center justify-between rounded-2xl p-4 mb-2.5 border ${
                      isSelected
                        ? 'border-[#4CAF50] bg-[#E8F5E9]'
                        : isAvailable
                        ? 'border-[#E5E5E5] bg-white'
                        : 'border-transparent bg-[#F9FAFB]'
                    }`}
                  >
                    <View>
                      <Text
                        className={`text-base font-bold ${
                          isAvailable ? 'text-[#1A1A2E]' : 'text-[#9CA3AF]'
                        }`}
                      >
                        {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                      </Text>
                      <Text className={`text-sm mt-0.5 font-semibold ${statusColor}`}>
                        {statusLabel}
                      </Text>
                    </View>

                    {reasonBadge ? (
                      reasonBadge
                    ) : (
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={isSelected ? '#4CAF50' : '#D1D5DB'}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-5 py-4">
        <TouchableOpacity
          disabled={!selectedSlot}
          accessibilityRole="button"
          accessibilityLabel={selectedSlot ? `Continue booking for PKR ${selectedSlot.price}` : 'Select a slot'}
          onPress={() => {
            if (!selectedSlot) return;
            router.push({
              pathname: '/(player)/payment-method',
              params: {
                slotId: selectedSlot.id,
                groundTitle: ground.title,
                groundAddress: ground.address,
                date: selectedSlot.date,
                startTime: selectedSlot.start_time.slice(0, 5),
                endTime: selectedSlot.end_time.slice(0, 5),
                amount: String(selectedSlot.price),
              },
            });
          }}
          className={`rounded-full py-4 items-center ${
            selectedSlot ? 'bg-[#4CAF50]' : 'bg-[#E5E7EB]'
          }`}
          style={selectedSlot ? {
            shadowColor: '#4CAF50',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          } : undefined}
        >
          <Text className={`font-bold text-base ${selectedSlot ? 'text-white' : 'text-[#9CA3AF]'}`}>
            {selectedSlot ? `Continue · PKR ${selectedSlot.price.toLocaleString()}` : 'Select an Available Slot'}
          </Text>
        </TouchableOpacity>
      </View>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
