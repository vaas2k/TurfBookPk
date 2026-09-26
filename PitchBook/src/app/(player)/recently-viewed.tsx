import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Ground } from '@/lib/api/vendors';
import { listRecentlyViewedGrounds } from '@/lib/api/engagement';

export default function RecentlyViewedScreen() {
  const [grounds, setGrounds] = useState<Ground[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { setGrounds(await listRecentlyViewedGrounds()); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-[#10120F]"><View className="px-5 pt-4 pb-4 flex-row items-center"><TouchableOpacity onPress={() => router.back()} className="w-10 h-10 border border-[#30372B] rounded-xl items-center justify-center mr-3"><Ionicons name="arrow-back" size={22} color="#F8F7F0" /></TouchableOpacity><Text style={{ fontFamily: 'BigShouldersDisplay_800ExtraBold', fontSize: 26 }} className="text-[#F8F7F0]">RECENTLY VIEWED</Text></View>{loading ? <View className="flex-1 items-center justify-center"><ActivityIndicator color="#3DB54A" /></View> : <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>{grounds.length ? grounds.map((ground) => <TouchableOpacity key={ground.id} onPress={() => router.push({ pathname: '/(player)/ground/[id]', params: { id: ground.id } })} className="bg-[#20241D] border border-[#30372B] rounded-2xl mb-3 overflow-hidden flex-row"><Image source={{ uri: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800' }} className="w-28 h-28" /><View className="flex-1 p-3 justify-between"><View><Text style={{ fontFamily: 'SpaceGrotesk_700Bold' }} className="text-[#F3F4EF] text-base" numberOfLines={1}>{ground.title}</Text><Text className="text-[#AFAFA9] text-xs mt-1" numberOfLines={1}>{ground.location}</Text></View><Text className="text-[#59C462] text-xs">From PKR {ground.price_per_hour.toLocaleString()}</Text></View></TouchableOpacity>) : <View className="py-20 items-center"><Ionicons name="time-outline" size={34} color="#59C462" /><Text className="text-[#AFAFA9] text-sm mt-3">Grounds you open will appear here.</Text></View>}</ScrollView>}</SafeAreaView>;
}
