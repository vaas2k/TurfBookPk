import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookingProfile } from '@/types/booking';

interface BookingStatusBadgeProps {
  status: BookingProfile['status'];
  paymentStatus?: BookingProfile['payment_status'];
}

export function BookingStatusBadge({ status, paymentStatus }: BookingStatusBadgeProps) {
  let label = 'Confirmed';
  let bgClass = 'bg-[#E8F5E9]';
  let textClass = 'text-[#2E7D32]';
  let iconName: keyof typeof Ionicons.glyphMap = 'checkmark-circle';
  let iconColor = '#2E7D32';

  switch (status) {
    case 'pending_payment':
      label = 'Hold Pending';
      bgClass = 'bg-[#FFF8E1]';
      textClass = 'text-[#B45309]';
      iconName = 'time-outline';
      iconColor = '#B45309';
      break;
    case 'confirmed':
      label = 'Confirmed';
      bgClass = 'bg-[#E8F5E9]';
      textClass = 'text-[#2E7D32]';
      iconName = 'checkmark-circle';
      iconColor = '#2E7D32';
      break;
    case 'completed':
      label = 'Completed';
      bgClass = 'bg-[#EFF6FF]';
      textClass = 'text-[#1D4ED8]';
      iconName = 'checkmark-done';
      iconColor = '#1D4ED8';
      break;
    case 'cancelled':
      label = paymentStatus === 'refund_pending' ? 'Cancelled (Refund Pending)' : 'Cancelled';
      bgClass = 'bg-[#FEE2E2]';
      textClass = 'text-[#DC2626]';
      iconName = 'close-circle';
      iconColor = '#DC2626';
      break;
    case 'expired':
      label = 'Hold Expired';
      bgClass = 'bg-[#F3F4F6]';
      textClass = 'text-[#6B7280]';
      iconName = 'hourglass-outline';
      iconColor = '#6B7280';
      break;
    case 'no_show':
      label = 'No Show';
      bgClass = 'bg-[#FEE2E2]';
      textClass = 'text-[#991B1B]';
      iconName = 'alert-circle';
      iconColor = '#991B1B';
      break;
    default:
      label = String(status).replaceAll('_', ' ');
      bgClass = 'bg-[#F3F4F6]';
      textClass = 'text-[#4B5563]';
      iconName = 'information-circle-outline';
      iconColor = '#4B5563';
  }

  return (
    <View className={`flex-row items-center px-2.5 py-1 rounded-full ${bgClass} self-start`}>
      <Ionicons name={iconName} size={13} color={iconColor} />
      <Text className={`text-xs font-semibold ml-1 ${textClass}`}>
        {label}
      </Text>
    </View>
  );
}
