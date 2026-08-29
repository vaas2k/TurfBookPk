import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Dimensions, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const { width } = Dimensions.get('window');

// Mock data
const mockGrounds = [
  {
    id: '1',
    name: 'Arena 11 Sports',
    location: 'Satellite Town, Rawalpindi',
    price: 4000,
    rating: 4.8,
    reviews: 42,
    slotsAvailable: 3,
    image: 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800',
    type: '5-a-side',
    distance: '0.8 km',
    isAvailable: true,
  },
  {
    id: '2',
    name: 'Total Football',
    location: 'Chaklala Scheme 3, Rawalpindi',
    price: 4500,
    rating: 4.9,
    reviews: 56,
    slotsAvailable: 2,
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
    type: '5-a-side',
    distance: '1.2 km',
    isAvailable: true,
  },
  {
    id: '3',
    name: 'Green Valley Sports',
    location: 'G-11, Islamabad',
    price: 3500,
    rating: 4.6,
    reviews: 38,
    slotsAvailable: 4,
    image: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
    type: '7-a-side',
    distance: '2.5 km',
    isAvailable: true,
  },
];

const filterOptions = ['All', '5-a-side', '7-a-side', 'Turf'];

export default function HomeDiscover() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const handleGroundPress = (groundId: string) => {
    router.push(`/ground/${groundId}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-[#737373] text-sm font-regular">Good morning 👋</Text>
            <Text className="text-[#1A1A2E] text-2xl font-bold font-bold mt-0.5">
              {user?.name || 'Ahmed'}
            </Text>
          </View>
          <View className="flex-row items-center space-x-3">
            <TouchableOpacity 
              className="bg-white w-10 h-10 rounded-full items-center justify-center shadow-sm"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
              onPress={() => router.push('/(player)/notifications')}
            >
              <Ionicons name="notifications-outline" size={20} color="#1A1A2E" />
              <View className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </TouchableOpacity>
            <TouchableOpacity 
              className="bg-white w-10 h-10 rounded-full items-center justify-center shadow-sm"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
              onPress={() => router.push('/(player)/profile')}
            >
              <Ionicons name="person-outline" size={20} color="#1A1A2E" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Location */}
        <TouchableOpacity className="px-6 flex-row items-center mt-1">
          <Ionicons name="location-outline" size={18} color="#4CAF50" />
          <Text className="text-[#1A1A2E] font-medium font-medium ml-1">Rawalpindi</Text>
          <Ionicons name="chevron-down" size={16} color="#737373" />
        </TouchableOpacity>

        {/* Search Bar */}
        <View className="px-6 mt-4">
          <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Ionicons name="search-outline" size={20} color="#737373" />
            <TextInput
              className="flex-1 ml-3 text-[#1A1A2E] text-base font-regular"
              placeholder="Search grounds..."
              placeholderTextColor="#A3A3A3"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity className="bg-[#F5F5F5] p-2 rounded-xl">
              <Ionicons name="options-outline" size={18} color="#737373" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-6 mt-4"
        >
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter}
              className={`px-5 py-2.5 rounded-full mr-2 ${
                selectedFilter === filter ? 'bg-[#4CAF50]' : 'bg-white'
              }`}
              style={selectedFilter !== filter ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 } : {}}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text className={selectedFilter === filter ? 'text-white font-medium font-medium' : 'text-[#737373] font-medium font-medium'}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Available Now Section */}
        <View className="mt-6 px-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[#1A1A2E] text-lg font-bold font-bold">AVAILABLE NOW</Text>
            <TouchableOpacity>
              <Text className="text-[#4CAF50] font-medium font-medium">See all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-1"
          >
            {mockGrounds.slice(0, 2).map((ground) => (
              <TouchableOpacity
                key={ground.id}
                className="mx-1.5 bg-white rounded-2xl overflow-hidden"
                style={{ width: width * 0.82, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 }}
                onPress={() => handleGroundPress(ground.id)}
              >
                <View className="relative">
                  <Image 
                    source={{ uri: ground.image }}
                    className="w-full h-44"
                    resizeMode="cover"
                  />
                  <View className="absolute top-3 right-3 bg-[#4CAF50] px-3 py-1 rounded-full">
                    <Text className="text-white text-xs font-medium font-medium">
                      {ground.slotsAvailable} slots
                    </Text>
                  </View>
                  <View className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
                </View>
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[#1A1A2E] text-base font-bold font-bold flex-1 mr-2">
                      {ground.name}
                    </Text>
                    <View className="flex-row items-center bg-[#F5F5F5] px-2 py-1 rounded-lg">
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text className="text-[#1A1A2E] font-bold font-bold ml-0.5 text-sm">{ground.rating}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="location-outline" size={13} color="#737373" />
                    <Text className="text-[#737373] text-xs font-regular ml-1">{ground.location}</Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-[#F5F5F5]">
                    <Text className="text-[#4CAF50] font-bold font-bold text-base">
                      PKR {ground.price}/hr
                    </Text>
                    <View className="bg-[#4CAF50] px-4 py-1.5 rounded-full">
                      <Text className="text-white font-medium font-medium text-sm">Book Now</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Near You Section */}
        <View className="mt-6 px-6 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[#1A1A2E] text-lg font-bold font-bold">NEAR YOU</Text>
            <TouchableOpacity>
              <Text className="text-[#4CAF50] font-medium font-medium">See all</Text>
            </TouchableOpacity>
          </View>

          {mockGrounds.slice(1).map((ground) => (
            <TouchableOpacity
              key={ground.id}
              className="bg-white rounded-2xl p-4 mb-3 flex-row"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
              onPress={() => handleGroundPress(ground.id)}
            >
              <Image 
                source={{ uri: ground.image }}
                className="w-24 h-24 rounded-xl"
                resizeMode="cover"
              />
              <View className="flex-1 ml-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[#1A1A2E] text-base font-bold font-bold flex-1 mr-2">
                    {ground.name}
                  </Text>
                  <View className="flex-row items-center">
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text className="text-[#1A1A2E] font-bold font-bold ml-0.5 text-sm">{ground.rating}</Text>
                  </View>
                </View>
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="location-outline" size={12} color="#737373" />
                  <Text className="text-[#737373] text-xs font-regular ml-1">{ground.location}</Text>
                </View>
                <View className="flex-row items-center mt-1 space-x-2">
                  <View className="bg-[#F5F5F5] px-2 py-0.5 rounded-full">
                    <Text className="text-[#737373] text-xs font-regular">{ground.type}</Text>
                  </View>
                  <Text className="text-[#737373] text-xs font-regular">• {ground.distance}</Text>
                </View>
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-[#4CAF50] font-bold font-bold text-base">
                    PKR {ground.price}/hr
                  </Text>
                  <View className="bg-[#E8F5E9] px-2 py-1 rounded-full">
                    <Text className="text-[#4CAF50] text-xs font-medium font-medium">
                      {ground.slotsAvailable} slots left
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}