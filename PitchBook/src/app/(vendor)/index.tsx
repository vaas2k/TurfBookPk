import { View, Text, TouchableOpacity, ScrollView, RefreshControl, StatusBar, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useVendorStore } from '@/store/vendorStore';
import { Ground, listVendorGrounds } from '@/lib/api/vendors';

export default function VendorDashboard() {
  const { profile, signOut, switchToPlayer } = useAuthStore();
  const { vendorProfile } = useVendorStore();
  const [refreshing, setRefreshing] = useState(false);
  const [grounds, setGrounds] = useState<Ground[]>([]);

  const loadGrounds = useCallback(async () => {
    setRefreshing(true);
    try { setGrounds(await listVendorGrounds()); }
    catch (error) { console.log('[VendorDashboard] Ground load failed:', error); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => {
    loadGrounds();
  }, [loadGrounds]));

  const onRefresh = loadGrounds;

  const stats = {
    totalGrounds: grounds.length,
    todayBookings: 0,
    totalRevenue: 0,
    rating: 0,
  };


  const handleSwitchToPlayer = async () => {
    Alert.alert(
      'Switch to Player Mode',
      'You will switch back to player view. You can switch back to vendor anytime from the player home screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            const { error } = await switchToPlayer();
            if (error) Alert.alert('Unable to switch modes', error.message);
            else router.replace('/(player)');
          }
        }
      ]
    );
  };
  const handleSignOut = () => Alert.alert('Sign out?', 'You will need to verify your phone number to sign in again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/phone-input'); } },
  ]);
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
            <Text className="text-[#737373] text-sm">Welcome back,</Text>
            <Text className="text-2xl font-bold text-[#1A1A2E]">
              {vendorProfile?.business_name || profile?.full_name || 'Vendor'}
            </Text>
            <View className="flex-row items-center mt-1">
              <View className="bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                <Text className="text-[#4CAF50] text-[10px] font-medium">Vendor</Text>
              </View>
              {vendorProfile?.is_verified === false && (
                <View className="bg-[#FEF3C7] px-2 py-0.5 rounded-full ml-2">
                  <Text className="text-[#F59E0B] text-[10px] font-medium">Pending Verification</Text>
                </View>
              )}
            </View>
          </View>


<View className="flex-row items-center gap-3">

          <TouchableOpacity
            className="bg-white w-10 h-10 rounded-full items-center justify-center"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            onPress={() => router.push('/(vendor)/notifications')}>
            <Ionicons name="notifications-outline" size={20} color="#1A1A2E" />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            className="bg-white w-10 h-10 rounded-full items-center justify-center"
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-white w-10 h-10 rounded-full items-center justify-center"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            onPress={handleSwitchToPlayer}
          >
            <Ionicons name="person-outline" size={20} color="#4CAF50" />
          </TouchableOpacity>
            </View>

        </View>

        {/* Stats Cards */}
        <View className="px-6 mt-4">
          <View className="flex-row space-x-3">
            <View className="flex-1 bg-white rounded-2xl p-4"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
              <Text className="text-[#737373] text-xs">Total Grounds</Text>
              <Text className="text-2xl font-bold text-[#1A1A2E] mt-1">{stats.totalGrounds}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
              <Text className="text-[#737373] text-xs">Today's Bookings</Text>
              <Text className="text-2xl font-bold text-[#1A1A2E] mt-1">{stats.todayBookings}</Text>
            </View>
          </View>
          <View className="flex-row space-x-3 mt-3">
            <View className="flex-1 bg-white rounded-2xl p-4"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
              <Text className="text-[#737373] text-xs">Revenue</Text>
              <Text className="text-2xl font-bold text-[#4CAF50] mt-1">Rs {stats.totalRevenue}</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
              <Text className="text-[#737373] text-xs">Rating</Text>
              <View className="flex-row items-center mt-1">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text className="text-2xl font-bold text-[#1A1A2E] ml-1">{stats.rating || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mt-6">
          <Text className="text-[#1A1A2E] text-base font-bold mb-3">Quick Actions</Text>
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className="flex-1 bg-[#4CAF50] rounded-2xl p-4 items-center"
              style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 }}
              onPress={() => router.push('/(vendor)/add-ground')}
            >
              <Ionicons name="add-circle-outline" size={28} color="white" />
              <Text className="text-white font-medium mt-1 text-sm">Add Ground</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-white rounded-2xl p-4 items-center"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              onPress={() => router.push('/(vendor)/bookings')}
            >
              <Ionicons name="calendar-outline" size={28} color="#1A1A2E" />
              <Text className="text-[#1A1A2E] font-medium mt-1 text-sm">View Bookings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-white rounded-2xl p-4 items-center"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
              onPress={() => router.push('/(vendor)/earnings')}
            >
              <Ionicons name="wallet-outline" size={28} color="#1A1A2E" />
              <Text className="text-[#1A1A2E] font-medium mt-1 text-sm">Earnings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Grounds showcase */}
        <View className="px-6 mt-6 pb-8">
          {grounds.length > 0 ? <View><View className="flex-row items-center justify-between mb-3"><Text className="text-[#1A1A2E] text-base font-bold">Your Grounds</Text><TouchableOpacity onPress={() => router.push('/(vendor)/grounds')}><Text className="text-[#4CAF50] font-medium">View all</Text></TouchableOpacity></View>{grounds.slice(0, 3).map((ground) => <TouchableOpacity key={ground.id} className="bg-white rounded-2xl mb-3 overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }} onPress={() => router.push({ pathname: '/(vendor)/ground-slots', params: { id: ground.id, title: ground.title } })}><View className="flex-row"><Image source={{ uri: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800' }} className="w-24 h-24" resizeMode="cover" /><View className="flex-1 p-3"><View className="flex-row items-center justify-between"><Text className="text-[#1A1A2E] font-bold flex-1" numberOfLines={1}>{ground.title}</Text><Ionicons name="chevron-forward" size={18} color="#A3A3A3" /></View><Text className="text-[#737373] text-sm mt-1" numberOfLines={1}>{ground.city} · Rs {ground.price_per_hour}/hr</Text><Text className="text-[#4CAF50] text-xs mt-2">Manage slots</Text></View></View></TouchableOpacity>)}</View> : <View className="bg-white rounded-2xl p-8 items-center"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
            <Ionicons name="business-outline" size={48} color="#D4D4D4" />
            <Text className="text-[#1A1A2E] text-lg font-bold mt-4">No Grounds Yet</Text>
            <Text className="text-[#737373] text-sm text-center mt-1">
              Add your first ground to start accepting bookings
            </Text>
            <TouchableOpacity
              className="mt-4 bg-[#4CAF50] px-6 py-3 rounded-full"
              style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
              onPress={() => router.push('/(vendor)/add-ground')}
            >
              <Text className="text-white font-medium">Add Ground</Text>
            </TouchableOpacity>
          </View>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
