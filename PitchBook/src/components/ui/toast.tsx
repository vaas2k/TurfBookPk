import { useEffect } from 'react';
import { Text, View } from 'react-native';

interface ToastProps {
  message: string | null;
  tone?: 'error' | 'success' | 'info';
  onHide: () => void;
}

export function Toast({ message, tone = 'info', onHide }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onHide, 3200);
    return () => clearTimeout(timer);
  }, [message, onHide]);

  if (!message) return null;
  const background = tone === 'error' ? '#B42318' : tone === 'success' ? '#16794A' : '#1A1A2E';
  return <View className="absolute left-5 right-5 bottom-6 z-50 rounded-2xl px-4 py-3" style={{ backgroundColor: background, elevation: 8 }}><Text className="text-white text-sm font-medium">{message}</Text></View>;
}
