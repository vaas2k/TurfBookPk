import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listNotifications, AppNotification } from '@/lib/api/notifications';
import { Toast } from '@/components/ui/toast';

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { listNotifications().then(setItems).catch((e: any) => setError(e?.message || 'Unable to load notifications.')).finally(() => setLoading(false)); }, []);
  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><View className="px-6 py-5 bg-white border-b border-[#E5E5E5]"><Text className="text-2xl font-bold text-[#1A1A2E]">Notifications</Text></View><ScrollView className="p-4">{loading ? <ActivityIndicator color="#4CAF50" /> : items.length === 0 ? <Text className="text-[#737373] text-center py-12">No notifications yet.</Text> : items.map((item) => <View key={item.id} className="bg-white rounded-2xl p-4 mb-3 border border-[#E5E5E5]"><Text className="text-[#1A1A2E] font-bold">{item.title}</Text><Text className="text-[#737373] mt-1">{item.message}</Text></View>)}</ScrollView><Toast message={error} tone="error" onHide={() => setError(null)} /></SafeAreaView>;
}