import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createGroundPitch, listGroundPitches, updateGroundPitch, type Pitch } from '@/lib/api/vendors';
import { goBackOrReplace } from '@/lib/navigation';
import { Toast } from '@/components/ui/toast';

export default function GroundPitches() {
  const { id, title, setup } = useLocalSearchParams<{ id: string; title?: string; setup?: string }>();
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [name, setName] = useState('');
  const [side, setSide] = useState<7 | 9 | 11>(7);
  const [combined, setCombined] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const load = useCallback(async () => { if (id) setPitches(await listGroundPitches(id)); }, [id]);
  useEffect(() => { void load().catch(() => setToast('Could not load pitches.')); }, [load]);
  const availableSources = pitches.filter((pitch) => pitch.side === 7 && pitch.kind === 'independent' && pitch.is_active !== false);
  const save = async () => {
    if (!id || busy) return;
    if (!name.trim()) return setToast('Give this pitch a name, such as Pitch A.');
    if (combined && sources.length !== 2) return setToast('Choose exactly two 7 a-side pitches to combine.');
    setBusy(true);
    try {
      await createGroundPitch(id, { name: name.trim(), side, kind: combined ? 'combined' : 'independent', component_pitch_ids: combined ? sources : [] });
      setName(''); setSources([]); setCombined(false); await load();
      setToast('Pitch added. Set its booking times below.');
    } catch (error: any) { setToast(error?.message || 'Could not add pitch.'); }
    finally { setBusy(false); }
  };
  const changeInitialPitch = async (pitch: Pitch, nextSide: 7 | 9 | 11) => {
    if (!id) return;
    try { await updateGroundPitch(id, pitch.id, { side: nextSide }); await load(); }
    catch (error: any) { setToast(error?.message || 'Could not change pitch size.'); }
  };
  return <SafeAreaView edges={['top', 'bottom', 'left', 'right']} className="flex-1 bg-[#10120F]">
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View className="flex-row items-center pt-5 pb-5"><TouchableOpacity accessibilityLabel="Go back" onPress={() => goBackOrReplace('/(vendor)/grounds')} className="w-11 h-11 justify-center"><Ionicons name="chevron-back" color="#F5F5F0" size={26} /></TouchableOpacity><Text className="text-[#F5F5F0] text-2xl font-bold flex-1">Pitches</Text></View>
      <Text className="text-[#AFAFA9] text-base mb-6">Add each playing area at {title || 'your ground'}. Every pitch gets its own booking times and price.</Text>
      {pitches.map((pitch, index) => <View key={pitch.id} className="bg-[#1B1F19] border border-[#30372B] rounded-2xl p-5 mb-3">
        <Text className="text-[#F5F5F0] text-xl font-bold">{pitch.name} · {pitch.side} a-side</Text>
        <Text className="text-[#AFAFA9] mt-1">{pitch.kind === 'combined' ? 'Uses two 7 a-side pitches' : 'Separate playing area'}</Text>
        {index === 0 && pitch.kind === 'independent' && <View className="flex-row mt-3">{([7,9,11] as const).map((value) => <TouchableOpacity key={value} onPress={() => void changeInitialPitch(pitch, value)} className={`px-3 py-2 rounded-full border mr-2 ${pitch.side === value ? 'border-[#57CC63]' : 'border-[#454B42]'}`}><Text className="text-[#E5E7E0]">{value} a-side</Text></TouchableOpacity>)}</View>}
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push({ pathname: '/(vendor)/setup-schedule', params: { id, pitchId: pitch.id, title: `${pitch.name} · ${title || ''}` } })} className="bg-[#23432A] rounded-full px-5 py-3 mt-4 self-start"><Text className="text-[#75D67E] font-bold">Set booking times</Text></TouchableOpacity>
      </View>)}
      <View className="bg-[#1B251B] border border-[#315536] rounded-2xl p-5 mt-4">
        <Text className="text-[#F5F5F0] text-xl font-bold mb-2">Add a pitch</Text>
        <TextInput accessibilityLabel="Pitch name" value={name} onChangeText={setName} placeholder="Pitch B" placeholderTextColor="#858B80" className="bg-[#101510] border border-[#455A43] rounded-xl px-4 py-3 text-[#F5F5F0] text-base" />
        <View className="flex-row mt-4">{([7,9,11] as const).map((value) => <TouchableOpacity key={value} onPress={() => { setSide(value); if (value === 7) { setCombined(false); setSources([]); } }} className={`px-4 py-3 rounded-xl mr-2 border ${side === value ? 'border-[#57CC63] bg-[#17301B]' : 'border-[#455A43]'}`}><Text className="text-[#F5F5F0] font-bold">{value} a-side</Text></TouchableOpacity>)}</View>
        {side !== 7 && <View className="mt-4"><Text className="text-[#D5D8D1] mb-2">How is this pitch made?</Text>{[false,true].map((value) => <TouchableOpacity key={String(value)} onPress={() => { setCombined(value); setSources([]); }} className={`rounded-xl border p-3 mb-2 ${combined === value ? 'border-[#57CC63]' : 'border-[#455A43]'}`}><Text className="text-[#F5F5F0]">{value ? 'Combine two 7 a-side pitches' : 'Separate large pitch'}</Text></TouchableOpacity>)}</View>}
        {combined && <View className="mt-2"><Text className="text-[#D5D8D1] mb-2">Choose two 7 a-side pitches</Text>{availableSources.map((pitch) => <TouchableOpacity key={pitch.id} onPress={() => setSources((current) => current.includes(pitch.id) ? current.filter((id) => id !== pitch.id) : current.length < 2 ? [...current, pitch.id] : current)} className={`rounded-xl border p-3 mb-2 ${sources.includes(pitch.id) ? 'border-[#57CC63]' : 'border-[#455A43]'}`}><Text className="text-[#F5F5F0]">{sources.includes(pitch.id) ? '✓ ' : ''}{pitch.name}</Text></TouchableOpacity>)}</View>}
        <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void save()} className="bg-[#42B84F] rounded-full py-4 items-center mt-4"><Text className="text-[#102110] font-bold">{busy ? 'Saving…' : 'Add pitch'}</Text></TouchableOpacity>
      </View>
      {setup === '1' && <TouchableOpacity accessibilityRole="button" onPress={() => router.replace({ pathname: '/(vendor)/ground-verification', params: { id } })} className="border border-[#57CC63] rounded-full py-4 items-center mt-6"><Text className="text-[#75D67E] font-bold">Continue to ground verification</Text></TouchableOpacity>}
    </ScrollView></KeyboardAvoidingView><Toast message={toast} tone="error" onHide={() => setToast(null)} />
  </SafeAreaView>;
}
