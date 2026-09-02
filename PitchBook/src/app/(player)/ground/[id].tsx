import { 
  View, Text, TouchableOpacity, ScrollView, 
  Image, Dimensions, Platform, StatusBar,
  Modal, FlatList, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const { width } = Dimensions.get('window');

// Mock data - will be replaced with real API data
const mockGroundData = {
  id: '1',
  name: 'ARENA 11 SPORTS',
  rating: 4.8,
  reviews: 48,
  price: 3000,
  location: 'Plot 42-C, Sector G, Phase 2, DHA, Islamabad',
  isOpen: true,
  amenities: ['Parking', 'Floodlights', 'Changing rooms', 'Drinking water'],
  images: [
    'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
  ],
  pitches: [
    { id: '1', name: '5-a-side', price: 3000, icon: '⚽' },
    { id: '2', name: '9-a-side', price: 8000, icon: '🏟️' },
  ],
  rules: [
    'Bring your own cleats',
    'No smoking on pitch',
  ],
  reviewsList: [
    {
      id: '1',
      name: 'Zayn A.',
      rating: 5.0,
      comment: 'Top tier turf and lighting. Best 5-a-side ground in DHA Islamabad.',
      time: '2 days ago',
    },
    {
      id: '2',
      name: 'Hina M.',
      rating: 4.5,
      comment: 'Great vibe, parking space is secure. Water stands can be improved.',
      time: '1 week ago',
    },
  ],
};

// Mock slots data
const mockSlots = {
  available: [
    { id: '1', time: '6:00 AM - 7:30 AM', price: 3000, available: true },
    { id: '2', time: '9:00 AM - 10:30 AM', price: 3000, available: true },
    { id: '3', time: '12:00 PM - 1:30 PM', price: 3000, available: true },
    { id: '4', time: '3:00 PM - 4:30 PM', price: 3500, available: true },
    { id: '5', time: '6:00 PM - 7:30 PM', price: 3500, available: true },
    { id: '6', time: '9:00 PM - 10:30 PM', price: 3500, available: true },
  ],
  booked: [
    { id: '7', time: '7:30 AM - 9:00 AM', price: 3000, available: false },
    { id: '8', time: '10:30 AM - 12:00 PM', price: 3000, available: false },
    { id: '9', time: '1:30 PM - 3:00 PM', price: 3000, available: false },
    { id: '10', time: '4:30 PM - 6:00 PM', price: 3500, available: false },
    { id: '11', time: '8:00 PM - 9:00 PM', price: 3500, available: false },
    { id: '12', time: '10:30 PM - 12:00 AM', price: 3500, available: false },
  ],
};

const dates = ['Today', 'Tomorrow', 'Mon', 'Tue', 'Wed'];

export default function GroundDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [selectedPitch, setSelectedPitch] = useState('5-a-side');
  const [selectedDate, setSelectedDate] = useState('Today');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showSlotsModal, setShowSlotsModal] = useState(false);

  const ground = mockGroundData;

  const handleBookNow = () => {
    if (!user) {
      router.push('/(auth)/phone-input');
      return;
    }
    if (selectedSlot) {
      router.push('/(player)/payment-method');
    }
  };

  const handleViewSlots = () => {
    setShowSlotsModal(true);
  };

  const renderSlotItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      className={`flex-row items-center justify-between p-4 rounded-xl mb-2 ${
        item.available 
          ? selectedSlot === item.id 
            ? 'bg-[#E8F5E9] border-2 border-[#4CAF50]' 
            : 'bg-white border border-[#E5E5E5]'
          : 'bg-[#F5F5F5] opacity-60'
      }`}
      onPress={() => item.available && setSelectedSlot(item.id)}
      disabled={!item.available}
    >
      <View className="flex-row items-center flex-1">
        <View className={`w-8 h-8 rounded-full items-center justify-center ${
          item.available ? 'bg-[#E8F5E9]' : 'bg-[#F5F5F5]'
        }`}>
          <Ionicons 
            name={item.available ? 'time-outline' : 'lock-closed'} 
            size={16} 
            color={item.available ? '#4CAF50' : '#D4D4D4'} 
          />
        </View>
        <View className="ml-3 flex-1">
          <Text className={`font-medium ${
            item.available ? 'text-[#1A1A2E]' : 'text-[#D4D4D4]'
          }`}>
            {item.time}
          </Text>
          <Text className={`text-xs ${
            item.available ? 'text-[#4CAF50]' : 'text-[#D4D4D4]'
          }`}>
            {item.available ? `PKR ${item.price}` : 'Booked'}
          </Text>
        </View>
      </View>
      {item.available && (
        <View className={`w-5 h-5 rounded-full border-2 ${
          selectedSlot === item.id 
            ? 'bg-[#4CAF50] border-[#4CAF50]' 
            : 'border-[#D4D4D4]'
        }`}>
          {selectedSlot === item.id && (
            <Ionicons name="checkmark" size={12} color="white" />
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* ─── Header ─── */}
      <View className="px-6 pt-2 pb-2 flex-row items-center justify-between">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-[#1A1A2E]">{ground.name}</Text>
        <TouchableOpacity className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center">
          <Ionicons name="heart-outline" size={22} color="#1A1A2E" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* ─── Image ─── */}
        <View className="px-6 mt-2">
          <View className="rounded-2xl overflow-hidden h-48">
            <Image 
              source={{ uri: ground.images[0] }}
              className="w-full h-full"
              resizeMode="cover"
            />
            <View className="absolute top-3 left-3 bg-[#4CAF50] px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-medium">Open Now</Text>
            </View>
          </View>
        </View>

        {/* ─── Title & Rating ─── */}
        <View className="px-6 mt-4">
          <Text className="text-2xl font-bold text-[#1A1A2E]">{ground.name}</Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="star" size={18} color="#F59E0B" />
            <Text className="text-[#1A1A2E] font-bold ml-1">{ground.rating}</Text>
            <Text className="text-[#737373] ml-1">({ground.reviews} reviews)</Text>
            <Text className="text-[#737373] ml-3">From Rs {ground.price}/hr</Text>
          </View>
        </View>

        {/* ─── Amenities ─── */}
        <View className="px-6 mt-6">
          <Text className="text-[#1A1A2E] text-lg font-bold mb-3">AMENITIES</Text>
          <View className="flex-row flex-wrap">
            {ground.amenities.map((item) => (
              <View key={item} className="bg-[#F5F5F5] px-4 py-2 rounded-xl mr-2 mb-2">
                <Text className="text-[#737373] text-sm">{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ─── Location ─── */}
        <View className="px-6 mt-4">
          <Text className="text-[#1A1A2E] text-lg font-bold mb-2">LOCATION</Text>
          <Text className="text-[#737373] text-sm">{ground.location}</Text>
          <TouchableOpacity className="mt-1">
            <Text className="text-[#4CAF50] font-medium text-sm">Get directions</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Select Pitch ─── */}
        <View className="px-6 mt-6">
          <Text className="text-[#1A1A2E] text-lg font-bold mb-3">SELECT PITCH</Text>
          <View className="flex-row space-x-3">
            {ground.pitches.map((pitch) => (
              <TouchableOpacity
                key={pitch.id}
                className={`flex-1 p-4 rounded-xl border ${
                  selectedPitch === pitch.name 
                    ? 'bg-[#E8F5E9] border-[#4CAF50]' 
                    : 'bg-white border-[#E5E5E5]'
                }`}
                style={selectedPitch !== pitch.name ? { 
                  shadowColor: '#000', 
                  shadowOffset: { width: 0, height: 2 }, 
                  shadowOpacity: 0.04, 
                  shadowRadius: 4, 
                  elevation: 1 
                } : {}}
                onPress={() => setSelectedPitch(pitch.name)}
              >
                <Text className="text-2xl">{pitch.icon}</Text>
                <Text className={`font-bold mt-2 ${
                  selectedPitch === pitch.name ? 'text-[#1A1A2E]' : 'text-[#1A1A2E]'
                }`}>
                  {pitch.name}
                </Text>
                <Text className={`font-bold mt-1 ${
                  selectedPitch === pitch.name ? 'text-[#4CAF50]' : 'text-[#4CAF50]'
                }`}>
                  Rs {pitch.price}/hr
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─── Rules ─── */}
        <View className="px-6 mt-6">
          <Text className="text-[#1A1A2E] text-lg font-bold mb-2">RULES & POLICIES</Text>
          {ground.rules.map((rule, index) => (
            <View key={index} className="flex-row items-center mb-1">
              <Ionicons name="ellipse" size={6} color="#737373" />
              <Text className="text-[#737373] text-sm ml-2">{rule}</Text>
            </View>
          ))}
          <TouchableOpacity className="mt-1">
            <Text className="text-[#4CAF50] font-medium text-sm">Cancellation policy</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Reviews ─── */}
        <View className="px-6 mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[#1A1A2E] text-lg font-bold">REVIEWS</Text>
            <TouchableOpacity>
              <Text className="text-[#4CAF50] font-medium text-sm">See all reviews ({ground.reviews})</Text>
            </TouchableOpacity>
          </View>

          {ground.reviewsList.map((review) => (
            <View key={review.id} className="bg-white rounded-xl p-4 mb-3 border border-[#F5F5F5]">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-[#4CAF50] items-center justify-center">
                  <Text className="text-white font-bold">{review.name.charAt(0)}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-[#1A1A2E] font-semibold">{review.name}</Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={14} color="#F59E0B" />
                    <Text className="text-[#737373] text-xs ml-1">{review.rating}</Text>
                    <Text className="text-[#737373] text-xs ml-2">• {review.time}</Text>
                  </View>
                </View>
              </View>
              <Text className="text-[#737373] text-sm mt-2">{review.comment}</Text>
            </View>
          ))}
        </View>

        <View className="h-24" />
      </ScrollView>

      {/* ─── Bottom Bar ─── */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 py-4">
        <TouchableOpacity
          className="bg-[#4CAF50] py-4 rounded-full"
          style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
          onPress={handleViewSlots}
        >
          <Text className="text-white text-center font-bold text-base">View available slots</Text>
        </TouchableOpacity>
      </View>

      {/* ─── SLOTS MODAL ─── */}
      <Modal
        visible={showSlotsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSlotsModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback onPress={() => setShowSlotsModal(false)}>
            <View className="flex-1" />
          </TouchableWithoutFeedback>
          
          <View className="bg-white rounded-t-3xl max-h-[85%]">
            {/* Handle */}
            <View className="items-center pt-3 pb-2">
              <View className="w-12 h-1 bg-[#E5E5E5] rounded-full" />
            </View>

            <View className="px-6 pb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-[#1A1A2E]">Select Slot</Text>
              <TouchableOpacity onPress={() => setShowSlotsModal(false)}>
                <Ionicons name="close" size={24} color="#737373" />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
              {/* Date Selection */}
              <View className="flex-row mb-4">
                {dates.map((date) => (
                  <TouchableOpacity
                    key={date}
                    className={`px-5 py-2 rounded-full mr-2 ${
                      selectedDate === date ? 'bg-[#4CAF50]' : 'bg-[#F5F5F5]'
                    }`}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text className={selectedDate === date ? 'text-white font-medium' : 'text-[#737373]'}>
                      {date}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Info */}
              <View className="bg-[#F5F5F5] rounded-xl p-3 mb-4">
                <Text className="text-[#737373] text-sm">
                  <Text className="font-bold">6 of 10</Text> slots booked today
                </Text>
              </View>

              {/* Available Slots */}
              <Text className="text-[#1A1A2E] font-bold text-base mb-3">Available Slots</Text>
              <FlatList
                data={mockSlots.available}
                renderItem={renderSlotItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />

              {/* Booked Slots */}
              <Text className="text-[#1A1A2E] font-bold text-base mt-4 mb-3">Booked Slots</Text>
              <FlatList
                data={mockSlots.booked}
                renderItem={renderSlotItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />

              <View className="h-24" />
            </ScrollView>

            {/* Modal Bottom Bar */}
            <View className="bg-white border-t border-[#E5E5E5] px-6 py-4">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-[#737373] text-xs">Total Amount</Text>
                  <Text className="text-[#1A1A2E] text-2xl font-bold">PKR 4,000</Text>
                </View>
                <TouchableOpacity
                  className={`px-8 py-4 rounded-full ${
                    selectedSlot ? 'bg-[#4CAF50]' : 'bg-[#E5E5E5]'
                  }`}
                  style={selectedSlot ? { 
                    shadowColor: '#4CAF50', 
                    shadowOffset: { width: 0, height: 4 }, 
                    shadowOpacity: 0.3, 
                    shadowRadius: 8, 
                    elevation: 4 
                  } : {}}
                  onPress={handleBookNow}
                  disabled={!selectedSlot}
                >
                  <Text className={selectedSlot ? 'text-white font-bold' : 'text-[#737373] font-bold'}>
                    Book Now
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}