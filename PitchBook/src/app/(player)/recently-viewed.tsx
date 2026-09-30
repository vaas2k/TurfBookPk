import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Ground } from '@/lib/api/vendors';
import { listRecentlyViewedGrounds } from '@/lib/api/engagement';
import { useAppearanceStore } from '@/store/appearanceStore';
import { playerThemes } from '@/theme/playerTheme';

export default function RecentlyViewedScreen() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const [grounds, setGrounds] = useState<Ground[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { setGrounds(await listRecentlyViewedGrounds()); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.canvas }}><View className="px-5 pt-4 pb-4 flex-row items-center"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} className="w-11 h-11 border rounded-xl items-center justify-center mr-3" style={{ borderColor: theme.border }}><Ionicons name="arrow-back" size={22} color={theme.text} /></TouchableOpacity><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 26, color: theme.text }}>RECENTLY VIEWED</Text></View>{loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color={theme.green} /></View> : <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>{grounds.length ? grounds.map((ground) => <TouchableOpacity key={ground.id} onPress={() => router.push({ pathname: '/(player)/ground/[id]', params: { id: ground.id } })} className="border rounded-2xl mb-3 overflow-hidden flex-row" style={{ backgroundColor: theme.surface, borderColor: theme.border }}><Image source={{ uri: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800' }} className="w-28 h-28" /><View className="flex-1 p-3 justify-between"><View><Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: theme.text }} className="text-base" numberOfLines={1}>{ground.title}</Text><Text style={{ color: theme.subtle }} className="text-xs mt-1" numberOfLines={1}>{ground.location}</Text></View><Text style={{ color: theme.green }} className="text-xs">From PKR {ground.price_per_hour.toLocaleString()}</Text></View></TouchableOpacity>) : <View className="py-20 items-center"><Ionicons name="time-outline" size={34} color={theme.green} /><Text style={{ color: theme.subtle }} className="text-sm mt-3">Grounds you open will appear here.</Text></View>}</ScrollView>}</SafeAreaView>;
}
