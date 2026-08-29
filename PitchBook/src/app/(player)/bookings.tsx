import { View, Text, TouchableOpacity, ScrollView, FlatList, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';

type BookingStatus = 'upcoming' | 'past' | 'cancelled';
type TabType = 'upcoming' | 'past' | 'cancelled';

interface Booking {
  id: string;
  groundName: string;
  pitch: string;
  type: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
  isToday?: boolean;
}

const mockBookings: Booking[] = [
  {
    id: '1',
    groundName: 'Arena 11 Sports',
    pitch: 'Pitch 1 • 5-a-side',
    type: '5-a-side',
    date: 'TODAY',
    time: '7:00 PM - 8:00 PM',
    status: 'confirmed',
    isToday: true,
  },
  {
    id: '2',
    groundName: 'Total Football',
    pitch: 'Pitch 2 • 7-a-side',
    type: '7-a-side',
    date: 'Mon, 18 Aug',
    time: '9:00 PM - 10:00 PM',
    status: 'pending',
  },
  {
    id: '3',
    groundName: 'KICKOFF ARENA',
    pitch: '5-a-side • Pitch 2',
    type: '5-a-side',
    date: 'Sat, Oct 12',
    time: '8:00 PM - 9:00 PM',
    status: 'confirmed',
  },
  {
    id: '4',
    groundName: 'ASKARI TURF',
    pitch: '5-a-side • Main Pitch',
    type: '5-a-side',
    date: 'Wed, Oct 16',
    time: '9:30 PM - 10:30 PM',
    status: 'confirmed',
  },
  {
    id: '5',
    groundName: 'Green Valley Sports',
    pitch: 'Pitch 3 • 5-a-side',
    type: '5-a-side',
    date: 'Fri, Oct 4',
    time: '6:00 PM - 7:00 PM',
    status: 'completed',
  },
  {
    id: '6',
    groundName: 'City Sports Complex',
    pitch: 'Pitch 1 • 7-a-side',
    type: '7-a-side',
    date: 'Sun, Sep 29',
    time: '5:00 PM - 6:00 PM',
    status: 'cancelled',
  },
];

export default function MyBookings() {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(mockBookings);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const filteredBookings = bookings.filter((booking) => {
    if (activeTab === 'upcoming') {
      return booking.status === 'confirmed' || booking.status === 'pending';
    }
    if (activeTab === 'past') {
      return booking.status === 'completed';
    }
    return booking.status === 'cancelled';
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-[#4CAF50] bg-[#E8F5E9]';
      case 'pending':
        return 'text-[#F59E0B] bg-[#FEF3C7]';
      case 'completed':
        return 'text-[#3B82F6] bg-[#EFF6FF]';
      case 'cancelled':
        return 'text-[#EF4444] bg-[#FEE2E2]';
      default:
        return 'text-[#737373] bg-[#F5F5F5]';
    }
  };

  const handleBookingPress = (bookingId: string) => {
    router.push(`/booking/${bookingId}`);
  };

  const renderBookingItem = ({ item }: { item: Booking }) => (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mb-3"
      style={{ 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.04, 
        shadowRadius: 8, 
        elevation: 2 
      }}
      onPress={() => handleBookingPress(item.id)}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-[#1A1A2E] text-base font-bold font-bold">{item.groundName}</Text>
          <Text className="text-[#737373] text-sm font-regular mt-0.5">{item.pitch}</Text>
          
          <View className="flex-row items-center mt-2">
            {item.isToday && (
              <View className="bg-[#FF6B35] px-2 py-0.5 rounded-full mr-2">
                <Text className="text-white text-[10px] font-bold font-bold">TODAY</Text>
              </View>
            )}
            <Text className="text-[#1A1A2E] text-sm font-medium font-medium">
              {item.date} • {item.time}
            </Text>
          </View>
        </View>
        
        <View className={`px-3 py-1.5 rounded-full ${getStatusColor(item.status)}`}>
          <Text className={`text-xs font-medium font-medium uppercase ${getStatusColor(item.status).split(' ')[0]}`}>
            {item.status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View className="flex-1 items-center justify-center px-6 py-12">
      <View className="w-24 h-24 rounded-full bg-[#F5F5F5] items-center justify-center mb-6">
        <Ionicons name="calendar-outline" size={48} color="#D4D4D4" />
      </View>
      <Text className="text-[#1A1A2E] text-xl font-bold font-bold text-center">NO BOOKINGS YET</Text>
      <Text className="text-[#737373] text-center mt-2 text-sm font-regular">
        Find a ground and book your first match
      </Text>
      <TouchableOpacity
        className="bg-[#4CAF50] px-8 py-3 rounded-full mt-6"
        style={{ shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
        onPress={() => router.push('/(player)')}
      >
        <Text className="text-white font-semibold font-semibold">Discover grounds</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View className="px-6 pt-4 pb-4 bg-white border-b border-[#E5E5E5]">
        <Text className="text-2xl font-bold font-bold text-[#1A1A2E]">MY BOOKINGS</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white px-6 pt-2 border-b border-[#E5E5E5]">
        {(['upcoming', 'past', 'cancelled'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`py-3 mr-6 ${activeTab === tab ? 'border-b-2 border-[#4CAF50]' : ''}`}
            onPress={() => setActiveTab(tab)}
          >
            <Text className={`text-base font-medium font-medium ${
              activeTab === tab ? 'text-[#1A1A2E]' : 'text-[#737373]'
            }`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bookings List */}
      {filteredBookings.length > 0 ? (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.id}
          className="px-4 pt-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      ) : (
        <ScrollView 
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
          }
        >
          <EmptyState />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}