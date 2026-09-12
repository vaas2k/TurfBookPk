import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Image, Dimensions, RefreshControl,
  Platform, StatusBar, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import VendorRegistrationModal from '@/components/vendor/VendorRegistrationModal';
import { useVendorStore } from '@/store/vendorStore';
import { VendorFormData } from '@/components/vendor/VendorRegistrationModal';
import { Ground, listGroundSlots, listPublicGrounds } from '@/lib/api/vendors';
import { getNotifications } from '@/lib/api/notifications';
import { appDialog } from '@/components/ui/app-dialog';

const { width } = Dimensions.get('window');

type PlayerGround = ReturnType<typeof toPlayerGround>;

const filterOptions = ['All', '5-a-side', '7-a-side', 'Turf'];

function toPlayerGround(ground: Ground) {
  return {
    id: ground.id,
    name: ground.title,
    location: ground.location,
    price: ground.price_per_hour,
    rating: ground.rating,
    reviews: ground.total_reviews,
    slotsAvailable: ground.is_active ? 1 : 0,
    image: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800',
    type: ground.pitch_type || 'Turf',
    distance: '',
    isAvailableNow: ground.is_active,
  };
}

export default function PlayerHome() {
  const { profile, user, switchToVendor } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [groundList, setGroundList] = useState<PlayerGround[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Modal states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Vendor states
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isVendorLoading, setIsVendorLoading] = useState(false);
  const { registerVendor, checkVendorStatus } = useVendorStore();

  const loadGrounds = useCallback(async () => {
    setRefreshing(true);
    try {
      const [grounds, notifications] = await Promise.all([listPublicGrounds(), getNotifications()]);
      setUnreadNotifications(notifications.unread_count);
      const withAvailability = await Promise.all(grounds.map(async (ground) => {
        const slots = await listGroundSlots(ground.id);
        const available = slots.filter((slot) => !slot.is_booked && !slot.is_blocked).length;
        return { ...toPlayerGround(ground), slotsAvailable: available, isAvailableNow: ground.is_active && available > 0 };
      }));
      setGroundList(withAvailability);
    } catch (error) {
      console.log('[PlayerHome] Ground load failed:', error);
    } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { loadGrounds(); }, [loadGrounds]);

  const onRefresh = loadGrounds;

  const handleGroundPress = (groundId: string) => {
    router.push(`/ground/${groundId}`);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleSwitchToVendor = async () => {
    if (!user) {
      appDialog.alert('Error', 'Please login first');
      return;
    }

    // Check if user is already a vendor
    const { isVendor } = await checkVendorStatus(user.id);

    if (isVendor) {
      appDialog.alert(
        'Switch to Vendor Mode',
        'You can return to player mode anytime to book a ground.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch',
            onPress: async () => {
              const { error } = await switchToVendor();
              if (error) appDialog.alert('Unable to switch modes', error.message);
              else router.replace('/(vendor)');
            },
          },
        ],
      );
    } else {
      // Show registration modal
      setShowVendorModal(true);
    }
  };

  const handleVendorRegister = async (formData: VendorFormData) => {
    setIsVendorLoading(true);
    const { error } = await registerVendor(formData);
    setIsVendorLoading(false);

    if (error) {
      appDialog.alert('Registration Failed', error);
    } else {
      setShowVendorModal(false);
      appDialog.alert(
        'Registration Successful!',
        'Your vendor account has been created. You can now manage your grounds.',
        [{ text: 'Continue', onPress: () => router.replace('/(vendor)') }]
      );
    }
  };

  const handleNotifications = () => {
    router.push('/(player)/notifications');
  };

  // Filter grounds
  const filteredGrounds = groundList.filter(ground => {
    const matchesFilter = selectedFilter === 'All' || ground.type === selectedFilter;
    const matchesSearch = ground.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ground.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const availableGrounds = filteredGrounds.filter(g => g.isAvailableNow && g.slotsAvailable > 0);
  const nearYouGrounds = filteredGrounds.filter(g => !g.isAvailableNow || g.slotsAvailable === 0);

  const renderGroundCard = (ground: PlayerGround, horizontal: boolean = false) => (
    <TouchableOpacity
      key={ground.id}
      className={`bg-white rounded-2xl overflow-hidden ${horizontal ? 'mr-4' : 'mb-4'
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
            <View accessibilityLabel="Current city: Rawalpindi" className="flex-row items-center">
              <Ionicons name="location-outline" size={20} color="#4CAF50" />
              <Text className="text-[#1A1A2E] font-semibold ml-1">Rawalpindi</Text>
            </View>
          </View>
          <View className="flex-row items-center space-x-2">
            {/* Switch to Vendor Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Switch to vendor mode"
              className="bg-[#F5F5F5] min-h-[44px] px-3 rounded-full flex-row items-center border border-[#E5E5E5]"
              onPress={handleSwitchToVendor}
            >
              <Ionicons name="business-outline" size={14} color="#4CAF50" />
              <Text className="text-[#4CAF50] text-[10px] font-medium ml-1">Switch</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white w-11 h-11 rounded-full items-center justify-center"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              onPress={handleNotifications}
              accessibilityRole="button"
              accessibilityLabel={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'}
            >
              <Ionicons name="notifications-outline" size={20} color="#1A1A2E" />
              {unreadNotifications > 0 && <View className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] items-center justify-center"><Text className="text-white text-[9px] font-bold">{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text></View>}
            </TouchableOpacity>
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
              className={`px-5 py-2 rounded-full mr-2 ${selectedFilter === filter ? 'bg-[#4CAF50]' : 'bg-white'
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

      {/* ─── NOTIFICATIONS MODAL ─── */}
      {/* ─── VENDOR REGISTRATION MODAL (Full Screen) ─── */}
      <VendorRegistrationModal
        visible={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        onRegister={handleVendorRegister}
        isLoading={isVendorLoading}
      />
    </SafeAreaView>
  );
}
