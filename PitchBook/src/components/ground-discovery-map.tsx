import { Linking, Platform, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Ground } from '@/lib/api/vendors';

export interface MappableGround {
  ground: Ground;
  lowestPrice: number;
  distanceKm: number | null;
}

interface Props {
  grounds: MappableGround[];
  userLocation: { latitude: number; longitude: number } | null;
  onGroundPress: (id: string) => void;
  embedded?: boolean;
}

const defaultRegion: Region = { latitude: 33.6844, longitude: 73.0479, latitudeDelta: 0.16, longitudeDelta: 0.16 };

export function GroundDiscoveryMap({ grounds, userLocation, onGroundPress, embedded = false }: Props) {
  const first = grounds.find(({ ground }) => ground.latitude !== null && ground.longitude !== null)?.ground;
  const region: Region = userLocation ? { ...userLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 } : first && first.latitude !== null && first.longitude !== null ? { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 } : defaultRegion;
  if (Platform.OS === 'web') return <View className="h-72 bg-white rounded-2xl border border-[#E5E5E5] items-center justify-center px-8"><Ionicons name="map-outline" size={38} color="#9CA3AF" /><Text className="text-[#1A1A2E] font-bold mt-3">Map discovery is available in the mobile app</Text><Text className="text-[#737373] text-sm text-center mt-1">Use the list view to browse grounds on web.</Text></View>;
  if (!embedded) return null;
  return <View className="h-[420px] rounded-2xl overflow-hidden border border-[#E5E5E5]"><MapView style={{ flex: 1 }} initialRegion={region} mapType="standard" showsUserLocation={Boolean(userLocation)} showsMyLocationButton={Boolean(userLocation)}>
    {grounds.map(({ ground, lowestPrice, distanceKm }) => ground.latitude !== null && ground.longitude !== null && <Marker key={ground.id} coordinate={{ latitude: ground.latitude, longitude: ground.longitude }} pinColor="#2E7D32" title={ground.title} description={`From PKR ${lowestPrice.toLocaleString()}`}>
      <Callout onPress={() => onGroundPress(ground.id)}><View className="w-52 p-1"><Text className="font-bold text-[#1A1A2E]">{ground.title}</Text><Text className="text-[#4CAF50] mt-1">From PKR {lowestPrice.toLocaleString()}</Text>{distanceKm !== null && <Text className="text-[#737373] text-xs mt-1">{distanceKm.toFixed(1)} km away</Text>}<Text className="text-[#2E7D32] text-xs font-bold mt-2">Tap to view slots or use directions below.</Text></View></Callout>
    </Marker>)}
  </MapView>
  <View className="absolute bottom-3 left-3 right-3 bg-white rounded-xl px-3 py-2 flex-row items-center"><Ionicons name="information-circle-outline" size={18} color="#2E7D32" /><Text className="flex-1 ml-2 text-[#4B5563] text-xs">Tap a pin, then its callout to view available slots.</Text></View></View>;
}

export function openGroundDirections(ground: Ground): Promise<void> {
  if (ground.latitude === null || ground.longitude === null) return Promise.reject(new Error('This ground has no map coordinates.'));
  return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${ground.latitude},${ground.longitude}`);
}
