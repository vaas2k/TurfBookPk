import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getNotifications, markAllNotificationsRead, markNotificationRead, AppNotification } from '@/lib/api/notifications';
import { Toast } from '@/components/ui/toast';
import { goBackOrReplace } from '@/lib/navigation';
import { useAppearanceStore } from '@/store/appearanceStore';
import { playerThemes } from '@/theme/playerTheme';

export default function NotificationsScreen() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { const result = await getNotifications(1); setItems(result.notifications); setPage(1); setHasMore(result.pagination.has_more); } catch (caught: any) { setError(caught?.message || 'Unable to load notifications.'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const loadMore = useCallback(async () => { if (loading || loadingMore || !hasMore) return; setLoadingMore(true); try { const result = await getNotifications(page + 1); setItems((current) => [...current, ...result.notifications]); setPage(result.pagination.page); setHasMore(result.pagination.has_more); } catch (caught: any) { setError(caught?.message || 'Unable to load more notifications.'); } finally { setLoadingMore(false); } }, [hasMore, loading, loadingMore, page]);
  const open = async (item: AppNotification) => { try { if (!item.isRead) { await markNotificationRead(item.id); setItems((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value)); } if (item.data?.destination === 'vendor_verification') router.push('/(player)/profile?openVendorVerification=1'); else if (item.data?.bookingId) router.push(`/(player)/booking/${item.data.bookingId}`); } catch (caught: any) { setError(caught?.message || 'Unable to update notification.'); } };
  const markAll = async () => { try { await markAllNotificationsRead(); setItems((current) => current.map((item) => ({ ...item, isRead: true }))); } catch (caught: any) { setError(caught?.message || 'Unable to mark notifications as read.'); } };
  const notificationVisual = (item: AppNotification) => {
    const text = `${item.title} ${item.message}`.toLowerCase();
    if (text.includes('cancel') || text.includes('refund')) return { icon: 'warning-outline' as const, iconColor: '#D84943', surface: appearance === 'dark' ? '#3A211E' : '#FCE9E7' };
    if (text.includes('payment')) return { icon: 'card-outline' as const, iconColor: theme.green, surface: theme.businessSurface };
    if (text.includes('reminder') || text.includes('starts')) return { icon: 'time-outline' as const, iconColor: '#B66B00', surface: appearance === 'dark' ? '#342B18' : '#FFF3D7' };
    return { icon: 'checkmark-circle-outline' as const, iconColor: theme.green, surface: theme.businessSurface };
  };
  const renderItem = ({ item, index }: { item: AppNotification; index: number }) => {
    const visual = notificationVisual(item); const earlier = new Date(item.createdAt).getTime() < Date.now() - 86_400_000; const previous = items[index - 1]; const startsSection = index === 0 || (previous && (new Date(previous.createdAt).getTime() < Date.now() - 86_400_000) !== earlier);
    return <>{startsSection && <Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 16, color: theme.muted }} className="mt-3 mb-2">{earlier ? 'EARLIER' : 'TODAY'}</Text>}<TouchableOpacity accessibilityRole="button" accessibilityLabel={`${item.isRead ? 'Read' : 'Unread'} notification: ${item.title}`} onPress={() => open(item)} className="rounded-[18px] p-3 mb-2.5 border" style={{ borderColor: theme.border, backgroundColor: theme.surface }}><View className="flex-row items-center"><View style={{ backgroundColor: item.isRead ? 'transparent' : theme.green }} className="w-2 h-2 rounded-full mr-3" /><View style={{ backgroundColor: visual.surface }} className="w-11 h-11 rounded-[14px] items-center justify-center mr-3"><Ionicons name={visual.icon} size={23} color={visual.iconColor} /></View><View className="flex-1"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: theme.text }} className="text-[15px]" numberOfLines={1}>{item.title}</Text><Text style={{ color: theme.subtle }} className="text-[13px] mt-0.5 leading-4" numberOfLines={2}>{item.message}</Text>{item.data?.bookingId && <Text style={{ color: theme.muted }} className="text-[11px] mt-1">View booking</Text>}</View></View></TouchableOpacity></>;
  };
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.canvas }}><StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.canvas} translucent={false} /><View className="px-5 pt-3 pb-4 flex-row items-center"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBackOrReplace('/(player)')} className="w-11 h-11 rounded-xl border items-center justify-center mr-3" style={{ borderColor: theme.border }}><Ionicons name="arrow-back" size={23} color={theme.text} /></TouchableOpacity><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 25, color: theme.text }} className="flex-1">NOTIFICATIONS</Text>{items.some((item) => !item.isRead) && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mark all notifications read" onPress={markAll} className="min-h-[44px] justify-center"><Text style={{ color: theme.green }} className="text-sm font-semibold">Mark all read</Text></TouchableOpacity>}</View><FlatList data={items} renderItem={renderItem} keyExtractor={(item) => item.id} className="px-5" contentContainerStyle={{ paddingTop: 4, paddingBottom: 28, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.green} colors={[theme.green]} />} onEndReached={loadMore} onEndReachedThreshold={0.5} ListEmptyComponent={loading ? <ActivityIndicator className="mt-16" color={theme.green} /> : <View className="items-center pt-24 px-6"><View style={{ borderColor: theme.border }} className="w-24 h-24 rounded-full border-2 items-center justify-center"><Ionicons name="notifications" size={42} color={theme.muted} /></View><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 26, color: theme.text }} className="mt-6">NO NOTIFICATIONS YET</Text><Text style={{ color: theme.subtle }} className="text-center text-[15px] leading-6 mt-3">We'll let you know when something needs your attention.</Text></View>} ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color={theme.green} /> : null} /><Toast message={error} tone="error" onHide={() => setError(null)} /></SafeAreaView>;
}
