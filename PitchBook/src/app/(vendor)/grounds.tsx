import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteGround, Ground, listGroundSlots, listVendorGrounds, Slot, updateGround } from '@/lib/api/vendors';
import { Toast } from '@/components/ui/toast';

export default function VendorGrounds() {
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Ground | null>(null);
  const [updatingGroundId, setUpdatingGroundId] = useState<string | null>(null);
  const [slotsByGround, setSlotsByGround] = useState<Record<string, Slot[]>>({});

  const loadGrounds = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listVendorGrounds();
      setGrounds(items);
      const slotEntries = await Promise.all(items.map(async (ground) => [ground.id, await listGroundSlots(ground.id)] as const));
      setSlotsByGround(Object.fromEntries(slotEntries));
    } catch (error: any) { setToast(error?.message || 'Unable to load your grounds.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGrounds(); }, [loadGrounds]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try { await deleteGround(pendingDelete.id); setPendingDelete(null); await loadGrounds(); setToast('Ground deleted.'); }
    catch (error: any) { setPendingDelete(null); setToast(error?.message || 'Unable to delete ground.'); }
  };

  const setGroundActive = async (ground: Ground, isActive: boolean) => {
    setUpdatingGroundId(ground.id);
    try {
      await updateGround(ground.id, { is_active: isActive });
      await loadGrounds();
      setToast(isActive ? 'Ground activated and visible to players.' : 'Ground deactivated and hidden from players.');
    } catch (error: any) {
      setToast(error?.message || 'Unable to change ground availability.');
    } finally {
      setUpdatingGroundId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F8F9FA]">
      <ScrollView className="flex-1 px-6" refreshControl={<RefreshControl refreshing={loading} onRefresh={loadGrounds} />}>
        <View className="flex-row items-center py-4">
          <TouchableOpacity className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3 border border-[#E5E5E5]" onPress={() => router.back()}><Ionicons name="arrow-back" size={20} color="#1A1A2E" /></TouchableOpacity>
          <View className="flex-1"><Text className="text-2xl font-bold text-[#1A1A2E]">My Grounds</Text><Text className="text-[#737373] text-sm mt-1">{grounds.length} {grounds.length === 1 ? 'ground' : 'grounds'} · manage availability</Text></View>
          <TouchableOpacity className="bg-[#4CAF50] rounded-full px-4 py-2" onPress={() => router.push('/(vendor)/add-ground')}>
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>
        {loading && grounds.length === 0 ? <ActivityIndicator color="#4CAF50" /> : grounds.length === 0 ? (
          <View className="items-center py-20"><Ionicons name="business-outline" size={48} color="#D4D4D4" /><Text className="text-[#737373] mt-3">No grounds yet</Text></View>
        ) : grounds.map((ground) => (
          <View key={ground.id} className="bg-white rounded-2xl overflow-hidden mb-4 border border-[#E5E5E5]">
            <Image source={{ uri: ground.cover_image || ground.images[0] || 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800' }} className="w-full h-32" resizeMode="cover" />
            <View className="p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1"><Text className="text-lg font-bold text-[#1A1A2E]">{ground.title}</Text><Text className="text-[#737373] mt-1">{ground.city} · Rs {ground.price_per_hour}/hr</Text></View>
              <View className={`px-2 py-1 rounded-full ${ground.is_active ? 'bg-[#E8F5E9]' : 'bg-[#F5F5F5]'}`}><Text className="text-xs">{ground.is_active ? 'Active' : 'Inactive'}</Text></View>
            </View>
            <Text className="text-[#737373] text-sm mt-2" numberOfLines={2}>{ground.description || ground.address}</Text>
            <View className="flex-row items-center mt-3"><Ionicons name="calendar-outline" size={16} color="#4CAF50" /><Text className="text-[#4CAF50] text-sm font-medium ml-2">{(slotsByGround[ground.id] || []).filter((slot) => !slot.is_booked && !slot.is_blocked).length} available</Text><Text className="text-[#A3A3A3] mx-2">·</Text><Text className="text-[#737373] text-sm">{(slotsByGround[ground.id] || []).filter((slot) => slot.is_booked).length} booked</Text></View>
            <View className="flex-row mt-4">
              <TouchableOpacity className="flex-1 bg-[#E8F5E9] rounded-xl py-3 mr-2 items-center" onPress={() => router.push({ pathname: '/(vendor)/ground-slots', params: { id: ground.id, title: ground.title } })}><Text className="text-[#4CAF50] font-bold">Manage Slots</Text></TouchableOpacity>
              <TouchableOpacity className="w-12 items-center justify-center" onPress={() => router.push({ pathname: '/(vendor)/add-ground', params: { id: ground.id } })}><Ionicons name="create-outline" size={22} color="#1A1A2E" /></TouchableOpacity>
              <TouchableOpacity className="w-12 items-center justify-center" onPress={() => setPendingDelete(ground)}><Ionicons name="trash-outline" size={22} color="#DC2626" /></TouchableOpacity>
            </View>
            <TouchableOpacity
              disabled={updatingGroundId === ground.id}
              onPress={() => setGroundActive(ground, !ground.is_active)}
              className={`mt-3 rounded-xl py-3 items-center ${ground.is_active ? 'bg-[#FEF2F2]' : 'bg-[#E8F5E9]'}`}
            >
              <Text className={`font-bold ${ground.is_active ? 'text-[#DC2626]' : 'text-[#2E7D32]'}`}>
                {updatingGroundId === ground.id ? 'Updating...' : ground.is_active ? 'Deactivate Ground' : 'Activate Ground'}
              </Text>
            </TouchableOpacity>
            </View></View>
        ))}
      </ScrollView>
      <Modal visible={Boolean(pendingDelete)} transparent animationType="fade" onRequestClose={() => setPendingDelete(null)}><View className="flex-1 bg-black/40 items-center justify-center px-8"><View className="bg-white rounded-2xl p-6 w-full"><Text className="text-xl font-bold text-[#1A1A2E]">Delete ground?</Text><Text className="text-[#737373] mt-2">Grounds with booked slots cannot be deleted.</Text><View className="flex-row justify-end mt-6"><TouchableOpacity onPress={() => setPendingDelete(null)} className="px-4 py-3"><Text className="text-[#737373] font-medium">Cancel</Text></TouchableOpacity><TouchableOpacity onPress={handleDelete} className="bg-[#DC2626] rounded-xl px-4 py-3"><Text className="text-white font-bold">Delete</Text></TouchableOpacity></View></View></View></Modal>
      <Toast message={toast} tone="error" onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}
