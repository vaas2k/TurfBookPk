import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Image, Dimensions, RefreshControl,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import VendorRegistrationModal from '@/components/vendor/VendorRegistrationModal';
import { useVendorStore } from '@/store/vendorStore';
import { VendorFormData } from '@/components/vendor/VendorRegistrationModal';
import { Ground, listPublicGrounds, searchPublicGrounds } from '@/lib/api/vendors';
import { listRecentlyViewedGrounds } from '@/lib/api/engagement';
import { getNotifications } from '@/lib/api/notifications';
import { appDialog } from '@/components/ui/app-dialog';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');

type PlayerGround = ReturnType<typeof toPlayerGround>;

const filterOptions = ['All', '5-a-side', '7-a-side', 'Turf'];

function distanceKm(from: { latitude: number; longitude: number }, ground: Ground): number | null {
  if (ground.latitude === null || ground.longitude === null) return null;
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(ground.latitude - from.latitude) / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(ground.latitude)) * Math.sin(radians(ground.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toPlayerGround(ground: Ground, distance: number | null = null) {
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
    distance: distance === null ? '' : `${distance.toFixed(1)} km away`,
    distanceKm: distance,
    isAvailableNow: ground.is_active,
  };
}

export default function PlayerHome() {
  const { profile, user, switchToVendor } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [groundList, setGroundList] = useState<PlayerGround[]>([]);
  const [groundPage, setGroundPage] = useState(1);
  const [hasMoreGrounds, setHasMoreGrounds] = useState(false);
  const [loadingMoreGrounds, setLoadingMoreGrounds] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [homeCity, setHomeCity] = useState(profile?.city || 'Your area');
  const [todayGrounds, setTodayGrounds] = useState<PlayerGround[]>([]);
  const [recentGrounds, setRecentGrounds] = useState<Ground[]>([]);

  // Modal states
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Vendor states
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isVendorLoading, setIsVendorLoading] = useState(false);
  const { registerVendor, checkVendorStatus } = useVendorStore();

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const today = () => new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const loadHome = useCallback(async () => {
    setRefreshing(true);
    try {
      const permission = await Location.getForegroundPermissionsAsync();
      const result = permission.granted ? permission : await Location.requestForegroundPermissionsAsync();
      let position: { latitude: number; longitude: number } | null = null;
      if (result.granted) {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        position = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        try {
          const place = (await Location.reverseGeocodeAsync(current.coords))[0];
          setHomeCity(place?.city || place?.subregion || place?.district || place?.region || profile?.city || 'Your area');
        } catch { setHomeCity(profile?.city || 'Your area'); }
      } else setHomeCity(profile?.city || 'Your area');
      const [discovery, notifications, viewed] = await Promise.all([
        searchPublicGrounds({ availability_date: today(), page: 1, limit: 30, sort: 'recommended' }), getNotifications(), listRecentlyViewedGrounds(),
      ]);
      setUnreadNotifications(notifications.unread_count);
      setRecentGrounds(viewed);
      const current = discovery.grounds.map((ground) => {
        const availableToday = (discovery.slots_by_ground[ground.id] || []).filter((slot) => slot.date === today() && !slot.is_booked && !slot.is_blocked && !slot.is_held).length;
        return { ...toPlayerGround(ground, position ? distanceKm(position, ground) : null), slotsAvailable: availableToday, isAvailableNow: availableToday > 0 };
      }).filter((ground) => ground.slotsAvailable > 0);
      current.sort((a, b) => a.distanceKm === null ? 1 : b.distanceKm === null ? -1 : a.distanceKm - b.distanceKm);
      setTodayGrounds(current);
    } catch (error) { console.log('[PlayerHome] Unable to load home feed:', error); }
    finally { setRefreshing(false); }
  }, [profile?.city]);

  useEffect(() => { loadHome(); }, [loadHome]);

  const compactNearbyCard = (ground: PlayerGround) => <TouchableOpacity key={ground.id} onPress={() => router.push({ pathname: '/(player)/ground/[id]', params: { id: ground.id } })} activeOpacity={0.86} className="bg-[#1A1C16] border border-[#293B29] rounded-[16px] overflow-hidden flex-row mb-3"><Image source={{ uri: ground.image }} className="w-[124px] h-[126px]" resizeMode="cover" /><View className="flex-1 px-3 py-3 justify-between"><View><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-[15px]" numberOfLines={1}>{ground.name}</Text><View className="flex-row items-center mt-1"><Ionicons name="location-outline" size={13} color="#E27A3F" /><Text className="text-[#AFAFA9] text-[11px] ml-1 flex-1" numberOfLines={1}>{ground.location}</Text></View></View><View className="flex-row items-end justify-between"><View><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#53B65B] text-sm">PKR {ground.price}/hr</Text><Text className="text-[#AFAFA9] text-[10px] mt-0.5">{ground.distance || `${ground.slotsAvailable} slots today`}</Text></View><Ionicons name="arrow-forward" size={19} color="#53B65B" /></View></View></TouchableOpacity>;

  const redesignedHome = <SafeAreaView className="flex-1 bg-[#12130F]"><StatusBar barStyle="light-content" backgroundColor="#12130F" /><ScrollView className="flex-1" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadHome} tintColor="#53B65B" />} showsVerticalScrollIndicator={false}><View className="px-5 pt-2 pb-3 flex-row items-center justify-between"><View className="flex-row items-center"><Ionicons name="location-outline" size={20} color="#E27A3F" /><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] ml-1" numberOfLines={1}>{homeCity}</Text><Ionicons name="chevron-down" size={16} color="#F8F7F0" /></View><TouchableOpacity className="bg-[#1A1C16] w-11 h-11 rounded-full items-center justify-center border border-[#3A4032]" onPress={() => router.push('/(player)/notifications')}><Ionicons name="notifications-outline" size={21} color="#F8F7F0" />{unreadNotifications > 0 && <View className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] items-center justify-center"><Text className="text-white text-[9px] font-bold">{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text></View>}</TouchableOpacity></View><View className="mx-5 mt-2 p-5 rounded-[24px] bg-[#24452A] border border-[#45724A] overflow-hidden"><Ionicons name="football-outline" size={100} color="#79CF7E" style={{ position: 'absolute', right: -19, bottom: -28, opacity: 0.23 }} /><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 30 }} className="text-white">BOOK YOUR NEXT MATCH</Text><Text className="text-[#D3EBD4] text-sm mt-1 w-3/4">Discover pitches near you with slots available today.</Text><TouchableOpacity onPress={() => router.push('/(player)/search')} className="mt-5 self-start bg-[#F3F4EF] rounded-full px-4 py-2.5 flex-row items-center"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#1A2B1B] text-xs">EXPLORE GROUNDS</Text><Ionicons name="arrow-forward" size={15} color="#1A2B1B" style={{ marginLeft: 7 }} /></TouchableOpacity></View><View className="mt-7 px-5"><View className="flex-row items-center justify-between mb-3"><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 24 }} className="text-[#F8F7F0]">NEAR YOU</Text><TouchableOpacity onPress={() => router.push('/(player)/nearby-grounds')}><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#61BD67] text-xs">SEE ALL</Text></TouchableOpacity></View>{todayGrounds.slice(0, 3).map(compactNearbyCard)}{todayGrounds.length === 0 && !refreshing && <Text className="text-[#B8B9B2] text-sm text-center py-6">No grounds have slots available today.</Text>}</View><View className="mt-7 pb-9"><View className="px-5 flex-row items-center justify-between mb-3"><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 24 }} className="text-[#F8F7F0]">RECENTLY VIEWED</Text><TouchableOpacity onPress={() => router.push('/(player)/recently-viewed')}><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#61BD67] text-xs">SEE ALL</Text></TouchableOpacity></View>{recentGrounds.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}>{recentGrounds.slice(0, 6).map((ground) => <TouchableOpacity key={ground.id} onPress={() => router.push({ pathname: '/(player)/ground/[id]', params: { id: ground.id } })} className="w-[180px] mr-3 bg-[#1A1C16] border border-[#293B29] rounded-[16px] overflow-hidden"><Image source={{ uri: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800' }} className="w-full h-[105px]" resizeMode="cover" /><View className="p-3"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-sm" numberOfLines={1}>{ground.title}</Text><Text className="text-[#AFAFA9] text-[11px] mt-1" numberOfLines={1}>{ground.location}</Text><Text className="text-[#53B65B] text-xs mt-2">PKR {ground.price_per_hour}/hr</Text></View></TouchableOpacity>)}</ScrollView> : <View className="mx-5 bg-[#1A1C16] border border-[#293B29] rounded-2xl px-4 py-5 flex-row items-center"><Ionicons name="time-outline" size={22} color="#61BD67" /><Text className="text-[#B8B9B2] text-xs ml-3 flex-1">Grounds you open will appear here.</Text></View>}</View></ScrollView></SafeAreaView>;

  const loadGrounds = useCallback(async () => {
    setRefreshing(true);
    try {
      const [discovery, notifications, locationPermission] = await Promise.all([listPublicGrounds(), getNotifications(), Location.getForegroundPermissionsAsync()]);
      setUnreadNotifications(notifications.unread_count);
      let currentLocation = userLocation;
      const permission = locationPermission.granted ? locationPermission : await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        currentLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude }; setUserLocation(currentLocation);
      }
      const withAvailability = discovery.grounds.map((ground) => {
        const available = discovery.availability_by_ground[ground.id]?.available_count ?? 0;
        return { ...toPlayerGround(ground, currentLocation ? distanceKm(currentLocation, ground) : null), slotsAvailable: available, isAvailableNow: ground.is_active && available > 0 };
      });
      withAvailability.sort((a, b) => a.distanceKm === null ? 1 : b.distanceKm === null ? -1 : a.distanceKm - b.distanceKm);
      setGroundList(withAvailability); setGroundPage(discovery.pagination.page); setHasMoreGrounds(discovery.pagination.has_more);
    } catch (error) {
      console.log('[PlayerHome] Ground load failed:', error);
    } finally { setRefreshing(false); }
  }, []);

  const loadMoreGrounds = useCallback(async () => {
    if (loadingMoreGrounds || !hasMoreGrounds) return;
    setLoadingMoreGrounds(true);
    try {
      const discovery = await listPublicGrounds(groundPage + 1);
      const additional = discovery.grounds.map((ground) => {
        const available = discovery.availability_by_ground[ground.id]?.available_count ?? 0;
        return { ...toPlayerGround(ground, userLocation ? distanceKm(userLocation, ground) : null), slotsAvailable: available, isAvailableNow: ground.is_active && available > 0 };
      });
      setGroundList((current) => [...current, ...additional].sort((a, b) => a.distanceKm === null ? 1 : b.distanceKm === null ? -1 : a.distanceKm - b.distanceKm));
      setGroundPage(discovery.pagination.page); setHasMoreGrounds(discovery.pagination.has_more);
    } catch (error) {
      showToast('Unable to load more grounds.');
    } finally { setLoadingMoreGrounds(false); }
  }, [groundPage, hasMoreGrounds, loadingMoreGrounds, userLocation]);

  useEffect(() => { loadGrounds(); }, [loadGrounds]);

  const onRefresh = loadGrounds;

  const handleGroundPress = (groundId: string) => {
    router.push(`/ground/${groundId}`);
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
  // Ground list is already distance-sorted when location permission is granted.
  // Keep the featured result out of the compact nearby list when possible.
  const nearbyGrounds = filteredGrounds.filter(g => g.id !== availableGrounds[0]?.id);

  const renderGroundCard = (ground: PlayerGround, horizontal: boolean = false) => (
    <TouchableOpacity
      key={ground.id}
      className={`bg-[#1A1C16] border border-[#2A3025] rounded-2xl overflow-hidden ${horizontal ? 'mr-4' : 'mb-4'
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
            <Text className="text-white text-[10px] font-bold">Upcoming slots</Text>
          </View>
        )}
        {ground.slotsAvailable === 0 && (
          <View className="bg-[#EF4444] px-2.5 py-1 rounded-full">
            <Text className="text-white text-[10px] font-bold">Fully Booked</Text>
          </View>
        )}
      </View>

      <View className="absolute top-3 right-3 bg-[#12130F]/90 px-2.5 py-1 rounded-full flex-row items-center">
        <Ionicons name="star" size={12} color="#F59E0B" />
        <Text className="text-[#F5F5F0] font-bold text-xs ml-0.5">{ground.rating}</Text>
      </View>

      <View className="p-4">
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F5F5F0] text-base">{ground.name}</Text>

        <View className="flex-row items-center mt-0.5">
          <Ionicons name="location-outline" size={13} color="#737373" />
          <Text className="text-[#A1A39D] text-xs ml-1 flex-1">{ground.location}</Text>
        </View>

        <View className="flex-row items-center mt-2">
          <View className="bg-[#283625] px-2 py-0.5 rounded-full">
            <Text className="text-[#B9E5BF] text-[10px]">{ground.type}</Text>
          </View>
          <Text className="text-[#737373] text-[10px] ml-2">• {ground.distance}</Text>
          {ground.slotsAvailable > 0 && (
            <Text className="text-[#4CAF50] text-[10px] ml-2 font-medium">
              • {ground.slotsAvailable} slots left
            </Text>
          )}
        </View>

        <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-[#F5F5F5]">
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#3EAF4C] text-base">
            PKR {ground.price}/hr
          </Text>
          <View className="bg-[#3EAF4C] px-4 py-1.5 rounded-full">
            <Text className="text-white font-medium text-xs">Book Now</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFeaturedCard = (ground: PlayerGround) => (
    <TouchableOpacity key={ground.id} className="bg-[#1A1C16] border border-[#2E5030] rounded-[18px] overflow-hidden" onPress={() => handleGroundPress(ground.id)} activeOpacity={0.86}>
      <Image source={{ uri: ground.image }} className="w-full h-56" resizeMode="cover" />
      <View className="px-4 py-3">
        <View className="flex-row items-center justify-between">
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-[17px] flex-1 mr-3" numberOfLines={1}>{ground.name}</Text>
          <View className="flex-row items-center"><Ionicons name="star" size={14} color="#F5A623" /><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-xs ml-1">{ground.rating || 'New'}</Text></View>
        </View>
        <View className="flex-row items-center mt-1"><Ionicons name="location-outline" size={14} color="#E27A3F" /><Text style={{ fontFamily: 'SpaceGrotesk_400Regular' }} className="text-[#B8B9B2] text-xs ml-1 flex-1" numberOfLines={1}>{ground.location}</Text></View>
        <View className="flex-row items-end justify-between mt-3"><View><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#53B65B] text-base">PKR {ground.price}/hr</Text><Text style={{ fontFamily: 'SpaceGrotesk_400Regular' }} className="text-[#B8B9B2] text-[11px] mt-0.5">{ground.slotsAvailable} slot{ground.slotsAvailable === 1 ? '' : 's'} available</Text></View><View className="border border-[#53B65B] rounded-full px-3 py-1.5"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#6FCC73] text-xs">BOOK</Text></View></View>
      </View>
    </TouchableOpacity>
  );

  const renderNearbyCard = (ground: PlayerGround) => (
    <TouchableOpacity key={ground.id} onPress={() => handleGroundPress(ground.id)} activeOpacity={0.86} className="bg-[#1A1C16] border border-[#293B29] rounded-[16px] overflow-hidden flex-row mb-3">
      <Image source={{ uri: ground.image }} className="w-[124px] h-[126px]" resizeMode="cover" />
      <View className="flex-1 px-3 py-3 justify-between"><View><View className="flex-row items-center justify-between"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] text-[15px] flex-1 mr-2" numberOfLines={1}>{ground.name}</Text><View className="flex-row items-center"><Ionicons name="star" size={12} color="#F5A623" /><Text className="text-[#F8F7F0] text-[11px] ml-1">{ground.rating || 'New'}</Text></View></View><View className="flex-row items-center mt-1"><Ionicons name="location-outline" size={13} color="#E27A3F" /><Text className="text-[#AFAFA9] text-[11px] ml-1 flex-1" numberOfLines={1}>{ground.location}</Text></View></View><View className="flex-row items-end justify-between"><View><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#53B65B] text-sm">PKR {ground.price}/hr</Text><Text className="text-[#AFAFA9] text-[10px] mt-0.5">{ground.distance || `${ground.slotsAvailable} slots available`}</Text></View><Ionicons name="arrow-forward" size={19} color="#53B65B" /></View></View>
    </TouchableOpacity>
  );

  if (false) return (
    <SafeAreaView className="flex-1 bg-[#12130F]">
      <StatusBar barStyle="light-content" backgroundColor="#12130F" />

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header ─── */}
        <View className="px-5 pt-2 pb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View accessibilityLabel="Current city: Rawalpindi" className="flex-row items-center">
              <Ionicons name="location-outline" size={20} color="#E27A3F" />
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F8F7F0] ml-1">Rawalpindi</Text>
              <Ionicons name="chevron-down" size={16} color="#F8F7F0" />
            </View>
          </View>
          <View className="flex-row items-center space-x-2">
            {/* Switch to Vendor Button */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Switch to vendor mode"
              className="hidden"
              onPress={handleSwitchToVendor}
            >
              <Ionicons name="business-outline" size={14} color="#4CAF50" />
              <Text className="text-[#4CAF50] text-[10px] font-medium ml-1">Switch</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-[#1A1C16] w-11 h-11 rounded-full items-center justify-center border border-[#3A4032]"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              onPress={handleNotifications}
              accessibilityRole="button"
              accessibilityLabel={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'}
            >
              <Ionicons name="notifications-outline" size={21} color="#F8F7F0" />
              {unreadNotifications > 0 && <View className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#DC2626] items-center justify-center"><Text className="text-white text-[9px] font-bold">{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Search Bar ─── */}
        <View className="px-5 mt-1">
          <View className="flex-row items-center bg-[#191B16] border border-[#3A4032] rounded-[12px] px-4 py-3"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}
          >
            <Ionicons name="search-outline" size={20} color="#AFAFA9" />
            <TextInput
              style={{ fontFamily: 'SpaceGrotesk_500Medium' }} className="flex-1 ml-3 text-[#F5F5F0] text-base"
              placeholder="Search for a ground"
              placeholderTextColor="#AFAFA9"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* ─── Filter Chips ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-5 mt-4"
        >
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter}
              className={`px-4 py-2 rounded-full mr-2 border ${selectedFilter === filter ? 'bg-[#53B65B] border-[#53B65B]' : 'bg-[#191B16] border-[#3A4032]'
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
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium' }} className={selectedFilter === filter ? 'text-[#10120F] text-xs' : 'text-[#D5D6CF] text-xs'}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ─── Available Now ─── */}
        {availableGrounds.length > 0 && (
          <View className="mt-7 px-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 24, letterSpacing: 0.3 }} className="text-[#F8F7F0]">AVAILABLE NOW</Text>
              <TouchableOpacity onPress={() => router.push('/(player)/search')} accessibilityRole="button" accessibilityLabel="See all available grounds">
                <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#61BD67] text-xs">SEE ALL</Text>
              </TouchableOpacity>
            </View>
            {renderFeaturedCard(availableGrounds[0])}
          </View>
        )}

        {/* ─── Near You ─── */}
        <View className="mt-7 px-5 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 24, letterSpacing: 0.3 }} className="text-[#F8F7F0]">NEAR YOU</Text>
            <TouchableOpacity onPress={() => router.push('/(player)/search')} accessibilityRole="button" accessibilityLabel="See all nearby grounds">
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#61BD67] text-xs">SEE ALL</Text>
            </TouchableOpacity>
          </View>

          {(nearbyGrounds.length > 0 ? nearbyGrounds : availableGrounds).slice(0, 3).map(renderNearbyCard)}
          {filteredGrounds.length === 0 && !refreshing && <View className="border border-dashed border-[#3A4032] rounded-2xl py-8 items-center"><Ionicons name="football-outline" size={28} color="#61BD67" /><Text style={{ fontFamily: 'SpaceGrotesk_500Medium' }} className="text-[#B8B9B2] mt-2">No grounds match your search.</Text></View>}
          {hasMoreGrounds && (
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Load more grounds" disabled={loadingMoreGrounds} onPress={loadMoreGrounds} className={`mt-2 rounded-xl py-3 items-center border ${loadingMoreGrounds ? 'bg-[#2B3127] border-[#3A4032]' : 'bg-[#1A1C16] border-[#53B65B]'}`}>
              <Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#61BD67] text-xs">{loadingMoreGrounds ? 'LOADING GROUNDS...' : 'LOAD MORE GROUNDS'}</Text>
            </TouchableOpacity>
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
  return redesignedHome;
}
