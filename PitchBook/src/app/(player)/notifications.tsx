import { View, Text, TouchableOpacity, ScrollView, FlatList, StatusBar, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  date: string;
  type: 'booking' | 'reminder' | 'payment' | 'cancellation';
  isRead: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'Booking Confirmed!',
    message: 'Kickoff Arena Pitch 1 • Sat, Oct 12 • 8:00 PM',
    time: '2 hours ago',
    date: 'TODAY',
    type: 'booking',
    isRead: false,
  },
  {
    id: '2',
    title: 'Match starts in 2 hours',
    message: "Don't forget your cleats and water bottle!",
    time: '2 hours ago',
    date: 'TODAY',
    type: 'reminder',
    isRead: false,
  },
  {
    id: '3',
    title: 'Booking Cancelled',
    message: 'Green Valley • Pitch 2 has been cancelled. Refund initiated.',
    time: '2 days ago',
    date: 'EARLIER',
    type: 'cancellation',
    isRead: true,
  },
  {
    id: '4',
    title: 'Payment Successful',
    message: 'Rs 3,000 paid successfully via JazzCash',
    time: '3 days ago',
    date: 'EARLIER',
    type: 'payment',
    isRead: true,
  },
];

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'booking':
      return { name: 'checkmark-circle', color: '#4CAF50', bg: '#E8F5E9' };
    case 'reminder':
      return { name: 'alarm', color: '#F59E0B', bg: '#FEF3C7' };
    case 'payment':
      return { name: 'cash', color: '#3B82F6', bg: '#EFF6FF' };
    case 'cancellation':
      return { name: 'close-circle', color: '#EF4444', bg: '#FEE2E2' };
    default:
      return { name: 'notifications', color: '#737373', bg: '#F5F5F5' };
  }
};

export default function NotificationsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: false })));
  };

  const handleNotificationPress = (id: string) => {
    // Mark as read
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    // Navigate to relevant screen
  };

  const groupNotifications = () => {
    const groups: { [key: string]: Notification[] } = {};
    notifications.forEach(n => {
      if (!groups[n.date]) groups[n.date] = [];
      groups[n.date].push(n);
    });
    return groups;
  };

  const groupedNotifications = groupNotifications();

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = getNotificationIcon(item.type);
    return (
      <TouchableOpacity
        className={`flex-row items-start p-4 border-b border-[#F5F5F5] ${item.isRead ? 'bg-white' : 'bg-[#F0FDF4]'}`}
        onPress={() => handleNotificationPress(item.id)}
        activeOpacity={0.7}
      >
        <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: icon.bg }}>
          <Ionicons name={icon.name as any} size={20} color={icon.color} />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-[#1A1A2E] text-sm font-semibold font-semibold">{item.title}</Text>
          <Text className="text-[#737373] text-sm font-regular mt-0.5">{item.message}</Text>
          <Text className="text-[#737373] text-xs font-regular mt-1">{item.time}</Text>
        </View>
        {!item.isRead && (
          <View className="w-2 h-2 rounded-full bg-[#4CAF50] mt-2" />
        )}
      </TouchableOpacity>
    );
  };

  // Empty State
  if (notifications.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8F9FA]">
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        
        <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center justify-between">
          <Text className="text-2xl font-bold font-bold text-[#1A1A2E]">NOTIFICATIONS</Text>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <View className="w-24 h-24 rounded-full bg-[#F5F5F5] items-center justify-center mb-6">
            <Ionicons name="notifications-off-outline" size={48} color="#D4D4D4" />
          </View>
          <Text className="text-[#1A1A2E] text-xl font-bold font-bold text-center">NO NOTIFICATIONS YET</Text>
          <Text className="text-[#737373] text-center mt-2 text-sm font-regular">
            We'll let you know when something needs your attention.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      {/* Header */}
      <View className="bg-white px-6 pt-4 pb-4 border-b border-[#E5E5E5] flex-row items-center justify-between">
        <Text className="text-2xl font-bold font-bold text-[#1A1A2E]">NOTIFICATIONS</Text>
        <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7}>
          <Text className="text-[#4CAF50] font-medium font-medium">Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={Object.entries(groupedNotifications)}
        renderItem={({ item: [date, items] }) => (
          <View>
            <View className="px-4 py-3 bg-[#F8F9FA]">
              <Text className="text-[#737373] text-sm font-medium font-medium">{date}</Text>
            </View>
            <View className="bg-white">
              {items.map((notification) => (
                <View key={notification.id}>
                  {renderNotification({ item: notification })}
                </View>
              ))}
            </View>
          </View>
        )}
        keyExtractor={([date]) => date}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}