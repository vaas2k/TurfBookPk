import { useLocalSearchParams } from 'expo-router';
import { BookingDetails } from '@/components/booking/BookingDetails';

export default function PlayerBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetails id={id || ''} vendorView={false} />;
}
