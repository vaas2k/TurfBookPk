import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Ground } from '@/lib/api/vendors';
import { listFavoriteGrounds, listRecentlyViewedGrounds } from '@/lib/api/engagement';
import { useAppearanceStore } from '@/store/appearanceStore';
import { playerThemes } from '@/theme/playerTheme';

export default function SavedGroundsScreen() {
  const appearance = useAppearanceStore((state) => state.appearance);
  const theme = playerThemes[appearance];
  const [favorites, setFavorites] = useState<Ground[]>([]); const [recent, setRecent] = useState<Ground[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { const [saved, viewed] = await Promise.all([listFavoriteGrounds(), listRecentlyViewedGrounds()]); setFavorites(saved); setRecent(viewed); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const card = (ground: Ground, saved: boolean) => <TouchableOpacity key={ground.id} onPress={() => router.push({ pathname: '/(player)/ground/[id]', params: { id: ground.id } })} className="border rounded-2xl p-4 mb-3 flex-row items-center" style={{ backgroundColor: theme.surface, borderColor: theme.border }}><View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: theme.businessSurface }}><Ionicons name={saved ? 'heart' : 'time-outline'} size={22} color={saved ? '#FF6B65' : theme.green} /></View><View className="flex-1 ml-3"><Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: theme.text }} className="text-base" numberOfLines={1}>{ground.title}</Text><Text style={{ color: theme.subtle }} className="text-xs mt-1" numberOfLines={1}>{ground.location}, {ground.city}</Text><Text style={{ color: theme.green }} className="text-xs mt-1">From PKR {ground.price_per_hour.toLocaleString()}</Text></View><Ionicons name="chevron-forward" size={20} color={theme.muted} /></TouchableOpacity>;
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.canvas }}><View className="px-5 pt-4 pb-4 flex-row items-center"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} className="w-11 h-11 border rounded-xl items-center justify-center mr-3" style={{ borderColor: theme.border }}><Ionicons name="arrow-back" size={22} color={theme.text} /></TouchableOpacity><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 26, color: theme.text }}>SAVED GROUNDS</Text></View>{loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color={theme.green} /></View> : <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}><Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 18, color: theme.muted }} className="mb-2">FAVORITES</Text>{favorites.length ? favorites.map((ground) => card(ground, true)) : <Text style={{ color: theme.subtle }} className="text-sm mb-7">Tap the heart on any ground to save it here.</Text>}<Text style={{ fontFamily: 'BigShouldersDisplay_700Bold', fontSize: 18, color: theme.muted }} className="mt-4 mb-2">RECENTLY VIEWED</Text>{recent.length ? recent.map((ground) => card(ground, false)) : <Text style={{ color: theme.subtle }} className="text-sm">Grounds you open will appear here.</Text>}</ScrollView>}</SafeAreaView>;
}
