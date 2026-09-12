import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification, listNotifications } from '@/lib/api/notifications';
import { Toast } from '@/components/ui/toast';

export default function VendorNotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listNotifications()); }
    catch (caught: any) { setError(caught?.message || 'Unable to load notifications.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return <SafeAreaView className="flex-1 bg-[#F8F9FA]">
    <View className="px-5 py-4 bg-white border-b border-[#E5E5E5] flex-row items-center">
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} className="w-10 h-10 rounded-full bg-[#F5F5F5] items-center justify-center mr-3"><Ionicons name="arrow-back" size={20} color="#1A1A2E" /></TouchableOpacity>
      <Text className="text-2xl font-bold text-[#1A1A2E]">Notifications</Text>
    </View>
    <ScrollView className="p-4" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={['#4CAF50']} />}>
      {loading && items.length === 0 ? <ActivityIndicator color="#4CAF50" /> : items.length === 0 ? <Text className="text-[#737373] text-center py-12">No vendor notifications yet.</Text> : items.map((item) => <View key={item.id} className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"><Text className="text-[#1A1A2E] font-bold">{item.title}</Text><Text className="text-[#737373] mt-1">{item.message}</Text></View>)}
    </ScrollView>
    <Toast message={error} tone="error" onHide={() => setError(null)} />
  </SafeAreaView>;
}
