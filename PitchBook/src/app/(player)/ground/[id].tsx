import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatTimeRange12 } from '@/lib/time';
import { getPublicGround, Ground, Slot } from '@/lib/api/vendors';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';
import { GroundReview, listGroundReviews } from '@/lib/api/reviews';
import { openGroundDirections } from '@/components/ground-discovery-map';
import { CANCELLATION_POLICY_LABELS } from '@/lib/api/vendors';
import { addFavoriteGround, listFavoriteGrounds, recordGroundView, removeFavoriteGround } from '@/lib/api/engagement';

const fallbackImage = 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200';

function formatSlotDate(date: string) {
  const target = new Date(`${date}T12:00:00`);
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetKey = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  if (targetKey === todayKey) return 'Today';
  if (targetKey === todayKey + 86_400_000) return 'Tomorrow';
  return target.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' });
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function GroundDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ground, setGround] = useState<Ground | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [reviews, setReviews] = useState<GroundReview[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const fetchGround = useCallback(() => {
    if (typeof id !== 'string') return;
    setLoading(true);
    getPublicGround(id)
      .then((result) => {
        setGround(result.ground);
        setSlots(result.slots);
        setSelectedDate(result.slots[0]?.date || null);
        listGroundReviews(result.ground.id).then(setReviews).catch(() => undefined);
        recordGroundView(result.ground.id).catch(() => undefined);
        listFavoriteGrounds().then((items) => setIsFavorite(items.some((item) => item.id === result.ground.id))).catch(() => undefined);
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
  const selectedTotal = selectedSlots.reduce((total, slot) => total + slot.price, 0);
  const selectedSlot = selectedSlots.length ? { price: selectedTotal } : null;
  const bookedSlotCount = visibleSlots.filter((slot) => slot.is_booked || slot.is_blocked || slot.is_held).length;
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const leadingBlanks = firstDay.getDay();
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    return [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1))];
  }, [calendarMonth]);
  const openCalendar = () => {
    if (selectedDate) setCalendarMonth(new Date(`${selectedDate}T12:00:00`));
    setShowCalendar(true);
  };

  const toggleSlot = (slot: Slot) => {
    setSelectedSlots((current) => current.some((item) => item.id === slot.id)
      ? current.filter((item) => item.id !== slot.id)
      : [...current, slot]);
  };

  const addWeeklyRepeats = () => {
    const anchor = selectedSlots[0];
    if (!anchor) return;
    const anchorDate = new Date(`${anchor.date}T12:00:00`);
    const weeklyMatches = [1, 2, 3]
      .map((week) => {
        const date = new Date(anchorDate);
        date.setDate(date.getDate() + week * 7);
        const targetDate = date.toISOString().slice(0, 10);
        return slots.find((slot) => slot.date === targetDate
          && slot.start_time === anchor.start_time
          && slot.end_time === anchor.end_time
          && !slot.is_booked
          && !slot.is_blocked
          && !slot.is_held);
      })
      .filter((slot): slot is Slot => Boolean(slot));
    if (!weeklyMatches.length) {
      setToast('No matching weekly slots are currently available.');
      return;
    }
    setSelectedSlots((current) => [...current, ...weeklyMatches.filter((slot) => !current.some((item) => item.id === slot.id))]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#10120F]">
        <ActivityIndicator size="large" color="#3DB54A" />
      </SafeAreaView>
    );
  }

  if (!ground) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#10120F] px-6">
        <Ionicons name="alert-circle-outline" size={54} color="#9CA3AF" />
        <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 25 }} className="text-[#F8F7F0] mt-4">GROUND NOT FOUND</Text>
        <Text className="text-[#AFAFA9] text-center mt-2 text-sm">
          The requested football pitch could not be loaded or is currently deactivated.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => goBackOrReplace('/(player)')}
          className="mt-6 bg-[#3DB54A] rounded-full px-8 py-3.5"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
        <Toast message={toast} tone="error" onHide={() => setToast(null)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#10120F]">
      {/* Top Header */}
      <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center px-5 py-3">
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => goBackOrReplace('/(player)')}
          className="w-11 h-11 rounded-full bg-[#11140F]/90 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={23} color="#F8F7F0" />
        </TouchableOpacity>
        <View className="flex-1" />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={isFavorite ? 'Remove ground from favorites' : 'Save ground to favorites'} onPress={async () => { try { if (isFavorite) await removeFavoriteGround(ground.id); else await addFavoriteGround(ground.id); setIsFavorite((value) => !value); } catch (error: any) { setToast(error?.message || 'Unable to update favorites.'); } }} className="w-11 h-11 rounded-full bg-[#11140F]/90 items-center justify-center"><Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={24} color={isFavorite ? '#FF5C57' : '#F8F7F0'} /></TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Photo Gallery Carousel */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {(images.length ? images : [fallbackImage]).map((image, index) => (
            <Image
              key={`${image}-${index}`}
              source={{ uri: image }}
              className="w-screen h-80"
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* Content Body */}
        <View className="px-5 pt-6">
          <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 27, letterSpacing: 0.2 }} className="text-[#F8F7F0] uppercase">{ground.title}</Text>
          <Text className="text-[#AFAFA9] text-sm mt-1">{ground.address}, {ground.city}</Text>

          <View className="flex-row items-center mt-3">
            <Ionicons name="star" size={17} color="#F59E0B" />
            <Text className="font-bold text-[#F8F7F0] ml-1 text-sm">{ground.rating || 'New'}</Text>
            <Text className="text-[#AFAFA9] text-sm ml-2">({ground.total_reviews} reviews)</Text>
          </View>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#3DB54A] text-xl mt-2">From PKR {ground.price_per_hour.toLocaleString()}/hr</Text>
          {ground.peak_percentage && ground.peak_windows.length > 0 && (
            <Text className="text-[#D97706] text-xs font-semibold mt-2">Peak hours: +{ground.peak_percentage}% for selected times</Text>
          )}

          <View className="flex-row flex-wrap mt-5 pb-5 border-b border-[#293025]">
            {[ground.pitch_type, ...ground.amenities.slice(0, 2)].filter(Boolean).map((tag) => <View key={tag} className="bg-[#19331D] rounded-xl px-3 py-2 mr-2 mb-2"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#3DB54A] text-xs">{tag}</Text></View>)}
          </View>

          {!showSlotPicker && <>
          <View className="mt-7">
            <View className="flex-row items-center justify-between mb-3"><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 21 }} className="text-[#D6D7D0] uppercase">Reviews</Text><Text className="text-[#3DB54A] text-sm font-bold">See all reviews ({ground.total_reviews})</Text></View>
            {reviews.length === 0 ? <Text className="text-[#AFAFA9] text-sm">No reviews yet. Be the first player to rate this ground after a completed booking.</Text> : reviews.slice(0, 2).map((review) => <View key={review.id} className="bg-[#1B1F19] rounded-2xl p-4 mb-3 border border-[#242A20]"><View className="flex-row justify-between"><Text className="text-[#F3F4EF] font-bold">{review.player_name}</Text><View className="flex-row items-center"><Ionicons name="star" size={14} color="#F5A623" /><Text className="text-[#F3F4EF] font-bold ml-1">{review.rating}.0</Text></View></View>{review.comment ? <Text className="text-[#B5B8B0] text-sm mt-2">{review.comment}</Text> : null}<Text className="text-[#7E837B] text-xs mt-2">{new Date(review.created_at).toLocaleDateString('en-PK')}</Text></View>)}
          </View>

          {/* Amenities */}
          {ground.amenities.length > 0 && (
            <View className="mt-7">
              <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 21 }} className="text-[#D6D7D0] mb-3 uppercase">Amenities</Text>
              <View className="flex-row flex-wrap">
                {ground.amenities.map((item) => (
                  <View key={item} className="bg-[#20241B] rounded-lg px-3 py-2 mr-2 mb-2">
                    <Text className="text-[#BFC1B9] text-xs font-medium">{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* About description */}
          <View className="mt-6">
            <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 21 }} className="text-[#D6D7D0] mb-2 uppercase">About this ground</Text>
            <Text className="text-[#AFAFA9] leading-5 text-sm">
              {ground.description || 'No description provided by the venue owner.'}
            </Text>
          </View>

          <View className="mt-6 rounded-2xl bg-[#1A1D17] border border-[#292E25] p-4">
            <View className="flex-row items-center"><Ionicons name="shield-checkmark-outline" size={20} color="#59C462" /><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 19 }} className="text-[#D6D7D0] ml-2 uppercase">Cancellation & refunds</Text></View>
            <Text className="text-[#F3F4EF] text-sm mt-3">{CANCELLATION_POLICY_LABELS[ground.cancellation_policy || 'standard']} policy</Text>
            <Text className="text-[#AFAFA9] text-xs leading-5 mt-1">Full refund in the first {ground.cancellation_policy === 'lenient' ? '30' : ground.cancellation_policy === 'strict' ? '5' : '15'} minutes after booking. Refunds are calculated from the amount paid and the time left before the slot starts.</Text>
            <Text className="text-[#AFAFA9] text-xs leading-5 mt-2">{ground.cancellation_policy === 'strict' ? '48h+ 100% · 24–48h 70% · 12–24h 50% · 6–12h 30%' : ground.cancellation_policy === 'lenient' ? '24h+ 100% · 12–24h 75% · 6–12h 50% · under 6h 25%' : '24h+ 100% · 12–24h 75% · 6–12h 50% · under 6h 0%'}</Text>
          </View>

          <View className="mt-6">
            <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 21 }} className="text-[#D6D7D0] mb-3 uppercase">Location</Text>
            {ground.latitude !== null && ground.longitude !== null ? <><View className="rounded-2xl bg-[#1A1D17] border border-[#292E25] p-4 flex-row items-start"><Ionicons name="location-outline" size={21} color="#3DB54A" /><View className="flex-1 ml-3"><Text className="text-[#F3F4EF] font-semibold">{ground.address}</Text><Text className="text-[#AFAFA9] text-sm mt-1">{ground.location}, {ground.city}</Text></View></View><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Get directions to ${ground.title}`} onPress={() => openGroundDirections(ground).catch(() => setToast('Unable to open directions.'))} className="mt-3 py-2 flex-row items-center"><Ionicons name="navigate-outline" size={18} color="#3DB54A" /><Text className="text-[#3DB54A] font-bold ml-2">Get directions</Text></TouchableOpacity></> : <Text className="text-[#AFAFA9] text-sm">The venue owner has not added map coordinates yet.</Text>}
          </View>

          {/* Choose Date */}
          <View className="mt-5 rounded-xl bg-[#1A1D17] border border-[#292E25] p-4"><Text className="font-bold text-[#F3F4EF]">Opening hours</Text><Text className="text-[#62BD68] mt-1">{ground.operating_hours.open}–{ground.operating_hours.close} (Pakistan time)</Text>{ground.peak_percentage !== null && ground.peak_windows.length > 0 && <Text className="text-[#AFAFA9] mt-2 text-sm">Peak hours include a {ground.peak_percentage}% increase; the final price is shown on each slot.</Text>}</View>
          </>}
          {showSlotPicker && <>
          <View className="mt-7">
            <View className="flex-row items-center justify-between mb-3"><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 21 }} className="text-[#D6D7D0] uppercase">Select date</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Open slot calendar" onPress={openCalendar} className="flex-row items-center rounded-full border border-[#315536] bg-[#1A2119] px-3 py-2"><Ionicons name="calendar-outline" size={16} color="#59C462" /><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="ml-1.5 text-[#59C462] text-xs">Calendar</Text></TouchableOpacity></View>
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
                      }}
                      className={`rounded-full px-4 py-3 mr-2.5 border ${
                        isSelected
                          ? 'bg-[#1A2119] border-[#315B36]'
                          : 'bg-[#1B1F19] border-transparent'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-white' : 'text-[#BFC1B9]'
                        }`}
                      >
                        {formatSlotDate(date)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Available Slots */}
          <View className="mt-7">
            <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 21 }} className="text-[#D6D7D0] mb-3 uppercase">All slots</Text>
            {visibleSlots.length > 0 && <View className="bg-[#1B1F19] rounded-2xl px-5 py-5 mb-4"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F3F4EF] text-base">{bookedSlotCount} of {visibleSlots.length} slots booked today</Text><View className="h-2.5 rounded-full bg-[#30352C] mt-4 overflow-hidden"><View className="h-full bg-[#3DB54A]" style={{ width: `${Math.max(4, (bookedSlotCount / visibleSlots.length) * 100)}%` }} /></View></View>}
            {selectedSlots.length === 1 && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add matching weekly slots for the next three weeks"
                onPress={addWeeklyRepeats}
                className="self-start mb-3 rounded-full border border-[#4CAF50] px-3 py-2"
              >
                <Text className="text-[#2E7D32] text-sm font-semibold">Add next 3 weekly slots</Text>
              </TouchableOpacity>
            )}
            {visibleSlots.length === 0 ? (
              <View className="bg-[#F9FAFB] rounded-2xl p-6 items-center border border-[#F3F4F6]">
                <Text className="text-[#6B7280] text-sm">No slots available for this date.</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between">
              {visibleSlots.map((slot) => {
                const isHeld = Boolean(slot.is_held);
                const isBooked = Boolean(slot.is_booked);
                const isBlocked = Boolean(slot.is_blocked);
                const isAvailable = !isBooked && !isBlocked && !isHeld;
                const isSelected = selectedSlots.some((item) => item.id === slot.id);

                let statusLabel = `PKR ${slot.price.toLocaleString()}`;
                let statusColor = isSelected ? 'text-white' : isAvailable ? 'text-[#59C462]' : 'text-[#747A70]';
                let reasonBadge = null;

                if (isHeld) {
                  statusLabel = 'On Hold';
                  statusColor = 'text-[#D5A442]';
                  reasonBadge = (
                    <View className="bg-[#FEF3C7] px-2 py-0.5 rounded">
                      <Text className="text-[#B45309] text-xs font-semibold">Held for checkout</Text>
                    </View>
                  );
                } else if (isBooked) {
                  statusLabel = 'Booked';
                  statusColor = 'text-[#747A70]';
                  reasonBadge = (
                    <View className="bg-[#FEE2E2] px-2 py-0.5 rounded">
                      <Text className="text-[#DC2626] text-xs font-semibold">Reserved</Text>
                    </View>
                  );
                } else if (isBlocked) {
                  statusLabel = 'Unavailable';
                  statusColor = 'text-[#747A70]';
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
                    accessibilityLabel={`${formatTimeRange12(slot.start_time, slot.end_time)} ${statusLabel}`}
                    onPress={() => toggleSlot(slot)}
                    className={`w-[48.5%] min-h-[154px] justify-between rounded-2xl p-3.5 mb-3 border ${
                      isSelected
                        ? 'border-[#3DB54A] bg-[#3DB54A]'
                        : isAvailable
                        ? 'border-[#315536] bg-[#1B1F19]'
                        : 'border-transparent bg-[#1B1F19]'
                    }`}
                  >
                    <View>
                      <Text
                        className={`text-base font-bold ${
                          isSelected ? 'text-white' : isAvailable ? 'text-[#E8F2E8]' : 'text-[#5C6158]'
                        }`}
                      >
                        {formatTimeRange12(slot.start_time, slot.end_time)}
                      </Text>
                      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className={`text-sm mt-1 ${statusColor}`}>
                        {statusLabel}
                      </Text>
                      <Text className={`text-xs mt-1 ${isSelected ? 'text-white/80' : isAvailable ? 'text-[#9FC6A2]' : 'text-[#5D635A]'}`}>1 hour</Text>
                      {slot.is_peak && <Text className="text-[#D97706] text-xs font-semibold mt-1">Peak price</Text>}
                    </View>

                    {reasonBadge ? reasonBadge : <View className="flex-row items-center justify-between"><Text className={`text-sm font-bold ${isSelected ? 'text-white' : isAvailable ? 'text-[#59C462]' : 'text-[#73786F]'}`}>{isSelected ? 'Selected' : isAvailable ? 'Available' : 'Unavailable'}</Text>{isSelected && <Ionicons name="checkmark-circle" size={18} color="#F8F7F0" />}</View>}
                  </TouchableOpacity>
                );
              })}</View>
            )}
          </View>
          </>}
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-[#171B15] border-t border-[#293025] px-5 py-4">
        <TouchableOpacity
          disabled={showSlotPicker && selectedSlots.length === 0}
          accessibilityRole="button"
          accessibilityLabel={selectedSlots.length ? `Continue booking ${selectedSlots.length} slots for PKR ${selectedTotal}` : 'Select a slot'}
          onPress={() => {
            if (!showSlotPicker) { setShowSlotPicker(true); return; }
            if (selectedSlots.length === 0) return;
            router.push({
              pathname: '/(player)/payment-method',
              params: {
                slotId: selectedSlots.length === 1 ? selectedSlots[0]!.id : undefined,
                slotIds: JSON.stringify(selectedSlots.map((slot) => slot.id)),
                groundTitle: ground.title,
                groundAddress: ground.address,
                selectedSlots: JSON.stringify(selectedSlots.map((slot) => ({ id: slot.id, date: slot.date, startTime: slot.start_time.slice(0, 5), endTime: slot.end_time.slice(0, 5), price: slot.price }))),
                date: selectedSlots[0]!.date,
                startTime: selectedSlots[0]!.start_time.slice(0, 5),
                endTime: selectedSlots[0]!.end_time.slice(0, 5),
                amount: String(selectedTotal),
                cancellationPolicy: ground.cancellation_policy || 'standard',
              },
            });
          }}
          className={`rounded-full py-4 items-center ${
            !showSlotPicker || selectedSlots.length ? 'bg-[#3DB54A]' : 'bg-[#2B3028]'
          }`}
          style={(!showSlotPicker || selectedSlots.length) ? {
            shadowColor: '#3DB54A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 3,
          } : undefined}
        >
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className={`font-bold text-base ${!showSlotPicker || selectedSlots.length ? 'text-white' : 'text-[#7D8278]'}`}>
            {!showSlotPicker ? 'View available slots' : selectedSlot ? `Book now · PKR ${selectedSlot.price.toLocaleString()}` : 'Select an Available Slot'}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showCalendar} transparent animationType="slide" onRequestClose={() => setShowCalendar(false)}>
        <View className="flex-1 justify-end bg-black/70">
          <Pressable className="absolute inset-0" accessibilityLabel="Close calendar" onPress={() => setShowCalendar(false)} />
          <View className="rounded-t-[30px] border-t border-[#30372B] bg-[#181C16] px-5 pt-3 pb-8">
            <View className="h-1.5 w-12 rounded-full bg-[#6B7167] self-center mb-5" />
            <View className="flex-row items-center justify-between mb-5"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="h-10 w-10 rounded-full border border-[#30372B] items-center justify-center"><Ionicons name="chevron-back" size={20} color="#F8F7F0" /></TouchableOpacity><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 24 }} className="text-[#F8F7F0] uppercase">{calendarMonth.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="h-10 w-10 rounded-full border border-[#30372B] items-center justify-center"><Ionicons name="chevron-forward" size={20} color="#F8F7F0" /></TouchableOpacity></View>
            <View className="flex-row mb-2">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <Text key={day} className="w-[14.28%] text-center text-[#858A81] text-xs">{day}</Text>)}</View>
            <View className="flex-row flex-wrap">{calendarDays.map((day, index) => {
              if (!day) return <View key={`blank-${index}`} className="w-[14.28%] aspect-square" />;
              const key = dateKey(day); const available = dates.includes(key); const selected = key === selectedDate;
              return <View key={key} className="w-[14.28%] aspect-square items-center justify-center"><TouchableOpacity disabled={!available} accessibilityRole="button" accessibilityLabel={available ? `View slots for ${key}` : `No slots on ${key}`} onPress={() => { setSelectedDate(key); setShowCalendar(false); }} className={`h-10 w-10 rounded-full items-center justify-center ${selected ? 'bg-[#3DB54A]' : available ? 'bg-[#242A20] border border-[#315536]' : ''}`}><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className={selected ? 'text-white text-sm' : available ? 'text-[#F5F5F0] text-sm' : 'text-[#4C524A] text-sm'}>{day.getDate()}</Text></TouchableOpacity></View>;
            })}</View>
            <View className="flex-row items-center mt-5"><View className="h-2.5 w-2.5 rounded-full bg-[#3DB54A] mr-2" /><Text className="text-[#AFAFA9] text-xs">Green dates have published slots. Select one to view its times.</Text></View>
          </View>
        </View>
      </Modal>

      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
