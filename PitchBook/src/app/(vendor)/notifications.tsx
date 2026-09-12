import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api/notifications';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';

export default function VendorNotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await getNotifications()).notifications); }
    catch (caught: any) { setError(caught?.message || 'Unable to load notifications.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const open = async (item: AppNotification) => { try { if (!item.isRead) { await markNotificationRead(item.id); setItems((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value)); } if (item.data?.bookingId) router.push(`/(vendor)/booking/${item.data.bookingId}`); } catch (caught: any) { setError(caught?.message || 'Unable to update notification.'); } };
  const markAll = async () => { try { await markAllNotificationsRead(); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); } catch (caught: any) { setError(caught?.message || 'Unable to mark notifications as read.'); } };

  return <SafeAreaView className="flex-1 bg-[#F8F9FA]">
    <View className="px-5 py-4 bg-white border-b border-[#E5E5E5] flex-row items-center">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOrReplace('/(vendor)')} className="w-11 h-11 rounded-full bg-[#F5F5F5] items-center justify-center mr-3"><Ionicons name="arrow-back" size={20} color="#1A1A2E" /></TouchableOpacity>
      <Text className="text-2xl font-bold text-[#1A1A2E] flex-1">Notifications</Text>
      {items.some((item) => !item.isRead) && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mark all notifications read" onPress={markAll} className="px-2 py-3"><Text className="text-[#2E7D32] text-sm font-semibold">Mark all read</Text></TouchableOpacity>}
    </View>
    <ScrollView className="p-4" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#4CAF50']} />}>
      {loading && items.length === 0 ? <ActivityIndicator color="#4CAF50" /> : items.length === 0 ? <Text className="text-[#737373] text-center py-12">No vendor notifications yet.</Text> : items.map((item) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.isRead ? 'Read' : 'Unread'} notification: ${item.title}`} key={item.id} onPress={() => open(item)} className={`rounded-2xl p-4 mb-3 border ${item.isRead ? 'bg-white border-[#E5E5E5]' : 'bg-[#F0FDF4] border-[#86EFAC]'}`}><View className="flex-row"><View className={`w-2 h-2 rounded-full mt-2 mr-3 ${item.isRead ? 'bg-transparent' : 'bg-[#4CAF50]'}`} /><View className="flex-1"><Text className="text-[#1A1A2E] font-bold">{item.title}</Text><Text className="text-[#737373] mt-1">{item.message}</Text><Text className="text-[#9CA3AF] text-xs mt-2">{new Date(item.createdAt).toLocaleString()}</Text></View>{item.data?.bookingId && <Ionicons name="chevron-forward" size={18} color="#737373" />}</View></TouchableOpacity>)}
    </ScrollView>
    <Toast message={error} tone="error" onHide={() => setError(null)} />
  </SafeAreaView>;
}
