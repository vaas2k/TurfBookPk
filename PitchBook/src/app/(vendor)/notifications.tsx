import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from '@/lib/api/notifications';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';

export default function VendorNotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await getNotifications(1); setItems(result.notifications); setPage(1); setHasMore(result.pagination.has_more); }
    catch (caught: any) { setError(caught?.message || 'Unable to load notifications.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const loadMore = useCallback(async () => { if (loading || loadingMore || !hasMore) return; setLoadingMore(true); try { const result = await getNotifications(page + 1); setItems((current) => [...current, ...result.notifications]); setPage(result.pagination.page); setHasMore(result.pagination.has_more); } catch (caught: any) { setError(caught?.message || 'Unable to load more notifications.'); } finally { setLoadingMore(false); } }, [hasMore, loading, loadingMore, page]);
  const open = async (item: AppNotification) => { try { if (!item.isRead) { await markNotificationRead(item.id); setItems((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value)); } if (item.data?.bookingId) router.push(`/(vendor)/booking/${item.data.bookingId}`); } catch (caught: any) { setError(caught?.message || 'Unable to update notification.'); } };
  const markAll = async () => { try { await markAllNotificationsRead(); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); } catch (caught: any) { setError(caught?.message || 'Unable to mark notifications as read.'); } };
  const visualFor = (item: AppNotification) => {
    const content = `${item.type} ${item.title}`.toLowerCase();
    if (content.includes('refund') || content.includes('cancel')) return { icon: 'return-down-back-outline' as const, color: '#F4B844', surface: '#322D1D' };
    if (content.includes('payout') || content.includes('earning')) return { icon: 'card-outline' as const, color: '#42B84F', surface: '#17301B' };
    if (content.includes('reminder') || content.includes('maintenance')) return { icon: 'warning-outline' as const, color: '#F4B844', surface: '#322D1D' };
    return { icon: 'calendar-outline' as const, color: '#42B84F', surface: '#17301B' };
  };
  const sectionFor = (index: number) => {
    const current = new Date(items[index].createdAt);
    const now = new Date();
    const today = current.toDateString() === now.toDateString();
    const previousToday = index > 0 && new Date(items[index - 1].createdAt).toDateString() === now.toDateString();
    if (today && !previousToday) return 'TODAY';
    if (!today && (index === 0 || new Date(items[index - 1].createdAt).toDateString() !== current.toDateString())) return 'EARLIER';
    return null;
  };
  const relativeTime = (value: string) => {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1_440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(value).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  };

  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]">
    <StatusBar barStyle="light-content" backgroundColor="#10120F" />
    <View className="px-6 pt-5 pb-3 flex-row items-center"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[21px] text-[#F5F5F0] flex-1">NOTIFICATIONS</Text>{items.some((item) => !item.isRead) && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mark all notifications read" onPress={markAll} className="py-2"><Text className="text-[#42B84F] text-sm font-semibold">Mark all read</Text></TouchableOpacity>}</View>
    <FlatList data={items} keyExtractor={(item) => item.id} className="px-6" contentContainerStyle={{ paddingTop: 6, paddingBottom: 32, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#42B84F" colors={['#42B84F']} />} onEndReached={loadMore} onEndReachedThreshold={0.5} ListEmptyComponent={loading ? <ActivityIndicator className="mt-16" color="#42B84F" /> : <View className="items-center pt-24"><Ionicons name="notifications-outline" size={38} color="#6F756D" /><Text className="text-[#F5F5F0] font-bold mt-4">No notifications yet</Text><Text className="text-[#92978F] text-sm mt-1">Booking updates will appear here.</Text></View>} ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color="#42B84F" /> : null} renderItem={({ item, index }) => { const visual = visualFor(item); const section = sectionFor(index); return <>{section && <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 14 }} className="text-[#949990] mt-3 mb-2">{section}</Text>}<TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.isRead ? 'Read' : 'Unread'} notification: ${item.title}`} onPress={() => open(item)} className={`rounded-xl p-4 mb-3 border ${item.isRead ? 'bg-[#1B1F19] border-transparent' : 'bg-[#1B1F19] border-[#30372B]'}`}><View className="flex-row items-center"><View className={`h-2 w-2 rounded-full mr-3 ${item.isRead ? 'bg-transparent' : 'bg-[#42B84F]'}`} /><View style={{ backgroundColor: visual.surface }} className="w-10 h-10 rounded-full items-center justify-center mr-3"><Ionicons name={visual.icon} size={20} color={visual.color} /></View><View className="flex-1"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className={`text-[14px] ${item.isRead ? 'text-[#B8BBB5]' : 'text-[#F5F5F0]'}`}>{item.title}</Text><Text className="text-[#969C93] text-xs leading-4 mt-0.5" numberOfLines={2}>{item.message}</Text><Text className="text-[#777D74] text-[11px] mt-1">{relativeTime(item.createdAt)}</Text></View>{item.data?.bookingId && <Ionicons name="chevron-forward" size={17} color="#858B82" />}</View></TouchableOpacity></>; }} />
    <Toast message={error} tone="error" onHide={() => setError(null)} />
  </SafeAreaView>;
}
