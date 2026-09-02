import { 
  View, Text, TextInput, TouchableOpacity, 
  ScrollView, Image, Dimensions, RefreshControl,
  Platform, StatusBar, FlatList, Modal, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

const { width } = Dimensions.get('window');

// Mock data - will be replaced with real API data
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
    isAvailableNow: true,
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
    isAvailableNow: true,
  },
  {
    id: '3',
    name: 'Green Valley Sports',
    location: 'G-11, Islamabad',
    price: 3500,
    rating: 4.6,
    reviews: 38,
    slotsAvailable: 0,
    image: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
    type: '7-a-side',
    distance: '2.5 km',
    isAvailableNow: false,
  },
  {
    id: '4',
    name: 'Kickoff Arena',
    location: 'DHA Phase 2, Islamabad',
    price: 5000,
    rating: 4.7,
    reviews: 89,
    slotsAvailable: 4,
    image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800',
    type: '11-a-side',
    distance: '3.1 km',
    isAvailableNow: true,
  },
];

const filterOptions = ['All', '5-a-side', '7-a-side', 'Turf'];

export default function PlayerHome() {
  const { profile } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  const handleGroundPress = (groundId: string) => {
    router.push(`/ground/${groundId}`);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleSwitchToVendor = () => {
    setShowVendorModal(true);
  };

  const confirmSwitchToVendor = () => {
    setShowVendorModal(false);
    showToast('Switching to Vendor Mode...');
    setTimeout(() => {
      router.replace('/(vendor)');
    }, 500);
  };

  const handleNotifications = () => {
    setShowNotificationModal(true);
  };

  // Filter grounds
  const filteredGrounds = mockGrounds.filter(ground => {
    const matchesFilter = selectedFilter === 'All' || ground.type === selectedFilter;
    const matchesSearch = ground.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ground.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const availableGrounds = filteredGrounds.filter(g => g.isAvailableNow && g.slotsAvailable > 0);
  const nearYouGrounds = filteredGrounds.filter(g => !g.isAvailableNow || g.slotsAvailable === 0);

  const renderGroundCard = (ground: typeof mockGrounds[0], horizontal: boolean = false) => (
    <TouchableOpacity
      key={ground.id}
      className={`bg-white rounded-2xl overflow-hidden ${
        horizontal ? 'mr-4' : 'mb-4'
      }`}
      style={{
        width: horizontal ? width * 0.82 : '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
      }}
      onPress={() => handleGroundPress(ground.id)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: ground.image }}
        className="w-full h-44"
        resizeMode="cover"
      />
      
      <View className="absolute top-3 left-3 flex-row space-x-2">
        {ground.isAvailableNow && ground.slotsAvailable > 0 && (
          <View className="bg-[#4CAF50] px-2.5 py-1 rounded-full">
            <Text className="text-white text-[10px] font-bold">Available Now</Text>
          </View>
        )}
        {ground.slotsAvailable === 0 && (
          <View className="bg-[#EF4444] px-2.5 py-1 rounded-full">
            <Text className="text-white text-[10px] font-bold">Fully Booked</Text>
          </View>
        )}
      </View>

      <View className="absolute top-3 right-3 bg-white/90 px-2.5 py-1 rounded-full flex-row items-center">
        <Ionicons name="star" size={12} color="#F59E0B" />
        <Text className="text-[#1A1A2E] font-bold text-xs ml-0.5">{ground.rating}</Text>
      </View>

      <View className="p-4">
        <Text className="text-[#1A1A2E] text-base font-bold">{ground.name}</Text>
        
        <View className="flex-row items-center mt-0.5">
          <Ionicons name="location-outline" size={13} color="#737373" />
          <Text className="text-[#737373] text-xs ml-1 flex-1">{ground.location}</Text>
        </View>

        <View className="flex-row items-center mt-2">
          <View className="bg-[#F5F5F5] px-2 py-0.5 rounded-full">
            <Text className="text-[#737373] text-[10px]">{ground.type}</Text>
          </View>
          <Text className="text-[#737373] text-[10px] ml-2">• {ground.distance}</Text>
          {ground.slotsAvailable > 0 && (
            <Text className="text-[#4CAF50] text-[10px] ml-2 font-medium">
              • {ground.slotsAvailable} slots left
            </Text>
          )}
        </View>

        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-[#F5F5F5]">
          <Text className="text-[#4CAF50] font-bold text-base">
            PKR {ground.price}/hr
          </Text>
          <View className="bg-[#4CAF50] px-4 py-1.5 rounded-full">
            <Text className="text-white font-medium text-xs">Book Now</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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
        {/* ─── Header ─── */}
        <View className="px-6 pt-2 pb-2 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity className="flex-row items-center">
              <Ionicons name="location-outline" size={20} color="#4CAF50" />
              <Text className="text-[#1A1A2E] font-semibold ml-1">Rawalpindi</Text>
              <Ionicons name="chevron-down" size={16} color="#737373" />
            </TouchableOpacity>
          </View>
          <View className="flex-row items-center space-x-2">
            {/* Switch to Vendor Button */}
            <TouchableOpacity
              className="bg-[#F5F5F5] px-3 py-1.5 rounded-full flex-row items-center border border-[#E5E5E5]"
              onPress={handleSwitchToVendor}
            >
              <Ionicons name="business-outline" size={14} color="#4CAF50" />
              <Text className="text-[#4CAF50] text-[10px] font-medium ml-1">Vendor</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="bg-white w-9 h-9 rounded-full items-center justify-center"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              onPress={handleNotifications}
            >
              <Ionicons name="notifications-outline" size={20} color="#1A1A2E" />
              <View className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
            </TouchableOpacity>
            
            {/* <TouchableOpacity 
              className="bg-white w-9 h-9 rounded-full items-center justify-center"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              onPress={() => router.push('/(player)/profile')}
            >
              <Ionicons name="person-outline" size={20} color="#1A1A2E" />
            </TouchableOpacity> */}
          </View>
        </View>

        {/* ─── Search Bar ─── */}
        <View className="px-6 mt-2">
          <View className="flex-row items-center bg-white rounded-2xl px-4 py-3"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
          >
            <Ionicons name="search-outline" size={20} color="#737373" />
            <TextInput
              className="flex-1 ml-3 text-[#1A1A2E] text-base"
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

        {/* ─── Filter Chips ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-6 mt-4"
        >
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter}
              className={`px-5 py-2 rounded-full mr-2 ${
                selectedFilter === filter ? 'bg-[#4CAF50]' : 'bg-white'
              }`}
              style={selectedFilter !== filter ? { 
                shadowColor: '#000', 
                shadowOffset: { width: 0, height: 2 }, 
                shadowOpacity: 0.04, 
                shadowRadius: 4, 
                elevation: 1 
              } : {}}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text className={selectedFilter === filter ? 'text-white font-medium' : 'text-[#737373] font-medium'}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Available Now ─── */}
        {availableGrounds.length > 0 && (
          <View className="mt-6">
            <View className="px-6 flex-row items-center justify-between mb-3">
              <Text className="text-[#1A1A2E] text-lg font-bold">AVAILABLE NOW</Text>
              <TouchableOpacity>
                <Text className="text-[#4CAF50] font-medium text-sm">See all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="px-6"
            >
              {availableGrounds.map((ground) => renderGroundCard(ground, true))}
            </ScrollView>
          </View>
        )}

        {/* ─── Near You ─── */}
        <View className="mt-6 px-6 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[#1A1A2E] text-lg font-bold">NEAR YOU</Text>
            <TouchableOpacity>
              <Text className="text-[#4CAF50] font-medium text-sm">See all</Text>
            </TouchableOpacity>
          </View>

          {nearYouGrounds.length > 0 ? (
            nearYouGrounds.map((ground) => renderGroundCard(ground, false))
          ) : (
            availableGrounds.map((ground) => renderGroundCard(ground, false))
          )}
        </View>
      </ScrollView>

      {/* ─── TOAST NOTIFICATION ─── */}
      {toastVisible && (
        <View className="absolute top-20 left-4 right-4 bg-[#1A1A2E] rounded-xl p-4 flex-row items-center shadow-lg z-50"
          style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 }}
        >
          <View className="w-8 h-8 rounded-full bg-[#4CAF50]/20 items-center justify-center mr-3">
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          </View>
          <Text className="text-white text-sm flex-1">{toastMessage}</Text>
        </View>
      )}

      {/* ─── VENDOR MODE MODAL ─── */}
      <Modal
        visible={showVendorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVendorModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowVendorModal(false)}>
          <View className="flex-1 bg-black/50 items-center justify-center px-6">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-3xl p-6 w-full max-w-sm"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8 }}
              >
                {/* Icon */}
                <View className="items-center">
                  <View className="w-16 h-16 rounded-full bg-[#E8F5E9] items-center justify-center mb-4">
                    <Ionicons name="business-outline" size={32} color="#4CAF50" />
                  </View>
                  <Text className="text-xl font-bold text-[#1A1A2E]">Switch to Vendor</Text>
                  <Text className="text-[#737373] text-center mt-2 text-sm leading-5">
                    Switch to vendor mode to manage your grounds, view bookings, and track earnings.
                  </Text>
                </View>

                {/* Divider */}
                <View className="h-px bg-[#F5F5F5] my-4" />

                {/* Info Row */}
                <View className="flex-row items-center bg-[#F8F9FA] rounded-xl p-3 mb-4">
                  <Ionicons name="information-circle-outline" size={20} color="#4CAF50" />
                  <Text className="text-[#737373] text-xs ml-2 flex-1">
                    You can switch back to player mode anytime from the vendor dashboard.
                  </Text>
                </View>

                {/* Buttons */}
                <View className="flex-row space-x-3">
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl border border-[#E5E5E5]"
                    onPress={() => setShowVendorModal(false)}
                  >
                    <Text className="text-[#737373] text-center font-medium">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl bg-[#4CAF50]"
                    style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                    onPress={confirmSwitchToVendor}
                  >
                    <Text className="text-white text-center font-medium">Switch</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ─── NOTIFICATIONS MODAL ─── */}
      <Modal
        visible={showNotificationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotificationModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowNotificationModal(false)}>
          <View className="flex-1 bg-black/50 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-3xl p-6 min-h-[40%]">
                <View className="items-center mb-4">
                  <View className="w-12 h-1 bg-[#E5E5E5] rounded-full" />
                </View>

                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-[#1A1A2E]">Notifications</Text>
                  <TouchableOpacity onPress={() => setShowNotificationModal(false)}>
                    <Ionicons name="close" size={24} color="#737373" />
                  </TouchableOpacity>
                </View>

                <View className="flex-1 items-center justify-center py-8">
                  <View className="w-20 h-20 rounded-full bg-[#F5F5F5] items-center justify-center mb-4">
                    <Ionicons name="notifications-off-outline" size={40} color="#D4D4D4" />
                  </View>
                  <Text className="text-[#1A1A2E] font-semibold">No Notifications</Text>
                  <Text className="text-[#737373] text-sm mt-1 text-center">
                    We'll notify you when something needs your attention
                  </Text>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}