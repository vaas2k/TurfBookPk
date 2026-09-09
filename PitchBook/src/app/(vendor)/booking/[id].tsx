import { useLocalSearchParams } from 'expo-router';
import { BookingDetails } from '@/components/booking/BookingDetails';

export default function VendorBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetails id={id || ''} vendorView />;
}
