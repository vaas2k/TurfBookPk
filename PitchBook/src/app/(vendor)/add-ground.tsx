import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { createGround, Ground, listVendorGrounds, updateGround } from '@/lib/api/vendors';
import { Ionicons } from '@expo/vector-icons';
import { Toast } from '@/components/ui/toast';

const MOCK_GROUND_IMAGE = 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200';
const fieldClass = 'bg-white border border-[#E5E5E5] rounded-xl px-4 py-3 text-[#1A1A2E]';
type FormState = { title: string; description: string; location: string; city: string; address: string; price_per_hour: string; peak_price: string; pitch_type: string; cover_image: string; images: string[]; amenities: string[]; rules: string[]; latitude: string; longitude: string; cancellation_policy: string };

const emptyForm: FormState = { title: '', description: '', location: '', city: '', address: '', price_per_hour: '', peak_price: '', pitch_type: '', cover_image: '', images: [], amenities: [], rules: [], latitude: '', longitude: '', cancellation_policy: '' };

export default function AddGround() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [existing, setExisting] = useState<Ground | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newAmenity, setNewAmenity] = useState('');
  const [newRule, setNewRule] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    listVendorGrounds().then((items) => {
      const ground = items.find((item) => item.id === id);
      if (!ground) return;
      setExisting(ground);
      setForm({ title: ground.title, description: ground.description || '', location: ground.location, city: ground.city, address: ground.address, price_per_hour: String(ground.price_per_hour), peak_price: ground.peak_price ? String(ground.peak_price) : '', pitch_type: ground.pitch_type || '', cover_image: ground.cover_image || '', images: ground.images, amenities: ground.amenities, rules: ground.rules, latitude: ground.latitude ? String(ground.latitude) : '', longitude: ground.longitude ? String(ground.longitude) : '', cancellation_policy: ground.cancellation_policy || '' });
    }).catch(() => setToast('Unable to load ground details. Please try again.'));
  }, [id]);

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const addTag = (key: 'amenities' | 'rules', value: string, clear: (value: string) => void) => {
    const clean = value.trim();
    if (!clean || form[key].includes(clean)) return;
    setForm((current) => ({ ...current, [key]: [...current[key], clean] }));
    clear('');
  };
  const removeTag = (key: 'amenities' | 'rules', value: string) => setForm((current) => ({ ...current, [key]: current[key].filter((item) => item !== value) }));

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setToast('Allow photo access to choose a cover image.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
    if (!result.canceled) update('cover_image', result.assets[0].uri);
  };

  const addImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setToast('Allow photo access to add ground images.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (!result.canceled) setForm((current) => ({ ...current, images: [...current.images, ...result.assets.map((asset) => asset.uri)] }));
  };

  const save = async () => {
    if (!form.title.trim() || !form.location.trim() || !form.city.trim() || !form.address.trim() || !form.price_per_hour) return setToast('Title, location, city, address, and hourly price are required.');
    const latitude = form.latitude ? Number(form.latitude) : null;
    const longitude = form.longitude ? Number(form.longitude) : null;
    if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return setToast('Latitude must be between -90 and 90.');
    if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return setToast('Longitude must be between -180 and 180.');
    if (!Number.isInteger(Number(form.price_per_hour)) || Number(form.price_per_hour) <= 0) return setToast('Price per hour must be a positive whole number.');
    if (form.peak_price && (!Number.isInteger(Number(form.peak_price)) || Number(form.peak_price) <= 0)) return setToast('Peak price must be a positive whole number.');
    setSaving(true);
    const images = form.images.length ? form.images : [MOCK_GROUND_IMAGE];
    const data = { title: form.title.trim(), description: form.description.trim(), location: form.location.trim(), city: form.city.trim(), address: form.address.trim(), price_per_hour: Number(form.price_per_hour), peak_price: form.peak_price ? Number(form.peak_price) : null, pitch_type: form.pitch_type.trim(), cover_image: form.cover_image || images[0], images, amenities: form.amenities, rules: form.rules, latitude, longitude, cancellation_policy: form.cancellation_policy.trim() };
    try { if (existing) await updateGround(existing.id, data); else await createGround(data); router.replace('/(vendor)/grounds'); }
    catch (error: any) { setToast(error?.message || 'Unable to save ground. Please try again.'); }
    finally { setSaving(false); }
  };

  const renderTags = (key: 'amenities' | 'rules') => <View className="flex-row flex-wrap mt-2">{form[key].map((item) => <View key={item} className="flex-row items-center bg-[#E8F5E9] rounded-full px-3 py-2 mr-2 mb-2"><Text className="text-[#2E7D32] mr-2">{item}</Text><TouchableOpacity onPress={() => removeTag(key, item)}><Ionicons name="close-circle" size={16} color="#2E7D32" /></TouchableOpacity></View>)}</View>;
  const tagInput = (key: 'amenities' | 'rules', value: string, setValue: (value: string) => void, placeholder: string) => <View className="flex-row items-center"><TextInput className={`${fieldClass} flex-1`} value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor="#A3A3A3" onSubmitEditing={() => addTag(key, value, setValue)} returnKeyType="done" /><TouchableOpacity className="bg-[#1A1A2E] rounded-xl p-3 ml-2" onPress={() => addTag(key, value, setValue)}><Ionicons name="add" size={22} color="white" /></TouchableOpacity></View>;

  return <SafeAreaView className="flex-1 bg-[#F8F9FA]"><ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
    <View className="flex-row items-center py-5"><TouchableOpacity onPress={() => router.back()}><Text className="text-[#4CAF50] text-base">Cancel</Text></TouchableOpacity><Text className="text-xl font-bold text-[#1A1A2E] flex-1 text-center">{existing ? 'Edit Ground' : 'Add Ground'}</Text><View className="w-12" /></View>
    <Text className="text-[#737373] mb-4">Add the details players need to find and book this ground.</Text>
    {([['title', 'Ground title *'], ['description', 'Description'], ['location', 'Location / area *'], ['city', 'City *'], ['address', 'Full address *'], ['price_per_hour', 'Price per hour *'], ['peak_price', 'Peak price'], ['pitch_type', 'Pitch type'], ['latitude', 'Latitude'], ['longitude', 'Longitude'], ['cancellation_policy', 'Cancellation policy']] as [keyof FormState, string][]).map(([key, label]) => <View key={key} className="mb-3"><Text className="text-[#1A1A2E] font-medium mb-1">{label}</Text><TextInput className={fieldClass} value={form[key] as string} onChangeText={(value) => update(key, value)} placeholder={label.replace(' *', '')} placeholderTextColor="#A3A3A3" keyboardType={['price_per_hour', 'peak_price', 'latitude', 'longitude'].includes(key) ? 'numeric' : 'default'} multiline={['description', 'cancellation_policy'].includes(key)} /></View>)}
    <Text className="text-[#1A1A2E] font-medium mb-2">Cover image</Text><TouchableOpacity onPress={pickCover} className="bg-white border border-dashed border-[#4CAF50] rounded-xl overflow-hidden mb-4">{form.cover_image ? <Image source={{ uri: form.cover_image }} className="w-full h-40" resizeMode="cover" /> : <View className="h-28 items-center justify-center"><Ionicons name="image-outline" size={30} color="#4CAF50" /><Text className="text-[#4CAF50] mt-2">Choose cover image</Text></View>}</TouchableOpacity>
    <View className="flex-row items-center justify-between mb-2"><Text className="text-[#1A1A2E] font-medium">Ground images</Text><Text className="text-[#737373] text-xs">{form.images.length} selected</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">{form.images.map((uri, index) => <View key={`${uri}-${index}`} className="mr-3"><Image source={{ uri }} className="w-28 h-24 rounded-xl" resizeMode="cover" /><TouchableOpacity onPress={() => setForm((current) => ({ ...current, images: current.images.filter((_, imageIndex) => imageIndex !== index) }))} className="absolute -right-1 -top-1 bg-white rounded-full"><Ionicons name="close-circle" size={22} color="#DC2626" /></TouchableOpacity></View>)}<TouchableOpacity onPress={addImages} className="w-28 h-24 rounded-xl bg-[#E8F5E9] items-center justify-center"><Ionicons name="add" size={28} color="#4CAF50" /><Text className="text-[#4CAF50] text-xs mt-1">Add more</Text></TouchableOpacity></ScrollView>
    <View className="mb-4"><Text className="text-[#1A1A2E] font-medium mb-2">Amenities</Text>{tagInput('amenities', newAmenity, setNewAmenity, 'e.g. Parking, floodlights')}{renderTags('amenities')}</View>
    <View className="mb-4"><Text className="text-[#1A1A2E] font-medium mb-2">Rules</Text>{tagInput('rules', newRule, setNewRule, 'e.g. No smoking')}{renderTags('rules')}</View>
    <TouchableOpacity disabled={saving} onPress={save} className="bg-[#4CAF50] rounded-xl py-4 items-center mt-3"><Text className="text-white font-bold">{saving ? 'Saving...' : existing ? 'Update Ground' : 'Create Ground'}</Text></TouchableOpacity>
  </ScrollView><Toast message={toast} tone="error" onHide={() => setToast(null)} /></SafeAreaView>;
}
