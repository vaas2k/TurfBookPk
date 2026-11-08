import { useRef, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { scanCheckIn } from '@/lib/api/bookings';
import { shortBookingReference } from '@/lib/booking-reference';

export default function ManagerScan() {
  const [permission, askPermission] = useCameraPermissions();
  const [working, setWorking] = useState(false);
  const scanInFlight = useRef(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const scan = async (token: string) => {
    if (scanInFlight.current || result) return;
    scanInFlight.current = true;
    setWorking(true);
    try { const checked = await scanCheckIn(token); setResult(`Arrival confirmed for booking #${shortBookingReference(checked.booking_number)}`); setError(''); }
    catch (caught: any) { setError(caught?.message || 'Check-in failed. Ask the player to refresh the QR.'); }
    finally { scanInFlight.current = false; setWorking(false); }
  };
  return <SafeAreaView className="flex-1 bg-[#10120F]" edges={['top', 'bottom', 'left', 'right']}>
    <View className="flex-row items-center px-5 pt-3"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} className="w-11 h-11 justify-center"><Ionicons name="arrow-back" size={24} color="#F5F5F0" /></TouchableOpacity><Text className="text-[#F5F5F0] text-xl font-bold ml-2">Scan check-in QR</Text></View>
    <Text className="text-[#A6ACA3] text-sm px-6 mt-3">Ask the player to open Ground check-in from their booking.</Text>
    {!permission ? <ActivityIndicator color="#42B84F" className="mt-12" /> : !permission.granted ? <TouchableOpacity accessibilityRole="button" onPress={() => void askPermission()} className="bg-[#42B84F] rounded-full py-4 mx-6 mt-8 items-center"><Text className="text-[#102110] font-bold">Allow camera</Text></TouchableOpacity> : <View className="h-[360px] mx-6 mt-6 rounded-3xl overflow-hidden"><CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={working || Boolean(result) ? undefined : ({ data }) => void scan(data)} /></View>}
    {working ? <ActivityIndicator color="#42B84F" className="mt-6" /> : null}
    {result ? <Text className="text-[#75D67E] text-center text-lg font-bold mx-6 mt-6">{result}</Text> : null}
    {error ? <Text className="text-[#F4B844] text-center mx-6 mt-6">{error}</Text> : null}
    {(result || error) ? <TouchableOpacity accessibilityRole="button" onPress={() => { setResult(''); setError(''); }} className="border border-[#42B84F] rounded-full py-3 mx-6 mt-6 items-center"><Text className="text-[#75D67E] font-bold">Scan another</Text></TouchableOpacity> : null}
  </SafeAreaView>;
}
