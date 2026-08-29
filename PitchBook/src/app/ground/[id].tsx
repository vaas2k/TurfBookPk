import { View, Text, TouchableOpacity, ScrollView, Image, Dimensions, FlatList, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const { width } = Dimensions.get('window');

// Mock ground data
const getGroundData = (id: string) => ({
  id,
  name: 'KICKOFF ARENA',
  rating: 4.8,
  reviews: 48,
  price: 3000,
  location: 'Plot 42-C, Sector G, Phase 2, DHA, Islamabad',
  amenities: ['Parking', 'Floodlights', 'Changing rooms', 'Drinking water'],
  images: [
    'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
  ],
  slots: [
    { time: '06:00 AM - 07:30 AM', available: true },
    { time: '07:30 AM - 09:00 AM', available: false },
    { time: '09:00 AM - 10:30 AM', available: true },
    { time: '10:30 AM - 12:00 PM', available: false },
    { time: '12:00 PM - 01:30 PM', available: true },
    { time: '01:30 PM - 03:00 PM', available: false },
    { time: '03:00 PM - 04:30 PM', available: true },
    { time: '04:30 PM - 06:00 PM', available: false },
    { time: '06:00 PM - 07:30 PM', available: true },
    { time: '07:30 PM - 09:00 PM', available: false },
    { time: '09:00 PM - 10:30 PM', available: true },
  ],
});

// Mock reviews
const mockReviews = [
  {
    id: '1',
    name: 'Zayn A.',
    rating: 5.0,
    comment: 'Top tier turf and lighting. Best 5-a-side ground in DHA Islamabad.',
    timeAgo: '2 days ago',
  },
  {
    id: '2',
    name: 'Hina M.',
    rating: 4.5,
    comment: 'Great vibe, parking space is secure. Water stands can be improved.',
    timeAgo: '1 week ago',
  },
];

const dates = ['Today', 'Tomorrow', 'Mon', 'Tue', 'Wed'];
const pitchTypes = [
  { name: '5-a-side', price: 3000 },
  { name: '11-a-side', price: 8000 },
];

export default function GroundDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState('Today');
  const [selectedPitch, setSelectedPitch] = useState('5-a-side');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const ground = getGroundData(id as string);

  const handleBookNow = () => {
    if (!user) {
      router.push('/(auth)/signup-phone');
      return;
    }
    if (selectedSlot) {
      router.push('/(player)/payment-method');
    }
  };

  const renderSlotItem = ({ item }: { item: { time: string; available: boolean } }) => (
    <TouchableOpacity
      className={`flex-row items-center justify-between p-4 rounded-xl mb-2 ${
        item.available 
          ? selectedSlot === item.time 
            ? 'bg-[#E8F5E9] border-2 border-[#4CAF50]' 
            : 'bg-white'
          : 'bg-[#F5F5F5] opacity-60'
      }`}
      style={item.available && selectedSlot !== item.time ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 } : {}}
      onPress={() => item.available && setSelectedSlot(item.time)}
      disabled={!item.available}
    >
      <View className="flex-row items-center">
        <View className={`w-8 h-8 rounded-full items-center justify-center ${item.available ? 'bg-[#E8F5E9]' : 'bg-[#F5F5F5]'}`}>
          <Ionicons 
            name={item.available ? 'time-outline' : 'lock-closed'} 
            size={16} 
            color={item.available ? '#4CAF50' : '#D4D4D4'} 
          />
        </View>
        <Text className={`ml-3 font-medium font-medium ${item.available ? 'text-[#1A1A2E]' : 'text-[#D4D4D4]'}`}>
          {item.time}
        </Text>
      </View>
      <View className={`px-3 py-1 rounded-full ${item.available ? 'bg-[#E8F5E9]' : 'bg-[#F5F5F5]'}`}>
        <Text className={item.available ? 'text-[#4CAF50] text-xs font-medium font-medium' : 'text-[#D4D4D4] text-xs font-medium font-medium'}>
          {item.available ? 'Available' : 'Booked'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // If guest, show guest view
  if (user) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        <View className="flex-1">
          <View className="px-6 pt-4 flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center">
              <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
            </TouchableOpacity>
            <Text className="text-xl font-bold font-bold text-[#1A1A2E] ml-3">{ground.name}</Text>
          </View>

          <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
            <View className="mt-4 rounded-2xl overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
              <Image 
                source={{ uri: ground.images[0] }}
                className="w-full h-56"
                resizeMode="cover"
              />
              <View className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
              <View className="absolute bottom-0 left-0 right-0 p-4">
                <Text className="text-white text-2xl font-bold font-bold">{ground.name}</Text>
                <Text className="text-white/80 text-sm font-regular mt-0.5">From Rs {ground.price}/hr</Text>
              </View>
            </View>

            <View className="mt-6">
              <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">AMENITIES</Text>
              <View className="flex-row flex-wrap">
                {ground.amenities.map((item) => (
                  <View key={item} className="bg-[#F5F5F5] px-4 py-2 rounded-xl mr-2 mb-2">
                    <Text className="text-[#737373] text-sm font-regular">{item}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View className="mt-8 bg-[#F5F5F5] rounded-2xl p-6 mb-8">
              <View className="items-center">
                <View className="w-16 h-16 rounded-full bg-[#4CAF50]/20 items-center justify-center mb-4">
                  <Ionicons name="person-add-outline" size={32} color="#4CAF50" />
                </View>
                <Text className="text-[#1A1A2E] text-xl font-bold font-bold text-center">
                  CREATE AN ACCOUNT TO BOOK
                </Text>
                <Text className="text-[#737373] text-center mt-2 text-sm font-regular">
                  Sign up in seconds to book this ground
                </Text>
              </View>

              <TouchableOpacity
                className="bg-[#4CAF50] py-4 rounded-full mt-4"
                style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                onPress={() => router.push('/(auth)/signup-phone')}
              >
                <Text className="text-white text-center font-semibold font-semibold">Continue</Text>
              </TouchableOpacity>

              <TouchableOpacity className="mt-4" onPress={() => router.push('/(auth)/login')}>
                <Text className="text-[#4CAF50] text-center font-medium font-medium">
                  Already have an account? Log in
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // Logged in user view
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View className="flex-1">
        {/* Header */}
        <View className="px-6 pt-4 flex-row items-center justify-between">
          <TouchableOpacity className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#1A1A2E" />
          </TouchableOpacity>
          <Text className="text-lg font-bold font-bold text-[#1A1A2E]">{ground.name}</Text>
          <TouchableOpacity className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center">
            <Ionicons name="heart-outline" size={22} color="#1A1A2E" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          {/* Rating & Location */}
          <View className="mt-4">
            <View className="flex-row items-center">
              <View className="bg-[#E8F5E9] px-3 py-1 rounded-full">
                <Text className="text-[#4CAF50] text-xs font-medium font-medium">Open Now</Text>
              </View>
              <View className="flex-row items-center ml-3">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text className="text-[#1A1A2E] font-bold font-bold ml-1">{ground.rating}</Text>
                <Text className="text-[#737373] text-sm font-regular ml-1">({ground.reviews})</Text>
              </View>
            </View>
            <View className="flex-row items-center mt-2">
              <Ionicons name="location-outline" size={16} color="#737373" />
              <Text className="text-[#737373] text-sm font-regular ml-1.5">{ground.location}</Text>
              <TouchableOpacity className="ml-2">
                <Text className="text-[#4CAF50] text-xs font-medium font-medium">Get directions</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pitch Selection */}
          <View className="mt-6">
            <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">SELECT PITCH</Text>
            <View className="flex-row space-x-3">
              {pitchTypes.map((pitch) => (
                <TouchableOpacity
                  key={pitch.name}
                  className={`flex-1 p-4 rounded-xl border ${
                    selectedPitch === pitch.name 
                      ? 'bg-[#E8F5E9] border-[#4CAF50]' 
                      : 'bg-white border-[#E5E5E5]'
                  }`}
                  style={selectedPitch !== pitch.name ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 } : {}}
                  onPress={() => setSelectedPitch(pitch.name)}
                >
                  <Text className={`font-bold font-bold ${selectedPitch === pitch.name ? 'text-[#1A1A2E]' : 'text-[#1A1A2E]'}`}>
                    {pitch.name}
                  </Text>
                  <Text className={`font-bold font-bold mt-1 ${selectedPitch === pitch.name ? 'text-[#4CAF50]' : 'text-[#4CAF50]'}`}>
                    Rs {pitch.price}/hr
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date Selection */}
          <View className="mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-[#1A1A2E] text-base font-bold font-bold">SELECT DATE</Text>
              <Text className="text-[#737373] text-sm font-regular">Saturday, 16 Aug ▼</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {dates.map((date) => (
                <TouchableOpacity
                  key={date}
                  className={`px-5 py-3 rounded-xl mr-2 ${
                    selectedDate === date ? 'bg-[#4CAF50]' : 'bg-[#F5F5F5]'
                  }`}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text className={selectedDate === date ? 'text-white font-medium font-medium' : 'text-[#737373] font-regular'}>
                    {date}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Slots */}
          <View className="mt-6 pb-24">
            <Text className="text-[#1A1A2E] text-base font-bold font-bold mb-3">ALL SLOTS</Text>
            <FlatList
              data={ground.slots}
              renderItem={renderSlotItem}
              keyExtractor={(item, index) => index.toString()}
              scrollEnabled={false}
            />
          </View>
        </ScrollView>

        {/* Bottom Bar */}
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] px-6 py-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[#737373] text-xs font-regular">Total Amount</Text>
              <Text className="text-[#1A1A2E] text-2xl font-bold font-bold">PKR {ground.price}</Text>
            </View>
            <TouchableOpacity
              className={`px-8 py-4 rounded-full ${selectedSlot ? 'bg-[#4CAF50]' : 'bg-[#E5E5E5]'}`}
              style={selectedSlot ? { shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 } : {}}
              onPress={handleBookNow}
              disabled={!selectedSlot}
            >
              <Text className={selectedSlot ? 'text-white font-bold font-bold' : 'text-[#737373] font-bold font-bold'}>
                Book Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}