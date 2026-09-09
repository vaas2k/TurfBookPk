import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CheckoutHoldTimerProps {
  initialSeconds?: number;
  expiresAt?: string | null;
  onExpire?: () => void;
}

export function CheckoutHoldTimer({ initialSeconds = 600, expiresAt, onExpire }: CheckoutHoldTimerProps) {
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const calculateRemaining = useCallback(() => {
    if (expiresAt) {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return initialSeconds;
  }, [expiresAt, initialSeconds]);

  const [timeLeft, setTimeLeft] = useState(calculateRemaining);

  useEffect(() => {
    setTimeLeft(calculateRemaining());
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (onExpireRef.current) onExpireRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = timeLeft < 120;
  const isExpired = timeLeft === 0;

  const containerBg = isExpired ? 'bg-[#FEE2E2]' : isUrgent ? 'bg-[#FEF3C7]' : 'bg-[#E0F2FE]';
  const textColor = isExpired ? 'text-[#DC2626]' : isUrgent ? 'text-[#D97706]' : 'text-[#0284C7]';
  const iconColor = isExpired ? '#DC2626' : isUrgent ? '#D97706' : '#0284C7';

  return (
    <View className={`rounded-2xl p-4 flex-row items-center justify-between ${containerBg} border border-transparent`}>
      <View className="flex-row items-center flex-1 mr-3">
        <Ionicons name={isExpired ? 'alert-circle' : 'timer-outline'} size={20} color={iconColor} />
        <View className="ml-2.5 flex-1">
          <Text className={`text-xs font-semibold ${textColor}`}>
            {isExpired ? 'Slot hold expired' : 'Slot held for checkout'}
          </Text>
          <Text className="text-[#4B5563] text-xs mt-0.5">
            {isExpired
              ? 'This slot may now be taken by another player.'
              : 'Complete confirmation before timer expires.'}
          </Text>
        </View>
      </View>
      <Text className={`text-base font-bold font-mono ${textColor}`}>
        {formatted}
      </Text>
    </View>
  );
}
